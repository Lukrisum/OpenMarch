import Constants from "@/global/Constants";
import { sql } from "drizzle-orm";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { ResultSet } from "@libsql/client";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import * as HistorySchema from "./history.schema";

type HistoryType = "undo" | "redo";

/**
 * Response from the history table after performing an undo or redo action.
 */
export type HistoryResponse = {
    /**
     * True if the action was successful.
     */
    success: boolean;
    /**
     * The name of the tables that was modified.
     */
    tableNames: Set<string>;
    /**
     * The SQL statements that were executed to perform the undo or redo action.
     */
    sqlStatements: string[];
    /**
     * The error that occurred when performing the action.
     */
    error?: { message: string; stack: string };
};

/**
 * A row in the history stats table.
 */
export type HistoryStatsRow = {
    /** useless id */
    readonly id: 1;
    /**
     * The current undo group the undo stack is on.
     * When adding a new records to the undo table, this number is used to group the records together.
     *
     * To separate different undo groups, increment this number.
     * It is automatically decremented when performing an undo action.
     */
    cur_undo_group: number;
    /**
     * The current redo group the undo stack is on.
     * When adding a new records to the redo table, this number is used to group the records together.
     *
     * This should never be adjusted manually.
     * It is automatically incremented/decremented automatically when performing an undo action.
     */
    cur_redo_group: number;
    /**
     * The maximum number of undo groups to keep in the history table.
     *
     * If this number is positive, the oldest undo group is deleted when the number of undo groups exceeds this limit.
     * If this number is negative, there is no limit to the number of undo groups.
     */
    group_limit: number;
};

/**
 * A row in the undo or redo history table.
 */
export type HistoryTableRow = {
    /**
     * The sequence number of the action in the history table.
     * Primary key of the table.
     */
    sequence: number;
    /**
     * The group number of the action in the history table.
     * This is used to group actions together and is taken from the history stats table.
     *
     * To separate different groups of actions, increment the number in the history stats table.
     */
    history_group: number;
    /**
     * The SQL statement to undo or redo the action.
     */
    sql: string;
};

/**
 * Creates triggers for a table to record undo/redo history in the database.
 * These actions happen automatically when a row is inserted, updated, or deleted.
 *
 * @param db The database connection
 * @param tableName name of the table to create triggers for
 */
export function createUndoTriggers(db: LibSQLDatabase, tableName: string) {
    createTriggers(db, tableName, "undo", true);
}

/**
 * Increment the undo group in the database to create a new group for undo history.
 *
 * This will always return 1 + the max group number in the undo history table.
 *
 * @param db The database connection
 * @returns the new undo group number
 */
export function incrementUndoGroup(db: LibSQLDatabase) {
    return incrementGroup(db, "undo");
}

/**
 * Performs an undo action on the database.
 *
 * Undo history is collected based on triggers that are created for each table in the database if desired.
 * Does nothing if there is nothing on the undo stack.
 *
 * @param db the database connection
 * @returns the response from the undo action
 */
export function performUndo(db: LibSQLDatabase) {
    return executeHistoryAction(db, "undo");
}

/**
 * Performs redo action on the database.
 *
 * Redo history is collected based on performed undo actions.
 * The redo stack is cleared after a new action is entered into the undo stack.
 * Does nothing if there is nothing on the redo stack.
 *
 * @param db the database connection
 * @returns the response from the redo action
 */
export function performRedo(db: LibSQLDatabase) {
    return executeHistoryAction(db, "redo");
}

/**
 * Drops the triggers for a table if they exist. I.e. disables undo tracking for the given table.
 *
 * @param db database connection
 * @param tableName name of the table to drop triggers for
 */
export function dropUndoTriggers(db: LibSQLDatabase, tableName: string) {
    db.run(sql`DROP TRIGGER IF EXISTS ${sql.identifier(tableName + "_it")}`);
    db.run(sql`DROP TRIGGER IF EXISTS ${sql.identifier(tableName + "_ut")}`);
    db.run(sql`DROP TRIGGER IF EXISTS ${sql.identifier(tableName + "_dt")}`);
}

