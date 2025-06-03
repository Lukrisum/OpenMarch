import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Constants from "@/global/Constants";
import { sql } from "drizzle-orm";
import { createTemporaryDatabase, OpenMarchDatabase } from "@/drizzle/utils";
import {
    createUndoTriggers,
    performUndo,
    incrementUndoGroup,
    performRedo,
    flattenUndoGroupsAbove,
    getCurrentUndoGroup,
    calculateHistorySize,
} from "../database.history";
import { Client } from "@libsql/client";

type HistoryRow = {
    sequence: number;
    history_group: number;
    sql: string;
};

type Row = {
    name: string;
};

describe("History Tables and Triggers", async () => {
    let db: OpenMarchDatabase;
    let dbClient: Client;

    beforeEach(async () => {
        const { db: db_, dbClient: dbClient_ } =
            await createTemporaryDatabase();
        db = db_;
        dbClient = dbClient_;
    });

    describe("basic tests", async () => {
        it("should create the history tables", async () => {
            // Check if the undo, redo, and history stats tables were created
            const tables = (await db.run(
                sql.raw(`SELECT name FROM sqlite_master;`),
            )) as unknown as { rows: Array<{ name: string }> };

            const tableNames = tables.rows.map((row) => row.name);
            expect(tableNames).toContain(Constants.UndoHistoryTableName);
            expect(tableNames).toContain(Constants.RedoHistoryTableName);
            expect(tableNames).toContain(Constants.HistoryStatsTableName);
        });

        it("should create the triggers for a given table", async () => {
            // Create a test table to attach triggers to
            await db.run(
                sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
            );

            // Create the undo triggers for the test table
            await createUndoTriggers(db, "test_table");

            // Check if the triggers were created
            const triggers = (await db.run(
                sql`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name = 'test_table'`,
            )) as unknown as { rows: Row[] };

            expect(triggers.rows.length).toBe(3); // Should have 3 triggers: insert, update, delete
            const triggerSuffixes = ["_it", "_ut", "_dt"];
            for (const suffix of triggerSuffixes) {
                expect(
                    triggers.rows.some((row) => row.name.endsWith(suffix)),
                ).toBe(true);
            }
        });

        describe("undo history", async () => {
            const allUndoRowsByGroup = async () =>
                (
                    await db.run(
                        sql`SELECT * FROM ${Constants.UndoHistoryTableName} GROUP BY "history_group"`,
                    )
                ).rows as unknown as HistoryRow[];
            const allUndoRows = async () =>
                await db.query.historyUndo.findMany();

            describe("empty undo", async () => {
                it("should do nothing if there are no changes to undo", async () => {
                    // Create history tables and test table
                    await db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    const undoRows = async () =>
                        (await db.run(sql`SELECT * FROM history_undo`)).rows;
                    expect(await undoRows()).toEqual([]); // There should be no rows in the undo history

                    // Execute the undo action
                    await performUndo(db);
                    expect(await undoRows()).toEqual([]); // There should still be no rows in the undo history
                });
                it("should do nothing if it runs out of changes to undo", async () => {
                    // Create history tables and test table
                    await dbClient.execute(
                        `CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    expect(await allUndoRows()).toEqual([]);

                    // Insert a value into the test table
                    await dbClient.execute({
                        sql: `INSERT INTO test_table (value) VALUES (?)`,
                        args: ["test value"],
                    });
                    // incrementUndoGroup(db);
                    expect((await allUndoRows()).length).toBe(1);

                    // Execute the undo action
                    await performUndo(db);
                    expect(await allUndoRows()).toEqual([]);

                    // Execute the undo action again with no changes to undo
                    await performUndo(db);
                    expect(await allUndoRows()).toEqual([]);
                });
            });

            describe("INSERT trigger", async () => {
                it("should execute an undo correctly from an insert action", async () => {
                    // Create history tables and test table
                    await db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`test value`})`,
                    );

                    // Simulate an action that will be logged in the undo history
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`another value`})`,
                    );

                    // Execute the undo action
                    await performUndo(db);

                    // Verify that the last insert was undone
                    const row = await db.run(
                        sql`SELECT * FROM test_table WHERE value = ${`another value`}`,
                    );
                    expect(row.rows[0]).toBeUndefined(); // The undo should have deleted the last inserted value

                    // Expect there to be no undo actions left
                    expect((await allUndoRows()).length).toBe(0);
                });

                it("should undo groups of inserts correctly", async () => {
                    type Row = { id: number; value: string };
                    // Create history tables and test table
                    await db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table in three groups
                    // group 1
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-0 - test value`})`,
                    );
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-1 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    const groupOneObjects = (
                        await db.run(
                            sql`SELECT * FROM test_table WHERE value LIKE ${`g1%`}`,
                        )
                    ).rows as Row[];
                    // group 2
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g2-0 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    const groupTwoObjects = (
                        await db.run(
                            sql`SELECT * FROM test_table WHERE value LIKE ${`g2%`}`,
                        )
                    ).rows as Row[];
                    // group 3
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-0 - test value`})`,
                    );
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-1 - test value`})`,
                    );
                    await db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-2 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    const groupThreeObjects = (
                        await db.run(
                            sql`SELECT * FROM test_table WHERE value LIKE ${`g3%`}`,
                        )
                    ).rows as Row[];

                    // expect all the objects to be in the table
                    const allObjects = async () =>
                        (await db.run(sql`SELECT * FROM test_table`))
                            .rows as Row[];
                    expect(await allObjects()).toEqual([
                        ...groupOneObjects,
                        ...groupTwoObjects,
                        ...groupThreeObjects,
                    ]);

                    // Execute the undo action
                    let response = performUndo(db);
                    expect(response.success).toBe(true);
                    expect(response.sqlStatements).toEqual([
                        'DELETE FROM "test_table" WHERE rowid=6',
                        'DELETE FROM "test_table" WHERE rowid=5',
                        'DELETE FROM "test_table" WHERE rowid=4',
                    ]);
                    expect(response.tableNames).toEqual(
                        new Set(["test_table"]),
                    );
                    expect(response.error).toBeUndefined();

                    expect(await allObjects()).toEqual([
                        ...groupOneObjects,
                        ...groupTwoObjects,
                    ]);
                    await performUndo(db);
                    expect(await allObjects()).toEqual([...groupOneObjects]);
                    await performUndo(db);
                    expect(await allObjects()).toEqual([]);

                    // Expect there to be no undo actions left
                    expect((await allUndoRows()).length).toBe(0);
                });
            });

            describe("UPDATE trigger", async () => {
                it("should execute an undo correctly from an update action", async () => {
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    const currentValue = () =>
                        (
                            db
                                .prepare(
                                    "SELECT test_value FROM test_table WHERE id = 1;",
                                )
                                .get() as {
                                test_value: string;
                            }
                        ).test_value;

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("test value");
                    expect(currentValue()).toBe("test value");
                    incrementUndoGroup(db);

                    // Update the value in the test table
                    db.prepare(
                        "UPDATE test_table SET test_value = ? WHERE id = 1;",
                    ).run("updated value");
                    expect(currentValue()).toBe("updated value"); // The value should be updated
                    incrementUndoGroup(db);

                    // Simulate an action that will be logged in the undo history
                    db.prepare(
                        "UPDATE test_table SET test_value = ? WHERE id = 1;",
                    ).run("another updated value");
                    expect(currentValue()).toBe("another updated value"); // The value should be updated
                    incrementUndoGroup(db);

                    // Execute the undo action
                    await performUndo(db);
                    // Verify that the last update was undone
                    expect(currentValue()).toBe("updated value"); // The undo should have reverted the last update

                    // Execute the undo action again
                    await performUndo(db);
                    // Verify that the first update was undone
                    expect(currentValue()).toBe("test value"); // The undo should have reverted the first update

                    // Expect there to be one undo actions left
                    expect(allUndoRows().length).toBe(1);
                });

                it("should undo groups of updates correctly", async () => {
                    type Row = { id: number; test_value: string };
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    // group 1
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-0 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-1 - initial value");
                    // group 2
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g2-0 - initial value");
                    // group 3
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-0 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-1 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-2 - initial value");
                    incrementUndoGroup(db);

                    // Update the value in the test table in two groups
                    const updateSql =
                        "UPDATE test_table SET test_value = (?) WHERE test_value = (?);";
                    // group 1
                    db.prepare(updateSql).run(
                        "g1-0 - updated value",
                        "g1-0 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g1-1 - updated value",
                        "g1-1 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 2
                    db.prepare(updateSql).run(
                        "g2-0 - updated value",
                        "g2-0 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 3
                    db.prepare(updateSql).run(
                        "g3-0 - updated value",
                        "g3-0 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g3-1 - updated value",
                        "g3-1 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g3-2 - updated value",
                        "g3-2 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 1 (again)
                    db.prepare(updateSql).run(
                        "g1-0 - second updated value",
                        "g1-0 - updated value",
                    );
                    db.prepare(updateSql).run(
                        "g1-1 - second updated value",
                        "g1-1 - updated value",
                    );

                    const allRows = () =>
                        db
                            .prepare("SELECT * FROM test_table ORDER BY id")
                            .all() as Row[];
                    let expectedValues: Row[] = [
                        { id: 1, test_value: "g1-0 - second updated value" },
                        { id: 2, test_value: "g1-1 - second updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - updated value" },
                        { id: 5, test_value: "g3-1 - updated value" },
                        { id: 6, test_value: "g3-2 - updated value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute the undo action
                    let response = performUndo(db);
                    expect(response.success).toBe(true);
                    expect(response.sqlStatements).toEqual([
                        'UPDATE "test_table" SET "id"=2,"test_value"=\'g1-1 - updated value\' WHERE rowid=2',
                        'UPDATE "test_table" SET "id"=1,"test_value"=\'g1-0 - updated value\' WHERE rowid=1',
                    ]);
                    expect(response.tableNames).toEqual(
                        new Set(["test_table"]),
                    );
                    expect(response.error).toBeUndefined();

                    expectedValues = [
                        { id: 1, test_value: "g1-0 - updated value" },
                        { id: 2, test_value: "g1-1 - updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - updated value" },
                        { id: 5, test_value: "g3-1 - updated value" },
                        { id: 6, test_value: "g3-2 - updated value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute the undo action again
                    await performUndo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - updated value" },
                        { id: 2, test_value: "g1-1 - updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - initial value" },
                        { id: 5, test_value: "g3-1 - initial value" },
                        { id: 6, test_value: "g3-2 - initial value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute the undo action again
                    await performUndo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - updated value" },
                        { id: 2, test_value: "g1-1 - updated value" },
                        { id: 3, test_value: "g2-0 - initial value" },
                        { id: 4, test_value: "g3-0 - initial value" },
                        { id: 5, test_value: "g3-1 - initial value" },
                        { id: 6, test_value: "g3-2 - initial value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute the undo action again
                    await performUndo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - initial value" },
                        { id: 2, test_value: "g1-1 - initial value" },
                        { id: 3, test_value: "g2-0 - initial value" },
                        { id: 4, test_value: "g3-0 - initial value" },
                        { id: 5, test_value: "g3-1 - initial value" },
                        { id: 6, test_value: "g3-2 - initial value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Expect there to be one undo actions left
                    expect(allUndoRowsByGroup().length).toBe(1);
                });
            });

            describe("DELETE trigger", async () => {
                it("should execute an undo correctly from a delete action", async () => {
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    const currentValue = () => {
                        try {
                            return (
                                db
                                    .prepare(
                                        "SELECT test_value FROM test_table WHERE id = 1;",
                                    )
                                    .get() as {
                                    test_value: string;
                                }
                            ).test_value;
                        } catch (e) {
                            return undefined;
                        }
                    };

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("test value");
                    expect(currentValue()).toBe("test value");
                    incrementUndoGroup(db);

                    // Simulate an action that will be logged in the undo history
                    db.prepare("DELETE FROM test_table WHERE id = 1;").run();
                    expect(currentValue()).toBeUndefined(); // The value should be deleted
                    incrementUndoGroup(db);

                    // Execute the undo action
                    await performUndo(db);
                    // Verify that the last delete was undone
                    expect(currentValue()).toBe("test value"); // The undo should have restored the last deleted value

                    // Expect there to be one undo actions left
                    expect(allUndoRows().length).toBe(1);
                });

                it("should undo groups of deletes correctly", async () => {
                    type Row = { id: number; test_value: string };
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    // group 1
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-0");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-1");
                    // group 2
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g2-0");
                    // group 3
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-0");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-1");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-2");
                    incrementUndoGroup(db);

                    // Delete operations in groups
                    // group 1
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g1-0");
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g1-1");
                    incrementUndoGroup(db);
                    // group 2
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g2-0");
                    incrementUndoGroup(db);
                    // group 3
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g3-0");
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g3-1");
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g3-2");
                    incrementUndoGroup(db);

                    const allRows = () =>
                        db
                            .prepare("SELECT * FROM test_table ORDER BY id")
                            .all() as Row[];
                    expect(allRows()).toEqual([]);

                    // Execute three undo actions
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);
                    let expectedValues = [
                        { id: 1, test_value: "g1-0" },
                        { id: 2, test_value: "g1-1" },
                        { id: 3, test_value: "g2-0" },
                        { id: 4, test_value: "g3-0" },
                        { id: 5, test_value: "g3-1" },
                        { id: 6, test_value: "g3-2" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute three redo actions
                    performRedo(db);
                    expectedValues = [
                        { id: 3, test_value: "g2-0" },
                        { id: 4, test_value: "g3-0" },
                        { id: 5, test_value: "g3-1" },
                        { id: 6, test_value: "g3-2" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expectedValues = [
                        { id: 4, test_value: "g3-0" },
                        { id: 5, test_value: "g3-1" },
                        { id: 6, test_value: "g3-2" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expect(allRows()).toEqual([]);

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });
            });
        });

        describe("redo history", async () => {
            const allRedoRowsByGroup = () =>
                db
                    .prepare(
                        `SELECT * FROM ${Constants.RedoHistoryTableName} GROUP BY "history_group";`,
                    )
                    .all() as HistoryRow[];
            const allRedoRows = () =>
                db
                    .prepare(`SELECT * FROM ${Constants.RedoHistoryTableName};`)
                    .all() as HistoryRow[];

            describe("empty redo", async () => {
                it("should do nothing if there are no changes to redo", async () => {
                    // Create history tables and test table
                    db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    expect(allRedoRows()).toEqual([]); // There should be no rows in the redo history

                    // Execute the redo action
                    performRedo(db);
                    expect(allRedoRows()).toEqual([]); // There should still be no rows in the redo history
                });
                it("should do nothing if it runs out of changes to redo", async () => {
                    // Create history tables and test table
                    db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    expect(allRedoRows()).toEqual([]);

                    // Insert a value into the test table
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`test value`})`,
                    );
                    // Execute an undo action to add a change to the redo history
                    await performUndo(db);
                    expect(allRedoRows().length).toBe(1);

                    // Execute the redo action
                    performRedo(db);
                    expect(allRedoRows()).toEqual([]);

                    // Execute the redo action again with no changes to redo
                    performRedo(db);
                    expect(allRedoRows()).toEqual([]);
                });
            });

            describe("INSERT trigger", async () => {
                it("should execute a redo correctly from undoing an insert action", async () => {
                    type Row = { id: number; value: string };
                    // Create history tables and test table
                    db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`test value`})`,
                    );
                    incrementUndoGroup(db);

                    // Simulate an action that will be logged in the undo history
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`another value`})`,
                    );

                    const allRows = () =>
                        db.prepare("SELECT * FROM test_table").all() as Row[];
                    const completeRows = [
                        { id: 1, value: "test value" },
                        { id: 2, value: "another value" },
                    ];
                    expect(allRows()).toEqual(completeRows);

                    // Execute the undo action
                    await performUndo(db);
                    expect(allRows()).toEqual([completeRows[0]]);

                    // Execute the redo action
                    performRedo(db);
                    expect(allRows()).toEqual(completeRows);

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });

                it("should undo groups of inserts correctly", async () => {
                    type Row = { id: number; value: string };
                    // Create history tables and test table
                    db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table in three groups
                    // group 1
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-0 - test value`})`,
                    );
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-1 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    const groupOneObjects = db
                        .prepare("SELECT * FROM test_table WHERE value LIKE ?")
                        .all("g1%") as Row[];
                    // group 2
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g2-0 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    const groupTwoObjects = db
                        .prepare("SELECT * FROM test_table WHERE value LIKE ?")
                        .all("g2%") as Row[];
                    // group 3
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-0 - test value`})`,
                    );
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-1 - test value`})`,
                    );
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-2 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    const groupThreeObjects = db
                        .prepare("SELECT * FROM test_table WHERE value LIKE ?")
                        .all("g3%") as Row[];

                    // expect all the objects to be in the table
                    const allObjects = () =>
                        db.prepare("SELECT * FROM test_table").all() as Row[];
                    expect(allObjects()).toEqual([
                        ...groupOneObjects,
                        ...groupTwoObjects,
                        ...groupThreeObjects,
                    ]);

                    // Execute the undo action
                    await performUndo(db);
                    expect(allObjects()).toEqual([
                        ...groupOneObjects,
                        ...groupTwoObjects,
                    ]);
                    await performUndo(db);
                    expect(allObjects()).toEqual([...groupOneObjects]);
                    await performUndo(db);
                    expect(allObjects()).toEqual([]);

                    // Execute the redo action
                    performRedo(db);
                    expect(allObjects()).toEqual([...groupOneObjects]);
                    performRedo(db);
                    expect(allObjects()).toEqual([
                        ...groupOneObjects,
                        ...groupTwoObjects,
                    ]);
                    performRedo(db);
                    expect(allObjects()).toEqual([
                        ...groupOneObjects,
                        ...groupTwoObjects,
                        ...groupThreeObjects,
                    ]);

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });

                it("should have no redo operations after inserting a new undo entry after INSERT", async () => {
                    db.run(
                        sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)`,
                    );

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table in three groups
                    // group 1
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-0 - test value`})`,
                    );
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-1 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    // group 2
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g2-0 - test value`})`,
                    );
                    incrementUndoGroup(db);
                    // group 3
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-0 - test value`})`,
                    );
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-1 - test value`})`,
                    );
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g3-2 - test value`})`,
                    );
                    incrementUndoGroup(db);

                    // Execute the undo action
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);

                    expect(allRedoRowsByGroup().length).toBe(3);

                    // Do another action to clear the redo stack
                    db.run(
                        sql`INSERT INTO test_table (value) VALUES (${`g1-0 - another value`})`,
                    );

                    expect(allRedoRowsByGroup().length).toBe(0);
                });
            });

            describe("UPDATE trigger", async () => {
                it("should execute an undo correctly from an update action", async () => {
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    const currentValue = () =>
                        (
                            db
                                .prepare(
                                    "SELECT test_value FROM test_table WHERE id = 1;",
                                )
                                .get() as {
                                test_value: string;
                            }
                        ).test_value;

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("test value");
                    incrementUndoGroup(db);

                    // Update the values in the test table
                    db.prepare(
                        "UPDATE test_table SET test_value = ? WHERE id = 1;",
                    ).run("updated value");
                    incrementUndoGroup(db);
                    db.prepare(
                        "UPDATE test_table SET test_value = ? WHERE id = 1;",
                    ).run("another updated value");
                    incrementUndoGroup(db);

                    // Execute two undo actions
                    await performUndo(db);
                    await performUndo(db);
                    expect(currentValue()).toBe("test value");

                    performRedo(db);
                    expect(currentValue()).toBe("updated value");

                    performRedo(db);
                    expect(currentValue()).toBe("another updated value");

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });

                it("should undo groups of updates correctly", async () => {
                    type Row = { id: number; test_value: string };
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    // group 1
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-0 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-1 - initial value");
                    // group 2
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g2-0 - initial value");
                    // group 3
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-0 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-1 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-2 - initial value");
                    incrementUndoGroup(db);

                    // Update the value in the test table in two groups
                    const updateSql =
                        "UPDATE test_table SET test_value = (?) WHERE test_value = (?);";
                    // group 1
                    db.prepare(updateSql).run(
                        "g1-0 - updated value",
                        "g1-0 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g1-1 - updated value",
                        "g1-1 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 2
                    db.prepare(updateSql).run(
                        "g2-0 - updated value",
                        "g2-0 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 3
                    db.prepare(updateSql).run(
                        "g3-0 - updated value",
                        "g3-0 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g3-1 - updated value",
                        "g3-1 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g3-2 - updated value",
                        "g3-2 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 1 (again)
                    db.prepare(updateSql).run(
                        "g1-0 - second updated value",
                        "g1-0 - updated value",
                    );
                    db.prepare(updateSql).run(
                        "g1-1 - second updated value",
                        "g1-1 - updated value",
                    );

                    const allRows = () =>
                        db
                            .prepare("SELECT * FROM test_table ORDER BY id")
                            .all() as Row[];
                    let expectedValues: Row[] = [
                        { id: 1, test_value: "g1-0 - second updated value" },
                        { id: 2, test_value: "g1-1 - second updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - updated value" },
                        { id: 5, test_value: "g3-1 - updated value" },
                        { id: 6, test_value: "g3-2 - updated value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute four undo actions
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);

                    // Execute a redo action
                    performRedo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - updated value" },
                        { id: 2, test_value: "g1-1 - updated value" },
                        { id: 3, test_value: "g2-0 - initial value" },
                        { id: 4, test_value: "g3-0 - initial value" },
                        { id: 5, test_value: "g3-1 - initial value" },
                        { id: 6, test_value: "g3-2 - initial value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - updated value" },
                        { id: 2, test_value: "g1-1 - updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - initial value" },
                        { id: 5, test_value: "g3-1 - initial value" },
                        { id: 6, test_value: "g3-2 - initial value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - updated value" },
                        { id: 2, test_value: "g1-1 - updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - updated value" },
                        { id: 5, test_value: "g3-1 - updated value" },
                        { id: 6, test_value: "g3-2 - updated value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expectedValues = [
                        { id: 1, test_value: "g1-0 - second updated value" },
                        { id: 2, test_value: "g1-1 - second updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - updated value" },
                        { id: 5, test_value: "g3-1 - updated value" },
                        { id: 6, test_value: "g3-2 - updated value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });

                it("should have no redo operations after inserting a new undo entry after UPDATE", async () => {
                    type Row = { id: number; test_value: string };
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    // group 1
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-0 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-1 - initial value");
                    // group 2
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g2-0 - initial value");
                    // group 3
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-0 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-1 - initial value");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-2 - initial value");
                    incrementUndoGroup(db);

                    // Update the value in the test table in two groups
                    const updateSql =
                        "UPDATE test_table SET test_value = (?) WHERE test_value = (?);";
                    // group 1
                    db.prepare(updateSql).run(
                        "g1-0 - updated value",
                        "g1-0 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g1-1 - updated value",
                        "g1-1 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 2
                    db.prepare(updateSql).run(
                        "g2-0 - updated value",
                        "g2-0 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 3
                    db.prepare(updateSql).run(
                        "g3-0 - updated value",
                        "g3-0 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g3-1 - updated value",
                        "g3-1 - initial value",
                    );
                    db.prepare(updateSql).run(
                        "g3-2 - updated value",
                        "g3-2 - initial value",
                    );
                    incrementUndoGroup(db);
                    // group 1 (again)
                    db.prepare(updateSql).run(
                        "g1-0 - second updated value",
                        "g1-0 - updated value",
                    );
                    db.prepare(updateSql).run(
                        "g1-1 - second updated value",
                        "g1-1 - updated value",
                    );

                    const allRows = () =>
                        db
                            .prepare("SELECT * FROM test_table ORDER BY id")
                            .all() as Row[];
                    let expectedValues: Row[] = [
                        { id: 1, test_value: "g1-0 - second updated value" },
                        { id: 2, test_value: "g1-1 - second updated value" },
                        { id: 3, test_value: "g2-0 - updated value" },
                        { id: 4, test_value: "g3-0 - updated value" },
                        { id: 5, test_value: "g3-1 - updated value" },
                        { id: 6, test_value: "g3-2 - updated value" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute four undo actions
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);

                    expect(allRedoRowsByGroup().length).toBe(4);

                    // Do another action to clear the redo stack
                    db.prepare(
                        "UPDATE test_table SET test_value = (?) WHERE id = 1;",
                    ).run("updated value!");
                    expect(allRedoRowsByGroup().length).toBe(0);
                });
            });

            describe("DELETE trigger", async () => {
                it("should execute an undo correctly from a delete action", async () => {
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    const currentValue = () => {
                        try {
                            return (
                                db
                                    .prepare(
                                        "SELECT test_value FROM test_table WHERE id = 1;",
                                    )
                                    .get() as {
                                    test_value: string;
                                }
                            ).test_value;
                        } catch (e) {
                            return undefined;
                        }
                    };

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("test value");
                    incrementUndoGroup(db);

                    // Simulate an action that will be logged in the undo history
                    db.prepare("DELETE FROM test_table WHERE id = 1;").run();
                    incrementUndoGroup(db);

                    // Execute the undo action
                    await performUndo(db);
                    expect(currentValue()).toBeDefined();

                    // Execute the redo action
                    performRedo(db);
                    expect(currentValue()).toBeUndefined();

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });

                it("should undo groups of deletes correctly", async () => {
                    type Row = { id: number; test_value: string };
                    // Create history tables and test table
                    db.prepare(
                        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
                    ).run();

                    // Create undo triggers for the test table
                    await createUndoTriggers(db, "test_table");

                    // Insert a value into the test table
                    // group 1
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-0");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g1-1");
                    // group 2
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g2-0");
                    // group 3
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-0");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-1");
                    db.prepare(
                        "INSERT INTO test_table (test_value) VALUES (?);",
                    ).run("g3-2");
                    incrementUndoGroup(db);

                    // Delete operations in groups
                    // group 1
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g1-0");
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g1-1");
                    incrementUndoGroup(db);
                    // group 2
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g2-0");
                    incrementUndoGroup(db);
                    // group 3
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g3-0");
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g3-1");
                    db.prepare(
                        "DELETE FROM test_table WHERE test_value = (?);",
                    ).run("g3-2");
                    incrementUndoGroup(db);

                    const allRows = () =>
                        db
                            .prepare("SELECT * FROM test_table ORDER BY id")
                            .all() as Row[];
                    expect(allRows()).toEqual([]);

                    // Execute three undo actions
                    await performUndo(db);
                    await performUndo(db);
                    await performUndo(db);
                    let expectedValues = [
                        { id: 1, test_value: "g1-0" },
                        { id: 2, test_value: "g1-1" },
                        { id: 3, test_value: "g2-0" },
                        { id: 4, test_value: "g3-0" },
                        { id: 5, test_value: "g3-1" },
                        { id: 6, test_value: "g3-2" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    // Execute three redo actions
                    performRedo(db);
                    expectedValues = [
                        { id: 3, test_value: "g2-0" },
                        { id: 4, test_value: "g3-0" },
                        { id: 5, test_value: "g3-1" },
                        { id: 6, test_value: "g3-2" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expectedValues = [
                        { id: 4, test_value: "g3-0" },
                        { id: 5, test_value: "g3-1" },
                        { id: 6, test_value: "g3-2" },
                    ];
                    expect(allRows()).toEqual(expectedValues);

                    performRedo(db);
                    expect(allRows()).toEqual([]);

                    // Expect there to be no redos left
                    expect(allRedoRows().length).toBe(0);
                });
            });
        });
    });

    describe("Advanced Undo/Redo Stress Tests", async () => {
        async function setupComplexTables() {
            db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                age INTEGER,
                email TEXT UNIQUE
            );
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                product TEXT,
                quantity INTEGER,
                total_price REAL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                amount REAL,
                payment_date TEXT,
                FOREIGN KEY(order_id) REFERENCES orders(id)
            );
        `);

            await createUndoTriggers(db, "users");
            await createUndoTriggers(db, "orders");
            await createUndoTriggers(db, "payments");
        }

        it("Complex data with foreign keys and multiple undo/redo intervals", async () => {
            setupComplexTables();

            // Insert user data
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("John Doe", 30, "john@example.com");
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Jane Doe", 25, "jane@example.com");
            incrementUndoGroup(db);

            // Insert orders linked to users
            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(1, "Laptop", 1, 1000.0);
            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(2, "Phone", 2, 500.0);
            incrementUndoGroup(db);

            // Insert payments linked to orders
            db.prepare(
                "INSERT INTO payments (order_id, amount, payment_date) VALUES (?, ?, ?)",
            ).run(1, 1000.0, "2024-10-08");
            db.prepare(
                "INSERT INTO payments (order_id, amount, payment_date) VALUES (?, ?, ?)",
            ).run(2, 500.0, "2024-10-09");
            incrementUndoGroup(db);

            // Perform undo in random intervals
            await performUndo(db); // Undo payments
            let payments = db.prepare("SELECT * FROM payments").all();
            expect(payments.length).toBe(0);

            await performUndo(db); // Undo orders
            let orders = db.prepare("SELECT * FROM orders").all();
            expect(orders.length).toBe(0);

            // Redo orders and payments
            performRedo(db);
            orders = db.prepare("SELECT * FROM orders").all();
            expect(orders.length).toBe(2);

            performRedo(db);
            payments = db.prepare("SELECT * FROM payments").all();
            expect(payments.length).toBe(2);

            // Undo back to the users table
            await performUndo(db);
            await performUndo(db);
            await performUndo(db);
            let users = db.prepare("SELECT * FROM users").all();
            expect(users.length).toBe(0);
        });

        it("Undo/Redo with random intervals, updates, and WHERE clauses", async () => {
            setupComplexTables();

            // Insert initial users
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Alice", 28, "alice@example.com");
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Bob", 35, "bob@example.com");
            incrementUndoGroup(db);

            // Insert orders with complex WHERE clauses
            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(1, "Tablet", 2, 600.0);
            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(2, "Monitor", 1, 300.0);
            incrementUndoGroup(db);

            // Perform an update with WHERE
            db.prepare("UPDATE users SET age = age + 1 WHERE name = ?").run(
                "Alice",
            );
            incrementUndoGroup(db);

            // Undo the age update and verify the value
            await performUndo(db);
            let result = db
                .prepare("SELECT age FROM users WHERE name = ?")
                .get("Alice") as { age: number };
            expect(result.age).toBe(28);

            // Undo order insertion and check if the table is empty
            await performUndo(db);
            let orders = db.prepare("SELECT * FROM orders").all();
            expect(orders.length).toBe(0);

            // Redo the order insertion and update
            performRedo(db);
            performRedo(db);
            orders = db.prepare("SELECT * FROM orders").all();
            expect(orders.length).toBe(2);
        });

        it("Randomized undo/redo with interleaved data changes", async () => {
            setupComplexTables();

            // Insert several users and orders interleaved with undo/redo
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Chris", 40, "chris@example.com");
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Diana", 22, "diana@example.com");
            incrementUndoGroup(db);

            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(1, "Desk", 1, 150.0);
            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(2, "Chair", 2, 200.0);
            incrementUndoGroup(db);

            // Perform undo of orders, then insert more data
            let expectedOrders = db.prepare("SELECT * FROM orders").all();
            await performUndo(db);
            let currentOrders = db.prepare("SELECT * FROM orders").all();
            expect(currentOrders.length).toBe(0);
            performRedo(db);
            currentOrders = db.prepare("SELECT * FROM orders").all();
            expect(currentOrders).toEqual(expectedOrders);
            await performUndo(db);

            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Eve", 32, "eve@example.com");
            incrementUndoGroup(db);

            // Perform redo of orders and undo user insertion
            performRedo(db);
            await performUndo(db);

            let users = db.prepare("SELECT * FROM users").all();
            expect(users.length).toBe(2); // Should contain only 'Chris' and 'Diana'

            currentOrders = db.prepare("SELECT * FROM orders").all();
            expect(currentOrders.length).toBe(0); // Orders should be restored
        });

        it("Complex updates and deletes with random undo/redo intervals", async () => {
            setupComplexTables();

            // Insert users and orders
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Frank", 33, "frank@example.com");
            db.prepare(
                "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
            ).run("Grace", 29, "grace@example.com");
            incrementUndoGroup(db);

            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(1, "Headphones", 1, 100.0);
            db.prepare(
                "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
            ).run(2, "Keyboard", 1, 120.0);
            incrementUndoGroup(db);

            // Update and delete data
            db.prepare("UPDATE users SET email = ? WHERE name = ?").run(
                "frank_updated@example.com",
                "Frank",
            );
            db.prepare("DELETE FROM orders WHERE id = 2");
            incrementUndoGroup(db);

            // Undo deletion and updates
            await performUndo(db);
            await performUndo(db);

            let user = db
                .prepare("SELECT * FROM users WHERE name = ?")
                .get("Frank") as any;
            expect(user.email).toBe("frank@example.com"); // Should be the original email

            performRedo(db);
            let orders = db.prepare("SELECT * FROM orders").all();
            expect(orders.length).toBe(2); // Order should be restored
        });
    });

    describe("Limit Tests", async () => {
        const groupLimit = () =>
            (
                db
                    .prepare(
                        `SELECT group_limit FROM ${Constants.HistoryStatsTableName}`,
                    )
                    .get() as HistoryStatsRow | undefined
            )?.group_limit;

        const undoGroups = () =>
            (
                db
                    .prepare(
                        `SELECT * FROM ${Constants.UndoHistoryTableName} GROUP BY "history_group" ORDER BY "history_group" ASC`,
                    )
                    .all() as HistoryTableRow[]
            ).map((row) => row.history_group);
        it("removes the oldest undo group when the undo limit of 100 is reached", async () => {
            db.run(
                sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT)`,
            );
            await createUndoTriggers(db, "users");

            // set the limit to 100
            db.run(
                sql`UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 100`,
            );
            expect(groupLimit()).toBe(100);

            for (let i = 0; i < 99; i++) {
                // Insert users and orders
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${100 / i}`}, ${i}, ${`email${100 - i}@jeff.com`})`,
                );
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Josie_${100 / i}`}, ${i + 50}, ${`email${200 - i}@josie.com`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(99);
            let expectedGroups = Array.from(Array(99).keys()).map((i) => i);
            expect(undoGroups()).toEqual(expectedGroups);

            // Insert one more group
            db.run(
                sql`INSERT INTO users (name, age, email) VALUES (${`Harry_100`}, ${100}, ${`email@jeff100.com`})`,
            );
            incrementUndoGroup(db);
            expect(undoGroups().length).toBe(100);
            expectedGroups = [...expectedGroups, 99];
            expect(undoGroups()).toEqual(expectedGroups);

            // Insert another group
            db.run(
                sql`INSERT INTO users (name, age, email) VALUES (${`Harry_101`}, ${101}, ${`email@jeff101.com`})`,
            );
            incrementUndoGroup(db);
            expect(undoGroups().length).toBe(100);
            expectedGroups = Array.from(Array(100).keys()).map((i) => i + 1);
            expect(undoGroups()).toEqual(expectedGroups);

            // insert 50 more groups
            for (let i = 102; i < 152; i++) {
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${i}`}, ${i}, ${`email${100 - i}@jeff.com`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(100);
            expectedGroups = Array.from(Array(100).keys()).map((i) => i + 51);
            expect(undoGroups()).toEqual(expectedGroups);

            const allRows = db.run(sql`SELECT * FROM users`);
            expect(allRows.length).toBeGreaterThan(150);
        });

        it("removes the oldest undo group when the undo limit of 2000 is reached", async () => {
            db.run(
                sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT)`,
            );
            await createUndoTriggers(db, "users");

            // set the limit to 2000
            db.run(
                sql`UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 2000`,
            );
            expect(groupLimit()).toBe(2000);

            for (let i = 0; i < 1999; i++) {
                // Insert users and orders
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${2000 / i}`}, ${i}, ${`email${2000 - i}@jeff.com`})`,
                );
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Josie_${2000 / i}`}, ${i + 50}, ${`email${200 - i}@josie.com`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(1999);
            let expectedGroups = Array.from(Array(1999).keys()).map((i) => i);
            expect(undoGroups()).toEqual(expectedGroups);

            // Insert one more group
            db.run(
                sql`INSERT INTO users (name, age, email) VALUES (${`Harry_2000`}, ${2000}, ${`email@jeff2000.com`})`,
            );
            incrementUndoGroup(db);
            expect(undoGroups().length).toBe(2000);
            expectedGroups = [...expectedGroups, 1999];
            expect(undoGroups()).toEqual(expectedGroups);

            // Insert another group
            db.run(
                sql`INSERT INTO users (name, age, email) VALUES (${`Harry_101`}, ${101}, ${`email@jeff101.com`})`,
            );
            incrementUndoGroup(db);
            expect(undoGroups().length).toBe(2000);
            expectedGroups = Array.from(Array(2000).keys()).map((i) => i + 1);
            expect(undoGroups()).toEqual(expectedGroups);

            // insert 50 more groups
            for (let i = 102; i < 152; i++) {
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${i}`}, ${i}, ${`email${2000 - i}@jeff.com`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(2000);
            expectedGroups = Array.from(Array(2000).keys()).map((i) => i + 51);
            expect(undoGroups()).toEqual(expectedGroups);

            const allRows = db.run(sql`SELECT * FROM users`);
            expect(allRows.length).toBeGreaterThan(150);
        });

        it("adds more undo groups when the limit is increased", async () => {
            db.run(
                sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT)`,
            );
            await createUndoTriggers(db, "users");

            // set the limit to 100
            db.run(
                sql`UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 100`,
            );
            expect(groupLimit()).toBe(100);

            for (let i = 0; i < 150; i++) {
                // Insert users and orders
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${100 / i}`}, ${i}, ${`email${100 - i}`})`,
                );
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Josie_${100 / i}`}, ${i + 50}, ${`email${200 - i}`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(100);
            let expectedGroups = Array.from(Array(100).keys()).map(
                (i) => i + 50,
            );
            expect(undoGroups()).toEqual(expectedGroups);

            // set the limit to 200
            db.run(
                sql`UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 200`,
            );
            expect(groupLimit()).toBe(200);
            expect(undoGroups().length).toBe(100);

            for (let i = 150; i < 300; i++) {
                // Insert users and orders
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${100 / i}`}, ${i}, ${`email${100 - i}`})`,
                );
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Josie_${100 / i}`}, ${i + 50}, ${`email${200 - i}`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(200);
            expectedGroups = [
                ...Array.from(Array(50).keys()).map((i) => i + 100),
                ...Array.from(Array(150).keys()).map((i) => i + 150),
            ];
            expect(undoGroups()).toEqual(expectedGroups);
        });

        it("removes groups when the limit is decreased", async () => {
            db.run(
                sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT)`,
            );
            await createUndoTriggers(db, "users");

            // set the limit to 200
            db.run(
                sql`UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 200`,
            );
            expect(groupLimit()).toBe(200);

            for (let i = 0; i < 250; i++) {
                // Insert users and orders
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Harry_${100 / i}`}, ${i}, ${`email${100 - i}`})`,
                );
                db.run(
                    sql`INSERT INTO users (name, age, email) VALUES (${`Josie_${100 / i}`}, ${i + 50}, ${`email${200 - i}`})`,
                );
                incrementUndoGroup(db);
            }
            expect(undoGroups().length).toBe(200);
            let expectedGroups = Array.from(Array(200).keys()).map(
                (i) => i + 50,
            );
            expect(undoGroups()).toEqual(expectedGroups);

            // set the limit to 100
            db.run(
                sql`UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 50`,
            );
            expect(groupLimit()).toBe(50);
            // Should not change until next group increment
            expect(undoGroups().length).toBe(200);

            db.run(
                sql`INSERT INTO users (name, age, email) VALUES (${`Harry_last`}, ${1234}, ${`email_last`})`,
            );
            incrementUndoGroup(db);
            expect(undoGroups().length).toBe(50);
            expectedGroups = Array.from(Array(50).keys()).map((i) => i + 201);
            expect(undoGroups()).toEqual(expectedGroups);
        });
    });

    describe("Advanced Undo/Redo Stress Tests with Reserved Words, Special Characters, and DELETE Operations", async () => {
        async function setupComplexTablesWithReservedWords() {
            await db.run(
                sql.raw(`
            CREATE TABLE reserved_words_test (
                "order" INTEGER PRIMARY KEY AUTOINCREMENT,
                "group" TEXT,
                "select" TEXT,
                "from" TEXT
            );
            CREATE TABLE special_characters_test (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT
            );
        `),
            );

            await createUndoTriggers(db, "reserved_words_test");
            await createUndoTriggers(db, "special_characters_test");
        }

        it("Undo/Redo with reserved words, special characters, and DELETE operations", async () => {
            await setupComplexTablesWithReservedWords();

            // Insert into reserved_words_test
            await db.run(
                sql.raw(
                    'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
                ),
            );
            await db.run(
                sql.raw(
                    'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
                ),
            );
            await incrementUndoGroup(db);

            // Insert into special_characters_test
            await db.run(
                sql.raw(
                    "INSERT INTO special_characters_test (description) VALUES ('\"Double quote\", 'Single quote', (Parentheses), [Brackets]')",
                ),
            );
            await db.run(
                sql.raw(
                    "INSERT INTO special_characters_test (description) VALUES ('Escape \\ backslash')",
                ),
            );
            await incrementUndoGroup(db);

            // Perform DELETE operations
            await db.run(
                sql.raw('DELETE FROM reserved_words_test WHERE "order" = 2'),
            );
            await db.run(
                sql.raw("DELETE FROM special_characters_test WHERE id = 2"),
            );
            await incrementUndoGroup(db);

            // Undo DELETE operations
            await performUndo(db); // Undo the DELETE from special_characters_test
            let specialResult = await db.run(
                sql.raw("SELECT * FROM special_characters_test"),
            );
            expect(specialResult.rows.length).toBe(2); // Both rows should be back

            await performUndo(db); // Undo the DELETE from reserved_words_test
            let reservedResult = await db.run(
                sql.raw("SELECT * FROM reserved_words_test"),
            );
            expect(reservedResult.rows.length).toBe(2); // Both rows should be back

            // Redo DELETE operations
            await performUndo(db);
            await performRedo(db); // Redo the DELETE from reserved_words_test
            reservedResult = await db.run(
                sql.raw("SELECT * FROM reserved_words_test"),
            );
            expect(reservedResult.rows.length).toBe(2); // One row should be deleted
        });

        it("Undo/Redo with random intervals, updates, deletes, and WHERE clauses", async () => {
            await setupComplexTablesWithReservedWords();

            // Insert into both tables
            db.prepare(
                'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
            ).run("Group1", "Select1", "From1");
            db.prepare(
                "INSERT INTO special_characters_test (description) VALUES (?)",
            ).run(
                '"Complex value (with) {all} kinds [of] special characters!"',
            );
            incrementUndoGroup(db);

            // Perform updates and DELETEs
            db.prepare(
                'UPDATE reserved_words_test SET "group" = ? WHERE "order" = 1',
            ).run("UpdatedGroup");
            db.prepare(
                "DELETE FROM special_characters_test WHERE id = 1",
            ).run();
            incrementUndoGroup(db);

            // Perform undo/redo in random order
            let response = performUndo(db); // Undo DELETE and update
            expect(response.success).toBe(true);
            expect(response.error).toBeUndefined();
            expect(response.tableNames).toEqual(
                new Set(["reserved_words_test", "special_characters_test"]),
            );
            let reservedResult = db
                .prepare(
                    'SELECT "group" FROM reserved_words_test WHERE "order" = 1',
                )
                .get() as any;
            let specialResult = db
                .prepare(
                    "SELECT description FROM special_characters_test WHERE id = 1",
                )
                .get() as any;
            expect(reservedResult.group).toBe("Group1");
            expect(specialResult.description).toBe(
                '"Complex value (with) {all} kinds [of] special characters!"',
            );

            performRedo(db); // Redo DELETE and update
            reservedResult = db
                .prepare(
                    'SELECT "group" FROM reserved_words_test WHERE "order" = 1',
                )
                .get();
            specialResult = db
                .prepare("SELECT * FROM special_characters_test")
                .all();
            expect(reservedResult.group).toBe("UpdatedGroup");
            expect(specialResult.length).toBe(0); // The row should be deleted
        });

        it("Stress test with multiple DELETEs, special characters, and reserved words", async () => {
            setupComplexTablesWithReservedWords();

            // Insert several rows into both tables
            db.prepare(
                'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
            ).run("GroupA", "SelectA", "FromA");
            db.prepare(
                'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
            ).run("GroupB", "SelectB", "FromB");
            db.prepare(
                "INSERT INTO special_characters_test (description) VALUES (?)",
            ).run('Some "special" (value)');
            db.prepare(
                "INSERT INTO special_characters_test (description) VALUES (?)",
            ).run('Another "complex" [test] (entry)');
            incrementUndoGroup(db);

            // Perform random DELETEs
            db.prepare(
                'DELETE FROM reserved_words_test WHERE "order" = 1',
            ).run();
            db.prepare(
                "DELETE FROM special_characters_test WHERE id = 2",
            ).run();
            incrementUndoGroup(db);

            // Undo all DELETEs
            await performUndo(db);

            let reservedResult = db
                .prepare("SELECT * FROM reserved_words_test")
                .all();
            let specialResult = db
                .prepare("SELECT * FROM special_characters_test")
                .all();
            expect(reservedResult.length).toBe(2); // Both rows should be restored
            expect(specialResult.length).toBe(2); // Both rows should be restored

            // Redo all DELETEs
            performRedo(db);
            performRedo(db);

            reservedResult = db
                .prepare("SELECT * FROM reserved_words_test")
                .all();
            specialResult = db
                .prepare("SELECT * FROM special_characters_test")
                .all();
            expect(reservedResult.length).toBe(1); // One row should be deleted
            expect(specialResult.length).toBe(1); // One row should be deleted
        });
    });

    describe("flattenUndoGroupsAbove", async () => {
        let db: Database.Database;
        const testDbPath = ":memory:";

        // Mock console.log to avoid cluttering test output
        beforeEach(() => {
            vi.spyOn(console, "log").mockImplementation(() => {});

            // Create a new in-memory database for each test
            db = new Database(testDbPath);
            createHistoryTables(db);
        });

        afterEach(() => {
            vi.restoreAllMocks();
            db.close();
        });

        it("should flatten all undo groups above the specified group", async () => {
            // Setup: Create multiple undo groups
            const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

            // Insert records with different group numbers
            db.prepare(insertSql).run(1, 1, "SQL 1");
            db.prepare(insertSql).run(2, 2, "SQL 2");
            db.prepare(insertSql).run(3, 3, "SQL 3");
            db.prepare(insertSql).run(4, 4, "SQL 4");
            db.prepare(insertSql).run(5, 5, "SQL 5");

            // Execute the function to flatten groups above 2
            flattenUndoGroupsAbove(db, 2);

            // Verify: All groups above 2 should now be 2
            const result = db
                .prepare(
                    `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
                )
                .all() as { history_group: number }[];

            expect(result).toHaveLength(5);
            expect(result[0].history_group).toBe(1); // Group 1 should remain unchanged
            expect(result[1].history_group).toBe(2); // Group 2 should remain unchanged
            expect(result[2].history_group).toBe(2); // Group 3 should be flattened to 2
            expect(result[3].history_group).toBe(2); // Group 4 should be flattened to 2
            expect(result[4].history_group).toBe(2); // Group 5 should be flattened to 2
        });

        it("should do nothing when there are no groups above the specified group", async () => {
            // Setup: Create undo groups all below or equal to the target
            const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

            db.prepare(insertSql).run(1, 1, "SQL 1");
            db.prepare(insertSql).run(2, 2, "SQL 2");
            db.prepare(insertSql).run(3, 3, "SQL 3");

            // Execute the function to flatten groups above 3
            flattenUndoGroupsAbove(db, 3);

            // Verify: No groups should change
            const result = db
                .prepare(
                    `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
                )
                .all() as { history_group: number }[];

            expect(result).toHaveLength(3);
            expect(result[0].history_group).toBe(1);
            expect(result[1].history_group).toBe(2);
            expect(result[2].history_group).toBe(3);
        });

        it("should work with an empty undo history table", async () => {
            // Execute the function on an empty table
            flattenUndoGroupsAbove(db, 5);

            // Verify: No errors should occur
            const result = db
                .prepare(
                    `SELECT COUNT(*) as count FROM ${Constants.UndoHistoryTableName}`,
                )
                .get() as { count: number };
            expect(result.count).toBe(0);
        });

        it("should handle negative group numbers correctly", async () => {
            // Setup: Create undo groups with negative numbers
            const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

            db.prepare(insertSql).run(1, -3, "SQL 1");
            db.prepare(insertSql).run(2, -2, "SQL 2");
            db.prepare(insertSql).run(3, -1, "SQL 3");
            db.prepare(insertSql).run(4, 0, "SQL 4");
            db.prepare(insertSql).run(5, 1, "SQL 5");

            // Execute the function to flatten groups above -2
            flattenUndoGroupsAbove(db, -2);

            // Verify: All groups above -2 should now be -2
            const result = db
                .prepare(
                    `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
                )
                .all() as { history_group: number }[];

            expect(result).toHaveLength(5);
            expect(result[0].history_group).toBe(-3); // Group -3 should remain unchanged
            expect(result[1].history_group).toBe(-2); // Group -2 should remain unchanged
            expect(result[2].history_group).toBe(-2); // Group -1 should be flattened to -2
            expect(result[3].history_group).toBe(-2); // Group 0 should be flattened to -2
            expect(result[4].history_group).toBe(-2); // Group 1 should be flattened to -2
        });

        it("should work with incrementUndoGroup to flatten newly created groups", async () => {
            // Setup: Create initial undo group
            incrementUndoGroup(db); // Group 1

            // Insert a record in group 1
            const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;
            db.prepare(insertSql).run(1, 1, "SQL 1");

            // Create more undo groups
            incrementUndoGroup(db); // Group 2
            db.prepare(insertSql).run(2, 2, "SQL 2");

            incrementUndoGroup(db); // Group 3
            db.prepare(insertSql).run(3, 3, "SQL 3");

            // Flatten groups above 1
            flattenUndoGroupsAbove(db, 1);

            // Verify: All groups above 1 should now be 1
            const result = db
                .prepare(
                    `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
                )
                .all() as { history_group: number }[];

            expect(result).toHaveLength(3);
            expect(result[0].history_group).toBe(1);
            expect(result[1].history_group).toBe(1); // Group 2 should be flattened to 1
            expect(result[2].history_group).toBe(1); // Group 3 should be flattened to 1

            // Verify the current undo group in stats table is unchanged
            const currentGroup = getCurrentUndoGroup(db);
            expect(currentGroup).toBe(3); // The current group in stats should still be 3
        });

        it("should log appropriate messages when flattening groups", async () => {
            // Setup
            const consoleSpy = vi.spyOn(console, "log");

            // Execute the function
            flattenUndoGroupsAbove(db, 5);

            // Verify console.log was called with the expected messages
            expect(consoleSpy).toHaveBeenCalledWith(
                "-------- Flattening undo groups above 5 --------",
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                "-------- Done flattening undo groups above 5 --------",
            );
        });

        it("should handle large group numbers and many records efficiently", async () => {
            // Setup: Create many undo groups with large group numbers
            const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

            // Insert 100 records with increasing group numbers
            for (let i = 1; i <= 100; i++) {
                db.prepare(insertSql).run(i, i * 100, `SQL ${i}`);
            }

            // Execute the function to flatten groups above 3000
            flattenUndoGroupsAbove(db, 3000);

            // Verify: All groups above 3000 should now be 3000
            const result = db
                .prepare(
                    `
      SELECT
        CASE
          WHEN history_group <= 3000 THEN 'below_or_equal'
          ELSE 'above'
        END as group_category,
        COUNT(*) as count
      FROM ${Constants.UndoHistoryTableName}
      GROUP BY group_category
    `,
                )
                .all() as { group_category: string; count: number }[];

            const belowOrEqual = result.find(
                (r) => r.group_category === "below_or_equal",
            );
            const above = result.find((r) => r.group_category === "above");

            expect(belowOrEqual?.count || 0).toBe(100);
            expect(above).toBeUndefined(); // No groups should be above 3000
        });
    });

    describe("calculateHistorySize", async () => {
        let db: Database.Database;

        beforeEach(() => {
            // Create an in-memory SQLite database for each test
            db = new Database(":memory:");
            // Create the history tables
            createHistoryTables(db);

            // Try to create dbstat virtual table, but don't fail if it's not supported
            try {
                db.prepare(
                    "CREATE VIRTUAL TABLE IF NOT EXISTS dbstat USING dbstat",
                ).run();
            } catch (e) {
                console.log(
                    "dbstat not available, tests will use fallback methods",
                );
            }
        });

        afterEach(() => {
            // Close the database connection after each test
            db.close();
        });

        it("should return 0 for empty history tables", async () => {
            const size = calculateHistorySize(db);
            expect(size).toBe(0);
        });

        it("should calculate size after adding history entries", async () => {
            // Create a test table to generate history entries
            db.prepare(
                "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
            ).run();
            await createUndoTriggers(db, "test_table");

            // Get initial size
            const initialSize = calculateHistorySize(db);

            // Add some data to generate history entries
            incrementUndoGroup(db);
            db.prepare("INSERT INTO test_table (value) VALUES ('test1')").run();
            db.prepare("INSERT INTO test_table (value) VALUES ('test2')").run();
            db.prepare(
                "UPDATE test_table SET value = 'updated' WHERE id = 1",
            ).run();

            // Get size after adding data
            const sizeAfterAdding = calculateHistorySize(db);

            // Size should have increased
            expect(sizeAfterAdding).toBeGreaterThan(initialSize);
        });

        it("should handle large amounts of history data", async () => {
            // Create a test table to generate history entries
            db.prepare(
                "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
            ).run();
            await createUndoTriggers(db, "test_table");

            // Get initial size
            const initialSize = calculateHistorySize(db);

            // Add a significant amount of data
            for (let i = 0; i < 10; i++) {
                incrementUndoGroup(db);
                for (let j = 0; j < 10; j++) {
                    db.prepare("INSERT INTO test_table (value) VALUES (?)").run(
                        `test-${i}-${j}`,
                    );
                }
            }

            // Get size after adding data
            const sizeAfterAdding = calculateHistorySize(db);

            // Size should have increased significantly
            expect(sizeAfterAdding).toBeGreaterThan(initialSize);
            console.log(
                `History size increased from ${initialSize} to ${sizeAfterAdding} bytes`,
            );
        });

        it("should return consistent results when called multiple times", async () => {
            // Create a test table and add some history
            db.prepare(
                "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
            ).run();
            await createUndoTriggers(db, "test_table");
            incrementUndoGroup(db);
            db.prepare("INSERT INTO test_table (value) VALUES ('test')").run();

            // Calculate size multiple times
            const size1 = calculateHistorySize(db);
            const size2 = calculateHistorySize(db);
            const size3 = calculateHistorySize(db);

            // All calculations should return the same value
            expect(size1).toBe(size2);
            expect(size2).toBe(size3);
        });
    });
});
