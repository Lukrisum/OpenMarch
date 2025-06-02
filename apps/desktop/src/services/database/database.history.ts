import Constants from "@/global/Constants";
import { desc, eq, gt, sql } from "drizzle-orm";
import { OpenMarchDatabase } from "@/drizzle/utils";
import { historyRedo, historyStats, historyUndo } from "@/drizzle/schema";

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
 * Creates triggers for a table to record undo/redo history in the database.
 * These actions happen automatically when a row is inserted, updated, or deleted.
 *
 * @param db The database connection
 * @param tableName name of the table to create triggers for
 */
export async function createUndoTriggers(
    db: OpenMarchDatabase,
    tableName: string,
) {
    await createTriggers(db, tableName, "undo", true);
}

/**
 * Increment the undo group in the database to create a new group for undo history.
 *
 * This will always return 1 + the max group number in the undo history table.
 *
 * @param db The database connection
 * @returns the new undo group number
 */
export async function incrementUndoGroup(db: OpenMarchDatabase) {
    return await incrementGroup(db, "undo");
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
export async function performUndo(db: OpenMarchDatabase) {
    return await executeHistoryAction(db, "undo");
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
export async function performRedo(db: OpenMarchDatabase) {
    return await executeHistoryAction(db, "redo");
}

/**
 * Drops the triggers for a table if they exist. I.e. disables undo tracking for the given table.
 *
 * @param db database connection
 * @param tableName name of the table to drop triggers for
 */
export async function dropUndoTriggers(
    db: OpenMarchDatabase,
    tableName: string,
) {
    await db.run(
        sql`DROP TRIGGER IF EXISTS ${sql.identifier(tableName + "_it")}`,
    );
    await db.run(
        sql`DROP TRIGGER IF EXISTS ${sql.identifier(tableName + "_ut")}`,
    );
    await db.run(
        sql`DROP TRIGGER IF EXISTS ${sql.identifier(tableName + "_dt")}`,
    );
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
async function incrementGroup(db: OpenMarchDatabase, type: HistoryType) {
    const historyTableName =
        type === "undo"
            ? Constants.UndoHistoryTableName
            : Constants.RedoHistoryTableName;

    // Get the max group number from the respective history table
    const maxGroupResult = await db.run(
        sql.raw(
            `SELECT COALESCE(MAX(history_group), 0) as current_group FROM ${historyTableName}`,
        ),
    );
    const maxGroup = Number(maxGroupResult.rows[0]?.current_group ?? 0);

    const groupString = type === "undo" ? "cur_undo_group" : "cur_redo_group";
    const newGroup = maxGroup + 1;

    await db.run(
        sql.raw(
            `UPDATE ${Constants.HistoryStatsTableName} SET ${groupString} = ${newGroup}`,
        ),
    );

    const statsResult = await db.run(
        sql.raw(
            `SELECT group_limit FROM ${Constants.HistoryStatsTableName} WHERE id = 1`,
        ),
    );
    const groupLimit = Number(statsResult.rows[0]?.group_limit ?? -1);

    // If the group limit is positive and is reached, delete the oldest group
    if (groupLimit > 0) {
        const groupsResult = await db.run(
            sql.raw(
                `SELECT DISTINCT history_group FROM ${historyTableName} ORDER BY history_group`,
            ),
        );
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
                await db.run(
                    sql.raw(
                        `DELETE FROM ${historyTableName} WHERE history_group = ${group}`,
                    ),
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
async function refreshCurrentGroups(db: OpenMarchDatabase) {
    const refreshCurrentGroup = async (type: HistoryType) => {
        const tableName =
            type === "undo"
                ? Constants.UndoHistoryTableName
                : Constants.RedoHistoryTableName;
        const groupColumn =
            type === "undo" ? "cur_undo_group" : "cur_redo_group";
        const currentGroupResult = await db.run(
            sql.raw(
                `SELECT max("history_group") as max_group FROM ${tableName};`,
            ),
        ); // default to 0 if there are no rows in the history table
        const currentGroup = Number(currentGroupResult.rows[0]?.max_group ?? 0);

        await db.run(
            sql.raw(
                `UPDATE ${Constants.HistoryStatsTableName} SET "${groupColumn}"=${
                    currentGroup + 1
                };`,
            ),
        );
    };

    await refreshCurrentGroup("undo");
    await refreshCurrentGroup("redo");
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
async function createTriggers(
    db: OpenMarchDatabase,
    tableName: string,
    type: HistoryType,
    deleteRedoRows: boolean = true,
) {
    const columns: string[] = (
        await db.run(
            sql.raw(`SELECT name FROM pragma_table_info('${tableName}');`),
        )
    ).rows
        .filter((row) => row.name !== null)
        .map((row) => row.name!.toString());

    const historyTableName =
        type === "undo"
            ? Constants.UndoHistoryTableName
            : Constants.RedoHistoryTableName;
    const groupColumn = type === "undo" ? "cur_undo_group" : "cur_redo_group";
    const historyStats = await db.query.historyStats.findFirst({});
    const currentGroup =
        type === "undo"
            ? (historyStats?.curUndoGroup ?? 0)
            : (historyStats?.curRedoGroup ?? 0);
    if (currentGroup === undefined) {
        throw new Error(
            "Could not get current group number from history stats table",
        );
    }

    // When the triggers are in undo mode, we need to delete all of the items from the redo table once an item is entered in the redo table
    const sideEffect =
        type === "undo" && deleteRedoRows
            ? `DELETE FROM ${Constants.RedoHistoryTableName};
            UPDATE ${Constants.HistoryStatsTableName} SET "cur_redo_group" = 0;`
            : "";

    // Drop the triggers if they already exist
    dropUndoTriggers(db, tableName);

    // INSERT trigger
    // db.run(
    //     sql.raw(`CREATE TRIGGER IF NOT EXISTS "${tableName}_it" AFTER INSERT ON "${tableName}" BEGIN
    //     INSERT INTO ${historyTableName} ("sequence" , "history_group", "sql")
    //         VALUES(NULL, (SELECT ${groupColumn} FROM history_stats), 'DELETE FROM "${tableName}" WHERE rowid='||new.rowid);
    //     ${sideEffect}
    // END;`),

    // );
    const insertTrigger =
        sql.raw(`CREATE TRIGGER IF NOT EXISTS "${tableName}_it" AFTER INSERT ON "${tableName}" BEGIN
        INSERT INTO ${historyTableName} ("history_group", "sql")
            VALUES((SELECT ${groupColumn} FROM history_stats), 'DELETE FROM "${tableName}" WHERE rowid='||new.rowid);
        ${sideEffect}
    END;`);
    await db.run(insertTrigger);

    // UPDATE trigger
    const updateTrigger =
        sql.raw(`CREATE TRIGGER IF NOT EXISTS "${tableName}_ut" AFTER UPDATE ON "${tableName}" BEGIN
        INSERT INTO ${historyTableName} ("history_group", "sql")
            VALUES((SELECT ${groupColumn} FROM history_stats), 'UPDATE "${tableName}" SET ${columns
                .map((c) => `"${c}"='||quote(old."${c}")||'`)
                .join(",")} WHERE rowid='||old.rowid);
        ${sideEffect}
    END;`);
    await db.run(updateTrigger);

    // DELETE trigger
    const deleteTrigger =
        sql.raw(`CREATE TRIGGER IF NOT EXISTS "${tableName}_dt" BEFORE DELETE ON "${tableName}" BEGIN
          INSERT INTO ${historyTableName} ("history_group", "sql")
            VALUES((SELECT ${groupColumn} FROM history_stats), 'INSERT INTO "${tableName}" (${columns
                .map((column) => `"${column}"`)
                .join(",")}) VALUES (${columns
                .map((c) => `'||quote(old."${c}")||'`)
                .join(",")})');
          ${sideEffect}
      END;`);
    await db.run(deleteTrigger);
}

/**
 * Switch the triggers to either undo or redo mode.
 * This is so when performing an undo action, the redo history is updated and vice versa.
 *
 * @param db The database connection
 * @param mode The mode to switch to, either "undo" or "redo"
 * @param deleteRedoRows true if the redo rows should be deleted when inserting new undo rows.
 */
async function switchTriggerMode(
    db: OpenMarchDatabase,
    mode: HistoryType,
    deleteRedoRows: boolean,
    tableNames?: Set<string>,
) {
    // Get all triggers in the database
    const triggerResult = (await db.run(
        sql.raw(
            `SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger'`,
        ),
    )) as unknown as { rows: Array<{ name: string; tbl_name: string }> };
    const triggers = triggerResult.rows;

    // Drop all triggers that match the pattern
    for (const trigger of triggers) {
        if (
            !tableNames ||
            (tableNames.has(trigger.tbl_name) &&
                trigger.name.match(/_(it|ut|dt)$/))
        ) {
            await db.run(
                sql`DROP TRIGGER IF EXISTS ${sql.identifier(trigger.name)}`,
            );
        }
    }

    // Recreate triggers for all tables
    if (tableNames) {
        for (const tableName of tableNames) {
            await createTriggers(db, tableName, mode, deleteRedoRows);
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
async function executeHistoryAction(
    db: OpenMarchDatabase,
    type: HistoryType,
): Promise<HistoryResponse> {
    console.log(`\n============ PERFORMING ${type.toUpperCase()} ============`);
    let response: HistoryResponse = {
        success: false,
        tableNames: new Set(),
        sqlStatements: [],
        error: { message: "No error to show", stack: "No stack to show" },
    };
    try {
        const tableName =
            type === "undo"
                ? Constants.UndoHistoryTableName
                : Constants.RedoHistoryTableName;
        let currentGroup = (
            (await db.run(
                sql.raw(
                    `SELECT max("history_group") as max_group FROM ${tableName};`,
                ),
            )) as unknown as { rows: Array<{ max_group: number }> }
        ).rows[0]?.max_group;

        // Get all of the SQL statements in the current undo group
        const sqlStatements: string[] =
            type === "undo"
                ? (
                      await db.query.historyUndo.findMany({
                          where: eq(historyUndo.historyGroup, currentGroup),
                          orderBy: [desc(historyUndo.sequence)],
                      })
                  ).map((row) => row.sql)
                : (
                      await db.query.historyRedo.findMany({
                          where: eq(historyRedo.historyGroup, currentGroup),
                          orderBy: [desc(historyRedo.sequence)],
                      })
                  ).map((row) => row.sql);

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
            await incrementGroup(db, "redo");
            await switchTriggerMode(db, "redo", false, tableNames);
        } else {
            // Switch the triggers so that the redo table does not have its rows deleted
            await switchTriggerMode(db, "undo", false, tableNames);
        }

        // Temporarily disable foreign key checks
        await db.run(sql`PRAGMA foreign_keys = OFF`);

        /// Execute all of the SQL statements in the current history group
        for (const sqlStatement of sqlStatements) {
            await db.run(sql`${sql.raw(sqlStatement)}`);
            const match = sqlStatement.match(
                /^(?:INSERT INTO|UPDATE|DELETE FROM) "([^"]+)"/,
            );
            if (match) {
                response.tableNames.add(match[1]);
            }
        }

        // Re-enable foreign key checks
        await db.run(sql`PRAGMA foreign_keys = ON`);

        // Delete all of the SQL statements in the current undo group
        await db
            .delete(historyUndo)
            .where(eq(historyUndo.historyGroup, currentGroup));

        // Refresh the current group number in the history stats table
        await refreshCurrentGroups(db);

        // Switch the triggers back to undo mode and delete the redo rows when inputting new undo rows
        await switchTriggerMode(db, "undo", true, tableNames);
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
export async function clearMostRecentRedo(db: OpenMarchDatabase) {
    console.log(`-------- Clearing most recent redo --------`);
    const maxGroup = (
        (await db.run(
            sql`SELECT MAX(history_group) as max_redo_group FROM ${sql.identifier(Constants.RedoHistoryTableName)}`,
        )) as unknown as { rows: Array<{ max_redo_group: number }> }
    ).rows[0]?.max_redo_group;
    await db.run(
        sql`DELETE FROM ${sql.identifier(Constants.RedoHistoryTableName)} WHERE history_group = ${maxGroup}`,
    );
    console.log(`-------- Done clearing most recent redo --------`);
}

/**
 * @param db database connection
 * @returns The current undo group number in the history stats table
 */
export async function getCurrentUndoGroup(
    db: OpenMarchDatabase,
): Promise<number> {
    const response = await db.query.historyStats.findFirst({
        columns: {
            curUndoGroup: true,
        },
    });
    if (response === undefined) {
        throw new Error("Failed to get current undo group");
    }
    return response.curUndoGroup;
}

/**
 * @param db database connection
 * @returns The current redo group number in the history stats table
 */
export async function getCurrentRedoGroup(
    db: OpenMarchDatabase,
): Promise<number> {
    const response = await db.query.historyStats.findFirst({
        columns: {
            curRedoGroup: true,
        },
    });
    if (response === undefined) {
        throw new Error("Failed to get current redo group");
    }
    return response.curRedoGroup;
}

/**
 * Decrement all of the undo actions in the most recent group down by one.
 *
 * This should be used when a database action should not create its own group, but the group number
 * was incremented to allow for rolling back changes due to error.
 *
 * @param db database connection
 */
export async function decrementLastUndoGroup(db: OpenMarchDatabase) {
    const currentGroup = await getCurrentUndoGroup(db);

    if (currentGroup !== undefined && currentGroup > 0) {
        await db.update(historyStats).set({
            curUndoGroup: currentGroup - 1,
        });
        await db
            .delete(historyUndo)
            .where(eq(historyUndo.historyGroup, currentGroup));
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
export async function flattenUndoGroupsAbove(
    db: OpenMarchDatabase,
    group: number,
) {
    console.log(`-------- Flattening undo groups above ${group} --------`);
    await db
        .update(historyUndo)
        .set({ historyGroup: group })
        .where(gt(historyUndo.historyGroup, group));
    await db.update(historyStats).set({ curUndoGroup: group });
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
export async function calculateHistorySize(db: OpenMarchDatabase) {
    const getSqlLength = async (tableName: string): Promise<number> => {
        const result = (await db.run(
            sql`SELECT SUM(LENGTH(sql)) as total FROM ${sql.identifier(tableName)}`,
        )) as unknown as { rows: Array<{ total: number }> };
        return Number(result.rows[0]?.total ?? 0);
    };

    const [undoSize, redoSize] = await Promise.all([
        getSqlLength(Constants.UndoHistoryTableName),
        getSqlLength(Constants.RedoHistoryTableName),
    ]);

    return undoSize + redoSize;
}