/**
 * Increment the group number for either the undo or redo history table.
 *
 * This is done by getting the max group number from the respective history table and incrementing it by 1.
 *
 * @param db database connection
 * @param type "undo" or "redo"
 * @returns The new group number for the respective history table
 */
function incrementGroup(db: LibSQLDatabase, type: HistoryType) {
    const historyTableName =
        type === "undo"
            ? Constants.UndoHistoryTableName
            : Constants.RedoHistoryTableName;

    // Get the max group number from the respective history table
    const result = db.run(
        sql.raw(
            `SELECT COALESCE(MAX(history_group), 0) as current_group FROM ${sql.identifier(historyTableName)}`,
        ),
    ) as unknown as { rows: Array<{ current_group: number }> };
    const maxGroup = Number(result.rows[0]?.current_group ?? 0);

    const groupString = type === "undo" ? "cur_undo_group" : "cur_redo_group";
    const newGroup = maxGroup + 1;

    db.run(
        sql`UPDATE ${sql.identifier(Constants.HistoryStatsTableName)} SET ${sql.identifier(groupString)} = ${newGroup}`,
    );

    const statsResult = db.run(
        sql.raw(
            `SELECT group_limit FROM ${sql.identifier(Constants.HistoryStatsTableName)} WHERE id = 1`,
        ),
    ) as unknown as { rows: Array<{ group_limit: number }> };
    const groupLimit = Number(statsResult.rows[0]?.group_limit ?? -1);

    // If the group limit is positive and is reached, delete the oldest group
    if (groupLimit > 0) {
        const groupsResult = db.run(
            sql.raw(
                `SELECT DISTINCT history_group FROM ${sql.identifier(historyTableName)} ORDER BY history_group`,
            ),
        ) as unknown as { rows: Array<{ history_group: number }> };
        const allGroups = groupsResult.rows.map((row) =>
            Number(row.history_group),
        );

        if (allGroups.length > groupLimit) {
            // Delete all of the groups that are older than the group limit
            const groupsToDelete = allGroups.slice(
                0,
                allGroups.length - groupLimit,
            );
            for (const group of groupsToDelete) {
                db.run(
                    sql`DELETE FROM ${sql.identifier(historyTableName)} WHERE history_group = ${group}`,
                );
            }
        }
    }

    return newGroup;
}

/**
 * Refresh the current both the undo and redo group number in the history stats table
 * to max(group) + 1 of the respective history table.
 *
 * @param db database connection
 * @param type "undo" or "redo"
 */
function refreshCurrentGroups(db: LibSQLDatabase) {
    const refreshCurrentGroup = (type: HistoryType) => {
        const tableName =
            type === "undo"
                ? Constants.UndoHistoryTableName
                : Constants.RedoHistoryTableName;
        const groupColumn =
            type === "undo" ? "cur_undo_group" : "cur_redo_group";
        const currentGroup =
            (
                db.run(
                    sql`SELECT max("history_group") as max_group FROM ${tableName};`,
                ) as unknown as { rows: Array<{ max_group: number }> }
            ).rows[0]?.max_group || 0; // default to 0 if there are no rows in the history table

        db.run(
            sql`UPDATE ${Constants.HistoryStatsTableName} SET "${groupColumn}"=${
                currentGroup + 1
            };`,
        );
    };

    refreshCurrentGroup("undo");
    refreshCurrentGroup("redo");
}

/**
 * Creates triggers for a table to insert undo/redo history.
 *
 * @param db The database connection
 * @param tableName name of the table to create triggers for
 * @param type either "undo" or "redo"
 * @param deleteRedoRows True if the redo rows should be deleted when inserting new undo rows.
 * This is only used when switching to "undo" mode.
 * The default behavior of the application has this to true so that the redo history is cleared when a new undo action is inserted.
 * It should be false when a redo is being performed and there are triggers inserting into the undo table.
 */
function createTriggers(
    db: LibSQLDatabase,
    tableName: string,
    type: HistoryType,
    deleteRedoRows: boolean = true,
) {
    const historyTableName =
        type === "undo"
            ? Constants.UndoHistoryTableName
            : Constants.RedoHistoryTableName;

    // Get the column names from the table
    const columnResult = db.run(
        sql.raw(`SELECT name FROM pragma_table_info(${tableName})`),
    ) as unknown as { rows: Array<{ name: string }> };
    const columnNames = columnResult.rows.map((row) => row.name);

    // Create the trigger for INSERT operations
    const insertTrigger = `CREATE TRIGGER IF NOT EXISTS "${tableName}_it" AFTER INSERT ON "${tableName}"
        BEGIN
            INSERT INTO "${historyTableName}" (history_group, sql)
            SELECT
                (SELECT cur_${type}_group FROM ${Constants.HistoryStatsTableName}),
                'DELETE FROM "${tableName}" WHERE rowid = ' || NEW.rowid;
            ${
                deleteRedoRows
                    ? `DELETE FROM ${Constants.RedoHistoryTableName};`
                    : ""
            }
        END;`;
    db.run(sql.raw(insertTrigger));

    // Create the trigger for UPDATE operations
    const updateTrigger = `CREATE TRIGGER IF NOT EXISTS "${tableName}_ut" AFTER UPDATE ON "${tableName}"
        BEGIN
            INSERT INTO "${historyTableName}" (history_group, sql)
            SELECT
                (SELECT cur_${type}_group FROM ${Constants.HistoryStatsTableName}),
                'UPDATE "${tableName}" SET ${columnNames
                    .map((name) => `"${name}" = ''' || OLD."${name}" || '''`)
                    .join(", ")} WHERE rowid = ' || OLD.rowid;
            ${
                deleteRedoRows
                    ? `DELETE FROM ${Constants.RedoHistoryTableName};`
                    : ""
            }
        END;`;
    db.run(sql.raw(updateTrigger));

    // Create the trigger for DELETE operations
    const deleteTrigger = `CREATE TRIGGER IF NOT EXISTS "${tableName}_dt" AFTER DELETE ON "${tableName}"
        BEGIN
            INSERT INTO "${historyTableName}" (history_group, sql)
            SELECT
                (SELECT cur_${type}_group FROM ${Constants.HistoryStatsTableName}),
                'INSERT INTO "${tableName}" (${columnNames
                    .map((name) => `"${name}"`)
                    .join(", ")}) VALUES (' || ${columnNames
                    .map((name) => `'''' || OLD."${name}" || ''''`)
                    .join(" || ', ' || ")} || ')';
            ${
                deleteRedoRows
                    ? `DELETE FROM ${Constants.RedoHistoryTableName};`
                    : ""
            }
        END;`;
    db.run(sql.raw(deleteTrigger));
}

/**
 * Switch the triggers to either undo or redo mode.
 * This is so when performing an undo action, the redo history is updated and vice versa.
 *
 * @param db The database connection
 * @param mode The mode to switch to, either "undo" or "redo"
 * @param deleteRedoRows true if the redo rows should be deleted when inserting new undo rows.
 */
function switchTriggerMode(
    db: LibSQLDatabase,
    mode: HistoryType,
    deleteRedoRows: boolean,
    tableNames?: Set<string>,
) {
    // Get all triggers in the database
    const triggerResult = db.run(
        sql.raw(
            `SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger'`,
        ),
    ) as unknown as { rows: Array<{ name: string; tbl_name: string }> };
    const triggers = triggerResult.rows;

    // Drop all triggers that match the pattern
    for (const trigger of triggers) {
        if (
            !tableNames ||
            (tableNames.has(trigger.tbl_name) &&
                trigger.name.match(/_(it|ut|dt)$/))
        ) {
            db.run(sql`DROP TRIGGER IF EXISTS ${sql.identifier(trigger.name)}`);
        }
    }

    // Recreate triggers for all tables
    if (tableNames) {
        for (const tableName of tableNames) {
            createTriggers(db, tableName, mode, deleteRedoRows);
        }
    }
}

/**
 * Performs an undo or redo action on the database.
 *
 * Undo/redo history is collected based on triggers that are created for each table in the database if desired.
 *
 * @param db the database connection
 * @param type either "undo" or "redo"
 */
function executeHistoryAction(
    db: LibSQLDatabase,
    type: HistoryType,
): HistoryResponse {
    console.log(`\n============ PERFORMING ${type.toUpperCase()} ============`);
    let response: HistoryResponse = {
        success: false,
        tableNames: new Set(),
        sqlStatements: [],
        error: { message: "No error to show", stack: "No stack to show" },
    };
    let sqlStatements: string[] = [];
    try {
        const tableName =
            type === "undo"
                ? Constants.UndoHistoryTableName
                : Constants.RedoHistoryTableName;
        let currentGroup = (
            db.run(
                sql`SELECT max("history_group") as max_group FROM ${tableName};`,
            ) as unknown as { rows: Array<{ max_group: number }> }
        ).rows[0]?.max_group;

        // Get all of the SQL statements in the current undo group
        const getSqlStatements = (group: number) =>
            (
                db.run(
                    sql`SELECT sql FROM
                ${
                    type === "undo"
                        ? Constants.UndoHistoryTableName
                        : Constants.RedoHistoryTableName
                }
                WHERE "history_group"=${group} ORDER BY sequence DESC;`,
                ) as unknown as { rows: Array<{ sql: string }> }
            ).rows.map((row) => row.sql);

        sqlStatements = getSqlStatements(currentGroup);
        if (sqlStatements.length === 0) {
            console.log("No actions to " + type);
            return {
                success: true,
                tableNames: new Set(),
                sqlStatements: [],
            };
        }

        const tableNames = new Set<string>();
        for (const sql of sqlStatements) {
            const tableName = sql.match(/"(.*?)"/)?.[0].replaceAll('"', "");
            if (tableName) {
                tableNames.add(tableName);
            }
        }

        if (type === "undo") {
            // Switch the triggers to redo mode so that the redo history is updated
            incrementGroup(db, "redo");
            switchTriggerMode(db, "redo", false, tableNames);
        } else {
            // Switch the triggers so that the redo table does not have its rows deleted
            switchTriggerMode(db, "undo", false, tableNames);
        }

        // Temporarily disable foreign key checks
        db.run(sql`PRAGMA foreign_keys = OFF`);

        /// Execute all of the SQL statements in the current history group
        for (const sqlStatement of sqlStatements) {
            db.run(sql`${sql.raw(sqlStatement)}`);
            const match = sqlStatement.match(
                /^(?:INSERT INTO|UPDATE|DELETE FROM) "([^"]+)"/,
            );
            if (match) {
                response.tableNames.add(match[1]);
            }
        }

        // Re-enable foreign key checks
        db.run(sql`PRAGMA foreign_keys = ON`);

        // Delete all of the SQL statements in the current undo group
        db.run(
            sql`DELETE FROM ${tableName} WHERE "history_group"=${currentGroup};`,
        );

        // Refresh the current group number in the history stats table
        refreshCurrentGroups(db);

        // Switch the triggers back to undo mode and delete the redo rows when inputting new undo rows
        switchTriggerMode(db, "undo", true, tableNames);
        response = {
            success: true,
            tableNames,
            sqlStatements,
        };
    } catch (err: any) {
        console.error(err);
        response = {
            success: false,
            tableNames: new Set(),
            sqlStatements: [],
            error: {
                message: err?.message || "failed to get error",
                stack: err?.stack || "Failed to get stack",
            },
        };
    } finally {
        console.log(
            `============ FINISHED ${type.toUpperCase()} =============\n`,
        );
    }

    return response;
}

/**
 * Clear the most recent redo actions from the most recent group.
 *
 * This should be used when there was an error that required changes to be
 * rolled back but the redo history should not be kept.
 *
 * @param db database connection
 */
export function clearMostRecentRedo(db: LibSQLDatabase) {
    console.log(`-------- Clearing most recent redo --------`);
    const maxGroup = (
        db.run(
            sql`SELECT MAX(history_group) as max_redo_group FROM ${sql.identifier(Constants.RedoHistoryTableName)}`,
        ) as unknown as { rows: Array<{ max_redo_group: number }> }
    ).rows[0]?.max_redo_group;
    db.run(
        sql`DELETE FROM ${sql.identifier(Constants.RedoHistoryTableName)} WHERE history_group = ${maxGroup}`,
    );
    console.log(`-------- Done clearing most recent redo --------`);
}

/**
 * @param db database connection
 * @returns The current undo group number in the history stats table
 */
export function getCurrentUndoGroup(db: LibSQLDatabase) {
    const result = db.run(
        sql.raw(
            `SELECT cur_undo_group FROM ${sql.identifier(Constants.HistoryStatsTableName)}`,
        ),
    ) as unknown as { rows: Array<{ cur_undo_group: number }> };
    return result.rows[0]?.cur_undo_group ?? 0;
}

/**
 * @param db database connection
 * @returns The current redo group number in the history stats table
 */
export function getCurrentRedoGroup(db: LibSQLDatabase) {
    const result = db.run(
        sql.raw(
            `SELECT cur_redo_group FROM ${sql.identifier(Constants.HistoryStatsTableName)}`,
        ),
    ) as unknown as { rows: Array<{ cur_redo_group: number }> };
    return result.rows[0]?.cur_redo_group ?? 0;
}

/**
 * Decrement all of the undo actions in the most recent group down by one.
 *
 * This should be used when a database action should not create its own group, but the group number
 * was incremented to allow for rolling back changes due to error.
 *
 * @param db database connection
 */
export function decrementLastUndoGroup(db: LibSQLDatabase) {
    const result = db.run(
        sql.raw(
            `SELECT cur_undo_group FROM ${sql.identifier(Constants.HistoryStatsTableName)}`,
        ),
    ) as unknown as { rows: Array<{ cur_undo_group: number }> };
    const currentGroup = result.rows[0]?.cur_undo_group;

    if (currentGroup !== undefined && currentGroup > 0) {
        db.run(
            sql.raw(
                `UPDATE ${Constants.HistoryStatsTableName} SET cur_undo_group = cur_undo_group - 1`,
            ),
        );
        db.run(
            sql.raw(
                `DELETE FROM ${sql.identifier(Constants.UndoHistoryTableName)} WHERE history_group = ${currentGroup}`,
            ),
        );
    }
}

/**
 * Flatten all of the undo groups above the given group number.
 *
 * This is used when subsequent undo groups are created, but they should be part of the same group.
 *
 * @param db database connection
 * @param group the group number to flatten above
 */
export function flattenUndoGroupsAbove(db: LibSQLDatabase, group: number) {
    console.log(`-------- Flattening undo groups above ${group} --------`);
    db.run(
        sql.raw(
            `UPDATE ${Constants.UndoHistoryTableName} SET history_group = ${group} WHERE history_group > ${group}`,
        ),
    );
    db.run(
        sql.raw(
            `UPDATE ${Constants.HistoryStatsTableName} SET cur_undo_group = ${group}`,
        ),
    );
    console.log(`-------- Done flattening undo groups above ${group} --------`);
}

/**
 * Calculate the size of the undo and redo history tables in bytes.
 *
 * @param db database connection
 * @returns the size of the undo and redo history tables in bytes
 */
/**
 * Calculate the approximate size of the undo and redo history tables in bytes.
 * This method estimates size based on row count and average row size.
 *
 * @param db database connection
 * @returns the estimated size of the undo and redo history tables in bytes
 */
export function calculateHistorySize(db: LibSQLDatabase) {
    const getSqlLength = (tableName: string): number => {
        const result = db.run(
            sql.raw(
                `SELECT SUM(LENGTH(sql)) as total FROM ${sql.identifier(tableName)}`,
            ),
        ) as unknown as { rows: Array<{ total: number }> };
        return Number(result.rows[0]?.total ?? 0);
    };

    return (
        getSqlLength(Constants.UndoHistoryTableName) +
        getSqlLength(Constants.RedoHistoryTableName)
    );
}
