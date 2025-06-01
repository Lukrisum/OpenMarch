import { describe, it, expect, beforeEach } from "vitest";
import Constants from "@/global/Constants";
import { LibSQLDatabase, drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { createClient } from "@libsql/client-wasm";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as HistorySchema from "../history.schema";

describe("History Tables and Triggers", () => {
    let db: LibSQLDatabase<typeof HistorySchema>;
    // type HistoryRow = { sequence: number; group: number; sql: string };

    beforeEach(async () => {
        const client = createClient({
            url: "file::memory:",
        });
        db = drizzle(client, { schema: HistorySchema });
        await migrate(db, { migrationsFolder: "./migrations" });
    });

    describe("basic tests", () => {
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

        //     it("should create the triggers for a given table", () => {
        //         // Create a test table to attach triggers to
        //         db.run(
        //             "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //         );

        //         // Create the undo triggers for the test table
        //         createUndoTriggers(db, "test_table");

        //         // Check if the triggers were created
        //         const triggers = db
        //             .run(
        //                 `SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name = 'test_table';`,
        //             )
        //             .all();

        //         expect(triggers.length).toBe(3); // Should have 3 triggers: insert, update, delete
        //     });

        //     describe("undo history", () => {
        //         const allUndoRowsByGroup = () =>
        //             db
        //                 .run(
        //                     `SELECT * FROM ${Constants.UndoHistoryTableName} GROUP BY "history_group";`,
        //                 )
        //                 .all() as HistoryRow[];
        //         const allUndoRows = () =>
        //             db
        //                 .run(`SELECT * FROM ${Constants.UndoHistoryTableName};`)
        //                 .all() as HistoryRow[];

        //         describe("empty undo", () => {
        //             it("should do nothing if there are no changes to undo", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 const undoRows = () =>
        //                     db.run("SELECT * FROM history_undo;").all();
        //                 expect(undoRows()).toEqual([]); // There should be no rows in the undo history

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 expect(undoRows()).toEqual([]); // There should still be no rows in the undo history
        //             });
        //             it("should do nothing if it runs out of changes to undo", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 const undoRows = () =>
        //                     db.run("SELECT * FROM history_undo;").all();
        //                 expect(undoRows()).toEqual([]);

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("test value");
        //                 incrementUndoGroup(db);
        //                 expect(undoRows().length).toBe(1);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 expect(undoRows()).toEqual([]);

        //                 // Execute the undo action again with no changes to undo
        //                 performUndo(db);
        //                 expect(undoRows()).toEqual([]);
        //             });
        //         });

        //         describe("INSERT trigger", () => {
        //             it("should execute an undo correctly from an insert action", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("test value");

        //                 // Simulate an action that will be logged in the undo history
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("another value");

        //                 // Execute the undo action
        //                 performUndo(db);

        //                 // Verify that the last insert was undone
        //                 const row = db
        //                     .run("SELECT * FROM test_table WHERE value = ?")
        //                     .get("another value");
        //                 expect(row).toBeUndefined(); // The undo should have deleted the last inserted value

        //                 // Expect there to be no undo actions left
        //                 expect(allUndoRows().length).toBe(0);
        //             });

        //             it("should undo groups of inserts correctly", () => {
        //                 type Row = { id: number; value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table in three groups
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-0 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-1 - test value");
        //                 incrementUndoGroup(db);
        //                 const groupOneObjects = db
        //                     .run("SELECT * FROM test_table WHERE value LIKE ?")
        //                     .all("g1%") as Row[];
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g2-0 - test value");
        //                 incrementUndoGroup(db);
        //                 const groupTwoObjects = db
        //                     .run("SELECT * FROM test_table WHERE value LIKE ?")
        //                     .all("g2%") as Row[];
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-0 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-1 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-2 - test value");
        //                 incrementUndoGroup(db);
        //                 const groupThreeObjects = db
        //                     .run("SELECT * FROM test_table WHERE value LIKE ?")
        //                     .all("g3%") as Row[];

        //                 // expect all the objects to be in the table
        //                 const allObjects = () =>
        //                     db.run("SELECT * FROM test_table").all() as Row[];
        //                 expect(allObjects()).toEqual([
        //                     ...groupOneObjects,
        //                     ...groupTwoObjects,
        //                     ...groupThreeObjects,
        //                 ]);

        //                 // Execute the undo action
        //                 let response = performUndo(db);
        //                 expect(response.success).toBe(true);
        //                 expect(response.sqlStatements).toEqual([
        //                     'DELETE FROM "test_table" WHERE rowid=6',
        //                     'DELETE FROM "test_table" WHERE rowid=5',
        //                     'DELETE FROM "test_table" WHERE rowid=4',
        //                 ]);
        //                 expect(response.tableNames).toEqual(
        //                     new Set(["test_table"]),
        //                 );
        //                 expect(response.error).toBeUndefined();

        //                 expect(allObjects()).toEqual([
        //                     ...groupOneObjects,
        //                     ...groupTwoObjects,
        //                 ]);
        //                 performUndo(db);
        //                 expect(allObjects()).toEqual([...groupOneObjects]);
        //                 performUndo(db);
        //                 expect(allObjects()).toEqual([]);

        //                 // Expect there to be no undo actions left
        //                 expect(allUndoRows().length).toBe(0);
        //             });
        //         });

        //         describe("UPDATE trigger", () => {
        //             it("should execute an undo correctly from an update action", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 const currentValue = () =>
        //                     (
        //                         db
        //                             .run(
        //                                 "SELECT test_value FROM test_table WHERE id = 1;",
        //                             )
        //                             .get() as {
        //                             test_value: string;
        //                         }
        //                     ).test_value;

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("test value");
        //                 expect(currentValue()).toBe("test value");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table
        //                 db.run(
        //                     "UPDATE test_table SET test_value = ? WHERE id = 1;",
        //                 ).run("updated value");
        //                 expect(currentValue()).toBe("updated value"); // The value should be updated
        //                 incrementUndoGroup(db);

        //                 // Simulate an action that will be logged in the undo history
        //                 db.run(
        //                     "UPDATE test_table SET test_value = ? WHERE id = 1;",
        //                 ).run("another updated value");
        //                 expect(currentValue()).toBe("another updated value"); // The value should be updated
        //                 incrementUndoGroup(db);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 // Verify that the last update was undone
        //                 expect(currentValue()).toBe("updated value"); // The undo should have reverted the last update

        //                 // Execute the undo action again
        //                 performUndo(db);
        //                 // Verify that the first update was undone
        //                 expect(currentValue()).toBe("test value"); // The undo should have reverted the first update

        //                 // Expect there to be one undo actions left
        //                 expect(allUndoRows().length).toBe(1);
        //             });

        //             it("should undo groups of updates correctly", () => {
        //                 type Row = { id: number; test_value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-0 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-1 - initial value");
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g2-0 - initial value");
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-0 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-1 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-2 - initial value");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table in two groups
        //                 const updateSql =
        //                     "UPDATE test_table SET test_value = (?) WHERE test_value = (?);";
        //                 // group 1
        //                 db.run(updateSql).run(
        //                     "g1-0 - updated value",
        //                     "g1-0 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g1-1 - updated value",
        //                     "g1-1 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(updateSql).run(
        //                     "g2-0 - updated value",
        //                     "g2-0 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(updateSql).run(
        //                     "g3-0 - updated value",
        //                     "g3-0 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g3-1 - updated value",
        //                     "g3-1 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g3-2 - updated value",
        //                     "g3-2 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 1 (again)
        //                 db.run(updateSql).run(
        //                     "g1-0 - second updated value",
        //                     "g1-0 - updated value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g1-1 - second updated value",
        //                     "g1-1 - updated value",
        //                 );

        //                 const allRows = () =>
        //                     db
        //                         .run("SELECT * FROM test_table ORDER BY id")
        //                         .all() as Row[];
        //                 let expectedValues: Row[] = [
        //                     { id: 1, test_value: "g1-0 - second updated value" },
        //                     { id: 2, test_value: "g1-1 - second updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - updated value" },
        //                     { id: 5, test_value: "g3-1 - updated value" },
        //                     { id: 6, test_value: "g3-2 - updated value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute the undo action
        //                 let response = performUndo(db);
        //                 expect(response.success).toBe(true);
        //                 expect(response.sqlStatements).toEqual([
        //                     'UPDATE "test_table" SET "id"=2,"test_value"=\'g1-1 - updated value\' WHERE rowid=2',
        //                     'UPDATE "test_table" SET "id"=1,"test_value"=\'g1-0 - updated value\' WHERE rowid=1',
        //                 ]);
        //                 expect(response.tableNames).toEqual(
        //                     new Set(["test_table"]),
        //                 );
        //                 expect(response.error).toBeUndefined();

        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - updated value" },
        //                     { id: 2, test_value: "g1-1 - updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - updated value" },
        //                     { id: 5, test_value: "g3-1 - updated value" },
        //                     { id: 6, test_value: "g3-2 - updated value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute the undo action again
        //                 performUndo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - updated value" },
        //                     { id: 2, test_value: "g1-1 - updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - initial value" },
        //                     { id: 5, test_value: "g3-1 - initial value" },
        //                     { id: 6, test_value: "g3-2 - initial value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute the undo action again
        //                 performUndo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - updated value" },
        //                     { id: 2, test_value: "g1-1 - updated value" },
        //                     { id: 3, test_value: "g2-0 - initial value" },
        //                     { id: 4, test_value: "g3-0 - initial value" },
        //                     { id: 5, test_value: "g3-1 - initial value" },
        //                     { id: 6, test_value: "g3-2 - initial value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute the undo action again
        //                 performUndo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - initial value" },
        //                     { id: 2, test_value: "g1-1 - initial value" },
        //                     { id: 3, test_value: "g2-0 - initial value" },
        //                     { id: 4, test_value: "g3-0 - initial value" },
        //                     { id: 5, test_value: "g3-1 - initial value" },
        //                     { id: 6, test_value: "g3-2 - initial value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Expect there to be one undo actions left
        //                 expect(allUndoRowsByGroup().length).toBe(1);
        //             });
        //         });

        //         describe("DELETE trigger", () => {
        //             it("should execute an undo correctly from a delete action", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 const currentValue = () => {
        //                     try {
        //                         return (
        //                             db
        //                                 .run(
        //                                     "SELECT test_value FROM test_table WHERE id = 1;",
        //                                 )
        //                                 .get() as {
        //                                 test_value: string;
        //                             }
        //                         ).test_value;
        //                     } catch (e) {
        //                         return undefined;
        //                     }
        //                 };

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("test value");
        //                 expect(currentValue()).toBe("test value");
        //                 incrementUndoGroup(db);

        //                 // Simulate an action that will be logged in the undo history
        //                 db.run("DELETE FROM test_table WHERE id = 1;");
        //                 expect(currentValue()).toBeUndefined(); // The value should be deleted
        //                 incrementUndoGroup(db);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 // Verify that the last delete was undone
        //                 expect(currentValue()).toBe("test value"); // The undo should have restored the last deleted value

        //                 // Expect there to be one undo actions left
        //                 expect(allUndoRows().length).toBe(1);
        //             });

        //             it("should undo groups of deletes correctly", () => {
        //                 type Row = { id: number; test_value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-0");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-1");
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g2-0");
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-0");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-1");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-2");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table in two groups
        //                 const updateSql =
        //                     "DELETE FROM test_table WHERE test_value = (?);";
        //                 // group 1
        //                 db.run(updateSql).run("g1-0");
        //                 db.run(updateSql).run("g1-1");
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(updateSql).run("g2-0");
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(updateSql).run("g3-0");
        //                 db.run(updateSql).run("g3-1");
        //                 db.run(updateSql).run("g3-2");
        //                 incrementUndoGroup(db);

        //                 const allRows = () =>
        //                     db
        //                         .run("SELECT * FROM test_table ORDER BY id")
        //                         .all() as Row[];
        //                 expect(allRows()).toEqual([]);

        //                 // Execute the undo action
        //                 let response = performUndo(db);
        //                 expect(response.success).toBe(true);
        //                 expect(response.sqlStatements).toEqual([
        //                     'INSERT INTO "test_table" ("id","test_value") VALUES (6,\'g3-2\')',
        //                     'INSERT INTO "test_table" ("id","test_value") VALUES (5,\'g3-1\')',
        //                     'INSERT INTO "test_table" ("id","test_value") VALUES (4,\'g3-0\')',
        //                 ]);
        //                 expect(response.tableNames).toEqual(
        //                     new Set(["test_table"]),
        //                 );
        //                 expect(response.error).toBeUndefined();

        //                 let expectedValues = [
        //                     { id: 4, test_value: "g3-0" },
        //                     { id: 5, test_value: "g3-1" },
        //                     { id: 6, test_value: "g3-2" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute the undo action again
        //                 performUndo(db);
        //                 expectedValues = [
        //                     { id: 3, test_value: "g2-0" },
        //                     { id: 4, test_value: "g3-0" },
        //                     { id: 5, test_value: "g3-1" },
        //                     { id: 6, test_value: "g3-2" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute the undo action again
        //                 performUndo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0" },
        //                     { id: 2, test_value: "g1-1" },
        //                     { id: 3, test_value: "g2-0" },
        //                     { id: 4, test_value: "g3-0" },
        //                     { id: 5, test_value: "g3-1" },
        //                     { id: 6, test_value: "g3-2" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Expect there to be one undo actions left
        //                 expect(allUndoRowsByGroup().length).toBe(1);
        //             });
        //         });
        //     });

        //     describe("redo history", () => {
        //         const allRedoRowsByGroup = () =>
        //             db
        //                 .run(
        //                     `SELECT * FROM ${Constants.RedoHistoryTableName} GROUP BY "history_group";`,
        //                 )
        //                 .all() as HistoryRow[];
        //         const allRedoRows = () =>
        //             db
        //                 .run(`SELECT * FROM ${Constants.RedoHistoryTableName};`)
        //                 .all() as HistoryRow[];

        //         describe("empty redo", () => {
        //             it("should do nothing if there are no changes to redo", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 expect(allRedoRows()).toEqual([]); // There should be no rows in the redo history

        //                 // Execute the redo action
        //                 performRedo(db);
        //                 expect(allRedoRows()).toEqual([]); // There should still be no rows in the redo history
        //             });
        //             it("should do nothing if it runs out of changes to redo", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 expect(allRedoRows()).toEqual([]);

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("test value");
        //                 // Execute an undo action to add a change to the redo history
        //                 performUndo(db);
        //                 expect(allRedoRows().length).toBe(1);

        //                 // Execute the redo action
        //                 performRedo(db);
        //                 expect(allRedoRows()).toEqual([]);

        //                 // Execute the redo action again with no changes to redo
        //                 performRedo(db);
        //                 expect(allRedoRows()).toEqual([]);
        //             });
        //         });

        //         describe("INSERT trigger", () => {
        //             it("should execute a redo correctly from undoing an insert action", () => {
        //                 type Row = { id: number; value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("test value");
        //                 incrementUndoGroup(db);

        //                 // Simulate an action that will be logged in the undo history
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("another value");

        //                 const allRows = () =>
        //                     db.run("SELECT * FROM test_table").all() as Row[];
        //                 const completeRows = [
        //                     { id: 1, value: "test value" },
        //                     { id: 2, value: "another value" },
        //                 ];
        //                 expect(allRows()).toEqual(completeRows);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 expect(allRows()).toEqual([completeRows[0]]);

        //                 // Execute the redo action
        //                 performRedo(db);
        //                 expect(allRows()).toEqual(completeRows);

        //                 // Expect there to be no redos left
        //                 expect(allRedoRows().length).toBe(0);
        //             });

        //             it("should undo groups of inserts correctly", () => {
        //                 type Row = { id: number; value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table in three groups
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-0 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-1 - test value");
        //                 incrementUndoGroup(db);
        //                 const groupOneObjects = db
        //                     .run("SELECT * FROM test_table WHERE value LIKE ?")
        //                     .all("g1%") as Row[];
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g2-0 - test value");
        //                 incrementUndoGroup(db);
        //                 const groupTwoObjects = db
        //                     .run("SELECT * FROM test_table WHERE value LIKE ?")
        //                     .all("g2%") as Row[];
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-0 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-1 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-2 - test value");
        //                 incrementUndoGroup(db);
        //                 const groupThreeObjects = db
        //                     .run("SELECT * FROM test_table WHERE value LIKE ?")
        //                     .all("g3%") as Row[];

        //                 // expect all the objects to be in the table
        //                 const allObjects = () =>
        //                     db.run("SELECT * FROM test_table").all() as Row[];
        //                 expect(allObjects()).toEqual([
        //                     ...groupOneObjects,
        //                     ...groupTwoObjects,
        //                     ...groupThreeObjects,
        //                 ]);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 expect(allObjects()).toEqual([
        //                     ...groupOneObjects,
        //                     ...groupTwoObjects,
        //                 ]);
        //                 performUndo(db);
        //                 expect(allObjects()).toEqual([...groupOneObjects]);
        //                 performUndo(db);
        //                 expect(allObjects()).toEqual([]);

        //                 // Execute the redo action
        //                 performRedo(db);
        //                 expect(allObjects()).toEqual([...groupOneObjects]);
        //                 performRedo(db);
        //                 expect(allObjects()).toEqual([
        //                     ...groupOneObjects,
        //                     ...groupTwoObjects,
        //                 ]);
        //                 performRedo(db);
        //                 expect(allObjects()).toEqual([
        //                     ...groupOneObjects,
        //                     ...groupTwoObjects,
        //                     ...groupThreeObjects,
        //                 ]);

        //                 // Expect there to be no redos left
        //                 expect(allRedoRows().length).toBe(0);
        //             });

        //             it("should have no redo operations after inserting a new undo entry after INSERT", () => {
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table in three groups
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-0 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-1 - test value");
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g2-0 - test value");
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-0 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-1 - test value");
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g3-2 - test value");
        //                 incrementUndoGroup(db);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 performUndo(db);
        //                 performUndo(db);

        //                 expect(allRedoRowsByGroup().length).toBe(3);

        //                 // Do another action to clear the redo stack
        //                 db.run(
        //                     "INSERT INTO test_table (value) VALUES (?);",
        //                 ).run("g1-0 - another value");

        //                 expect(allRedoRowsByGroup().length).toBe(0);
        //             });
        //         });

        //         describe("UPDATE trigger", () => {
        //             it("should execute an undo correctly from an update action", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 const currentValue = () =>
        //                     (
        //                         db
        //                             .run(
        //                                 "SELECT test_value FROM test_table WHERE id = 1;",
        //                             )
        //                             .get() as {
        //                             test_value: string;
        //                         }
        //                     ).test_value;

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("test value");
        //                 incrementUndoGroup(db);

        //                 // Update the values in the test table
        //                 db.run(
        //                     "UPDATE test_table SET test_value = ? WHERE id = 1;",
        //                 ).run("updated value");
        //                 incrementUndoGroup(db);
        //                 db.run(
        //                     "UPDATE test_table SET test_value = ? WHERE id = 1;",
        //                 ).run("another updated value");
        //                 incrementUndoGroup(db);

        //                 // Execute two undo actions
        //                 performUndo(db);
        //                 performUndo(db);
        //                 expect(currentValue()).toBe("test value");

        //                 performRedo(db);
        //                 expect(currentValue()).toBe("updated value");

        //                 performRedo(db);
        //                 expect(currentValue()).toBe("another updated value");

        //                 // Expect there to be no redos left
        //                 expect(allRedoRows().length).toBe(0);
        //             });

        //             it("should undo groups of updates correctly", () => {
        //                 type Row = { id: number; test_value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-0 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-1 - initial value");
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g2-0 - initial value");
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-0 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-1 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-2 - initial value");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table in two groups
        //                 const updateSql =
        //                     "UPDATE test_table SET test_value = (?) WHERE test_value = (?);";
        //                 // group 1
        //                 db.run(updateSql).run(
        //                     "g1-0 - updated value",
        //                     "g1-0 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g1-1 - updated value",
        //                     "g1-1 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(updateSql).run(
        //                     "g2-0 - updated value",
        //                     "g2-0 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(updateSql).run(
        //                     "g3-0 - updated value",
        //                     "g3-0 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g3-1 - updated value",
        //                     "g3-1 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g3-2 - updated value",
        //                     "g3-2 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 1 (again)
        //                 db.run(updateSql).run(
        //                     "g1-0 - second updated value",
        //                     "g1-0 - updated value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g1-1 - second updated value",
        //                     "g1-1 - updated value",
        //                 );

        //                 const allRows = () =>
        //                     db
        //                         .run("SELECT * FROM test_table ORDER BY id")
        //                         .all() as Row[];
        //                 let expectedValues: Row[] = [
        //                     { id: 1, test_value: "g1-0 - second updated value" },
        //                     { id: 2, test_value: "g1-1 - second updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - updated value" },
        //                     { id: 5, test_value: "g3-1 - updated value" },
        //                     { id: 6, test_value: "g3-2 - updated value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute four undo actions
        //                 performUndo(db);
        //                 performUndo(db);
        //                 performUndo(db);
        //                 performUndo(db);

        //                 // Execute a redo action
        //                 performRedo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - updated value" },
        //                     { id: 2, test_value: "g1-1 - updated value" },
        //                     { id: 3, test_value: "g2-0 - initial value" },
        //                     { id: 4, test_value: "g3-0 - initial value" },
        //                     { id: 5, test_value: "g3-1 - initial value" },
        //                     { id: 6, test_value: "g3-2 - initial value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 performRedo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - updated value" },
        //                     { id: 2, test_value: "g1-1 - updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - initial value" },
        //                     { id: 5, test_value: "g3-1 - initial value" },
        //                     { id: 6, test_value: "g3-2 - initial value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 performRedo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - updated value" },
        //                     { id: 2, test_value: "g1-1 - updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - updated value" },
        //                     { id: 5, test_value: "g3-1 - updated value" },
        //                     { id: 6, test_value: "g3-2 - updated value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 performRedo(db);
        //                 expectedValues = [
        //                     { id: 1, test_value: "g1-0 - second updated value" },
        //                     { id: 2, test_value: "g1-1 - second updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - updated value" },
        //                     { id: 5, test_value: "g3-1 - updated value" },
        //                     { id: 6, test_value: "g3-2 - updated value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Expect there to be no redos left
        //                 expect(allRedoRows().length).toBe(0);
        //             });

        //             it("should have no redo operations after inserting a new undo entry after UPDATE", () => {
        //                 type Row = { id: number; test_value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-0 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-1 - initial value");
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g2-0 - initial value");
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-0 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-1 - initial value");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-2 - initial value");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table in two groups
        //                 const updateSql =
        //                     "UPDATE test_table SET test_value = (?) WHERE test_value = (?);";
        //                 // group 1
        //                 db.run(updateSql).run(
        //                     "g1-0 - updated value",
        //                     "g1-0 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g1-1 - updated value",
        //                     "g1-1 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(updateSql).run(
        //                     "g2-0 - updated value",
        //                     "g2-0 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(updateSql).run(
        //                     "g3-0 - updated value",
        //                     "g3-0 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g3-1 - updated value",
        //                     "g3-1 - initial value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g3-2 - updated value",
        //                     "g3-2 - initial value",
        //                 );
        //                 incrementUndoGroup(db);
        //                 // group 1 (again)
        //                 db.run(updateSql).run(
        //                     "g1-0 - second updated value",
        //                     "g1-0 - updated value",
        //                 );
        //                 db.run(updateSql).run(
        //                     "g1-1 - second updated value",
        //                     "g1-1 - updated value",
        //                 );

        //                 const allRows = () =>
        //                     db
        //                         .run("SELECT * FROM test_table ORDER BY id")
        //                         .all() as Row[];
        //                 let expectedValues: Row[] = [
        //                     { id: 1, test_value: "g1-0 - second updated value" },
        //                     { id: 2, test_value: "g1-1 - second updated value" },
        //                     { id: 3, test_value: "g2-0 - updated value" },
        //                     { id: 4, test_value: "g3-0 - updated value" },
        //                     { id: 5, test_value: "g3-1 - updated value" },
        //                     { id: 6, test_value: "g3-2 - updated value" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute four undo actions
        //                 performUndo(db);
        //                 performUndo(db);
        //                 performUndo(db);
        //                 performUndo(db);

        //                 expect(allRedoRowsByGroup().length).toBe(4);

        //                 // Do another action to clear the redo stack
        //                 db.run(
        //                     "UPDATE test_table SET test_value = (?) WHERE id = 1;",
        //                 ).run("updated value!");
        //                 expect(allRedoRowsByGroup().length).toBe(0);
        //             });
        //         });

        //         describe("DELETE trigger", () => {
        //             it("should execute an undo correctly from a delete action", () => {
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 const currentValue = () => {
        //                     try {
        //                         return (
        //                             db
        //                                 .run(
        //                                     "SELECT test_value FROM test_table WHERE id = 1;",
        //                                 )
        //                                 .get() as {
        //                                 test_value: string;
        //                             }
        //                         ).test_value;
        //                     } catch (e) {
        //                         return undefined;
        //                     }
        //                 };

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("test value");
        //                 incrementUndoGroup(db);

        //                 // Simulate an action that will be logged in the undo history
        //                 db.run("DELETE FROM test_table WHERE id = 1;");
        //                 incrementUndoGroup(db);

        //                 // Execute the undo action
        //                 performUndo(db);
        //                 expect(currentValue()).toBeDefined();

        //                 // Execute the redo action
        //                 performRedo(db);
        //                 expect(currentValue()).toBeUndefined();

        //                 // Expect there to be no redos left
        //                 expect(allRedoRows().length).toBe(0);
        //             });

        //             it("should undo groups of deletes correctly", () => {
        //                 type Row = { id: number; test_value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-0");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-1");
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g2-0");
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-0");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-1");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-2");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table in two groups
        //                 const deleteSql =
        //                     "DELETE FROM test_table WHERE test_value = (?);";
        //                 // group 1
        //                 db.run(deleteSql).run("g1-0");
        //                 db.run(deleteSql).run("g1-1");
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(deleteSql).run("g2-0");
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(deleteSql).run("g3-0");
        //                 db.run(deleteSql).run("g3-1");
        //                 db.run(deleteSql).run("g3-2");
        //                 incrementUndoGroup(db);

        //                 const allRows = () =>
        //                     db
        //                         .run("SELECT * FROM test_table ORDER BY id")
        //                         .all() as Row[];
        //                 expect(allRows()).toEqual([]);

        //                 // Execute three undo actions
        //                 performUndo(db);
        //                 performUndo(db);
        //                 performUndo(db);
        //                 let expectedValues = [
        //                     { id: 1, test_value: "g1-0" },
        //                     { id: 2, test_value: "g1-1" },
        //                     { id: 3, test_value: "g2-0" },
        //                     { id: 4, test_value: "g3-0" },
        //                     { id: 5, test_value: "g3-1" },
        //                     { id: 6, test_value: "g3-2" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 // Execute three redo actions
        //                 performRedo(db);
        //                 expectedValues = [
        //                     { id: 3, test_value: "g2-0" },
        //                     { id: 4, test_value: "g3-0" },
        //                     { id: 5, test_value: "g3-1" },
        //                     { id: 6, test_value: "g3-2" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 performRedo(db);
        //                 expectedValues = [
        //                     { id: 4, test_value: "g3-0" },
        //                     { id: 5, test_value: "g3-1" },
        //                     { id: 6, test_value: "g3-2" },
        //                 ];
        //                 expect(allRows()).toEqual(expectedValues);

        //                 performRedo(db);
        //                 expect(allRows()).toEqual([]);

        //                 // Expect there to be no redos left
        //                 expect(allRedoRows().length).toBe(0);
        //             });

        //             it("should have no redo operations after inserting a new undo entry after DELETE", () => {
        //                 type Row = { id: number; test_value: string };
        //                 // Create history tables and test table
        //                 db.run(
        //                     "CREATE TABLE test_table (id INTEGER PRIMARY KEY, test_value TEXT);",
        //                 );

        //                 // Create undo triggers for the test table
        //                 createUndoTriggers(db, "test_table");

        //                 // Insert a value into the test table
        //                 // group 1
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-0");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g1-1");
        //                 // group 2
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g2-0");
        //                 // group 3
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-0");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-1");
        //                 db.run(
        //                     "INSERT INTO test_table (test_value) VALUES (?);",
        //                 ).run("g3-2");
        //                 incrementUndoGroup(db);

        //                 // Update the value in the test table in two groups
        //                 const deleteSql =
        //                     "DELETE FROM test_table WHERE test_value = (?);";
        //                 // group 1
        //                 db.run(deleteSql).run("g1-0");
        //                 db.run(deleteSql).run("g1-1");
        //                 incrementUndoGroup(db);
        //                 // group 2
        //                 db.run(deleteSql).run("g2-0");
        //                 incrementUndoGroup(db);
        //                 // group 3
        //                 db.run(deleteSql).run("g3-0");
        //                 db.run(deleteSql).run("g3-1");
        //                 db.run(deleteSql).run("g3-2");
        //                 incrementUndoGroup(db);

        //                 const allRows = () =>
        //                     db
        //                         .run("SELECT * FROM test_table ORDER BY id")
        //                         .all() as Row[];
        //                 expect(allRows()).toEqual([]);

        //                 // Execute three undo actions
        //                 performUndo(db);
        //                 performUndo(db);

        //                 expect(allRedoRowsByGroup().length).toBe(2);

        //                 // Do another action to clear the redo stack
        //                 db.run("DELETE FROM test_table");
        //                 expect(allRedoRowsByGroup().length).toBe(0);
        //             });
        //         });
        //     });
        // });

        // describe("Advanced Undo/Redo Stress Tests", () => {
        //     function setupComplexTables() {
        //         db.exec(`
        //         CREATE TABLE users (
        //             id INTEGER PRIMARY KEY AUTOINCREMENT,
        //             name TEXT,
        //             age INTEGER,
        //             email TEXT UNIQUE
        //         );
        //         CREATE TABLE orders (
        //             id INTEGER PRIMARY KEY AUTOINCREMENT,
        //             user_id INTEGER,
        //             product TEXT,
        //             quantity INTEGER,
        //             total_price REAL,
        //             FOREIGN KEY(user_id) REFERENCES users(id)
        //         );
        //         CREATE TABLE payments (
        //             id INTEGER PRIMARY KEY AUTOINCREMENT,
        //             order_id INTEGER,
        //             amount REAL,
        //             payment_date TEXT,
        //             FOREIGN KEY(order_id) REFERENCES orders(id)
        //         );
        //     `);

        //         createUndoTriggers(db, "users");
        //         createUndoTriggers(db, "orders");
        //         createUndoTriggers(db, "payments");
        //     }

        //     it("Complex data with foreign keys and multiple undo/redo intervals", () => {
        //         setupComplexTables();

        //         // Insert user data
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("John Doe", 30, "john@example.com");
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Jane Doe", 25, "jane@example.com");
        //         incrementUndoGroup(db);

        //         // Insert orders linked to users
        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(1, "Laptop", 1, 1000.0);
        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(2, "Phone", 2, 500.0);
        //         incrementUndoGroup(db);

        //         // Insert payments linked to orders
        //         db.run(
        //             "INSERT INTO payments (order_id, amount, payment_date) VALUES (?, ?, ?)",
        //         ).run(1, 1000.0, "2024-10-08");
        //         db.run(
        //             "INSERT INTO payments (order_id, amount, payment_date) VALUES (?, ?, ?)",
        //         ).run(2, 500.0, "2024-10-09");
        //         incrementUndoGroup(db);

        //         // Perform undo in random intervals
        //         performUndo(db); // Undo payments
        //         let payments = db.run("SELECT * FROM payments").all();
        //         expect(payments.length).toBe(0);

        //         performUndo(db); // Undo orders
        //         let orders = db.run("SELECT * FROM orders").all();
        //         expect(orders.length).toBe(0);

        //         // Redo orders and payments
        //         performRedo(db);
        //         orders = db.run("SELECT * FROM orders").all();
        //         expect(orders.length).toBe(2);

        //         performRedo(db);
        //         payments = db.run("SELECT * FROM payments").all();
        //         expect(payments.length).toBe(2);

        //         // Undo back to the users table
        //         performUndo(db);
        //         performUndo(db);
        //         performUndo(db);
        //         let users = db.run("SELECT * FROM users").all();
        //         expect(users.length).toBe(0);
        //     });

        //     it("Undo/Redo with random intervals, updates, and WHERE clauses", () => {
        //         setupComplexTables();

        //         // Insert initial users
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Alice", 28, "alice@example.com");
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Bob", 35, "bob@example.com");
        //         incrementUndoGroup(db);

        //         // Insert orders with complex WHERE clauses
        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(1, "Tablet", 2, 600.0);
        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(2, "Monitor", 1, 300.0);
        //         incrementUndoGroup(db);

        //         // Perform an update with WHERE
        //         db.run("UPDATE users SET age = age + 1 WHERE name = ?").run(
        //             "Alice",
        //         );
        //         incrementUndoGroup(db);

        //         // Undo the age update and verify the value
        //         performUndo(db);
        //         let result = db
        //             .run("SELECT age FROM users WHERE name = ?")
        //             .get("Alice") as { age: number };
        //         expect(result.age).toBe(28);

        //         // Undo order insertion and check if the table is empty
        //         performUndo(db);
        //         let orders = db.run("SELECT * FROM orders").all();
        //         expect(orders.length).toBe(0);

        //         // Redo the order insertion and update
        //         performRedo(db);
        //         performRedo(db);
        //         orders = db.run("SELECT * FROM orders").all();
        //         expect(orders.length).toBe(2);
        //     });

        //     it("Randomized undo/redo with interleaved data changes", () => {
        //         setupComplexTables();

        //         // Insert several users and orders interleaved with undo/redo
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Chris", 40, "chris@example.com");
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Diana", 22, "diana@example.com");
        //         incrementUndoGroup(db);

        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(1, "Desk", 1, 150.0);
        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(2, "Chair", 2, 200.0);
        //         incrementUndoGroup(db);

        //         // Perform undo of orders, then insert more data
        //         let expectedOrders = db.run("SELECT * FROM orders").all();
        //         performUndo(db);
        //         let currentOrders = db.run("SELECT * FROM orders").all();
        //         expect(currentOrders.length).toBe(0);
        //         performRedo(db);
        //         currentOrders = db.run("SELECT * FROM orders").all();
        //         expect(currentOrders).toEqual(expectedOrders);
        //         performUndo(db);

        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Eve", 32, "eve@example.com");
        //         incrementUndoGroup(db);

        //         // Perform redo of orders and undo user insertion
        //         performRedo(db);
        //         performUndo(db);

        //         let users = db.run("SELECT * FROM users").all();
        //         expect(users.length).toBe(2); // Should contain only 'Chris' and 'Diana'

        //         currentOrders = db.run("SELECT * FROM orders").all();
        //         expect(currentOrders.length).toBe(0); // Orders should be restored
        //     });

        //     it("Complex updates and deletes with random undo/redo intervals", () => {
        //         setupComplexTables();

        //         // Insert users and orders
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Frank", 33, "frank@example.com");
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Grace", 29, "grace@example.com");
        //         incrementUndoGroup(db);

        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(1, "Headphones", 1, 100.0);
        //         db.run(
        //             "INSERT INTO orders (user_id, product, quantity, total_price) VALUES (?, ?, ?, ?)",
        //         ).run(2, "Keyboard", 1, 120.0);
        //         incrementUndoGroup(db);

        //         // Update and delete data
        //         db.run("UPDATE users SET email = ? WHERE name = ?").run(
        //             "frank_updated@example.com",
        //             "Frank",
        //         );
        //         db.run("DELETE FROM orders WHERE id = 2");
        //         incrementUndoGroup(db);

        //         // Undo deletion and updates
        //         performUndo(db);
        //         performUndo(db);

        //         let user = db
        //             .run("SELECT * FROM users WHERE name = ?")
        //             .get("Frank") as any;
        //         expect(user.email).toBe("frank@example.com"); // Should be the original email

        //         performRedo(db);
        //         let orders = db.run("SELECT * FROM orders").all();
        //         expect(orders.length).toBe(2); // Order should be restored
        //     });
        // });

        // describe("Limit Tests", () => {
        //     const groupLimit = () =>
        //         (
        //             db
        //                 .run(
        //                     `SELECT group_limit FROM ${Constants.HistoryStatsTableName}`,
        //                 )
        //                 .get() as HistoryStatsRow | undefined
        //         )?.group_limit;

        //     const undoGroups = () =>
        //         (
        //             db
        //                 .run(
        //                     `SELECT * FROM ${Constants.UndoHistoryTableName} GROUP BY "history_group" ORDER BY "history_group" ASC`,
        //                 )
        //                 .all() as HistoryTableRow[]
        //         ).map((row) => row.history_group);
        //     it("removes the oldest undo group when the undo limit of 100 is reached", () => {
        //         db.run(
        //             "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT);",
        //         );
        //         createUndoTriggers(db, "users");

        //         // set the limit to 100
        //         db.run(
        //             `UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 100`,
        //         );
        //         expect(groupLimit()).toBe(100);

        //         for (let i = 0; i < 99; i++) {
        //             // Insert users and orders
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${100 / i}`, i, `email${100 - i}@jeff.com`);
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Josie_${100 / i}`, i + 50, `email${200 - i}@josie.com`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(99);
        //         let expectedGroups = Array.from(Array(99).keys()).map((i) => i);
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // Insert one more group
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Harry_100", 100, "email@jeff100.com");
        //         incrementUndoGroup(db);
        //         expect(undoGroups().length).toBe(100);
        //         expectedGroups = [...expectedGroups, 99];
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // Insert another group
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Harry_101", 101, "email@jeff101.com");
        //         incrementUndoGroup(db);
        //         expect(undoGroups().length).toBe(100);
        //         expectedGroups = Array.from(Array(100).keys()).map((i) => i + 1);
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // insert 50 more groups
        //         for (let i = 102; i < 152; i++) {
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${i}`, i, `email${100 - i}@jeff.com`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(100);
        //         expectedGroups = Array.from(Array(100).keys()).map((i) => i + 51);
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         const allRows = db.run("SELECT * FROM users").all();
        //         expect(allRows.length).toBeGreaterThan(150);
        //     });

        //     it("removes the oldest undo group when the undo limit of 2000 is reached", () => {
        //         db.run(
        //             "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT);",
        //         );
        //         createUndoTriggers(db, "users");

        //         // set the limit to 2000
        //         db.run(
        //             `UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 2000`,
        //         );
        //         expect(groupLimit()).toBe(2000);

        //         for (let i = 0; i < 1999; i++) {
        //             // Insert users and orders
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${2000 / i}`, i, `email${2000 - i}@jeff.com`);
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Josie_${2000 / i}`, i + 50, `email${200 - i}@josie.com`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(1999);
        //         let expectedGroups = Array.from(Array(1999).keys()).map((i) => i);
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // Insert one more group
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Harry_2000", 2000, "email@jeff2000.com");
        //         incrementUndoGroup(db);
        //         expect(undoGroups().length).toBe(2000);
        //         expectedGroups = [...expectedGroups, 1999];
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // Insert another group
        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run("Harry_101", 101, "email@jeff101.com");
        //         incrementUndoGroup(db);
        //         expect(undoGroups().length).toBe(2000);
        //         expectedGroups = Array.from(Array(2000).keys()).map((i) => i + 1);
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // insert 50 more groups
        //         for (let i = 102; i < 152; i++) {
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${i}`, i, `email${2000 - i}@jeff.com`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(2000);
        //         expectedGroups = Array.from(Array(2000).keys()).map((i) => i + 51);
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         const allRows = db.run("SELECT * FROM users").all();
        //         expect(allRows.length).toBeGreaterThan(150);
        //     });

        //     it("adds more undo groups when the limit is increased", () => {
        //         db.run(
        //             "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT);",
        //         );
        //         createUndoTriggers(db, "users");

        //         // set the limit to 100
        //         db.run(
        //             `UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 100`,
        //         );
        //         expect(groupLimit()).toBe(100);

        //         for (let i = 0; i < 150; i++) {
        //             // Insert users and orders
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${100 / i}`, i, `email${100 - i}`);
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Josie_${100 / i}`, i + 50, `email${200 - i}`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(100);
        //         let expectedGroups = Array.from(Array(100).keys()).map(
        //             (i) => i + 50,
        //         );
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // set the limit to 200
        //         db.run(
        //             `UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 200`,
        //         );
        //         expect(groupLimit()).toBe(200);
        //         expect(undoGroups().length).toBe(100);

        //         for (let i = 150; i < 300; i++) {
        //             // Insert users and orders
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${100 / i}`, i, `email${100 - i}`);
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Josie_${100 / i}`, i + 50, `email${200 - i}`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(200);
        //         expectedGroups = [
        //             ...Array.from(Array(50).keys()).map((i) => i + 100),
        //             ...Array.from(Array(150).keys()).map((i) => i + 150),
        //         ];
        //         expect(undoGroups()).toEqual(expectedGroups);
        //     });

        //     it("removes groups when the limit is decreased", () => {
        //         db.run(
        //             "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT);",
        //         );
        //         createUndoTriggers(db, "users");

        //         // set the limit to 200
        //         db.run(
        //             `UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 200`,
        //         );
        //         expect(groupLimit()).toBe(200);

        //         for (let i = 0; i < 250; i++) {
        //             // Insert users and orders
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Harry_${100 / i}`, i, `email${100 - i}`);
        //             db.run(
        //                 "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //             ).run(`Josie_${100 / i}`, i + 50, `email${200 - i}`);
        //             incrementUndoGroup(db);
        //         }
        //         expect(undoGroups().length).toBe(200);
        //         let expectedGroups = Array.from(Array(200).keys()).map(
        //             (i) => i + 50,
        //         );
        //         expect(undoGroups()).toEqual(expectedGroups);

        //         // set the limit to 100
        //         db.run(
        //             `UPDATE ${Constants.HistoryStatsTableName} SET group_limit = 50`,
        //         );
        //         expect(groupLimit()).toBe(50);
        //         // Should not change until next group increment
        //         expect(undoGroups().length).toBe(200);

        //         db.run(
        //             "INSERT INTO users (name, age, email) VALUES (?, ?, ?)",
        //         ).run(`Harry_last`, 1234, `email_last`);
        //         incrementUndoGroup(db);
        //         expect(undoGroups().length).toBe(50);
        //         expectedGroups = Array.from(Array(50).keys()).map((i) => i + 201);
        //         expect(undoGroups()).toEqual(expectedGroups);
        //     });
        // });

        // describe("Advanced Undo/Redo Stress Tests with Reserved Words, Special Characters, and DELETE Operations", () => {
        //     function setupComplexTablesWithReservedWords() {
        //         db.exec(`
        //         CREATE TABLE reserved_words_test (
        //             "order" INTEGER PRIMARY KEY AUTOINCREMENT,
        //             "group" TEXT,
        //             "select" TEXT,
        //             "from" TEXT
        //         );
        //         CREATE TABLE special_characters_test (
        //             id INTEGER PRIMARY KEY AUTOINCREMENT,
        //             description TEXT
        //         );
        //     `);

        //         createUndoTriggers(db, "reserved_words_test");
        //         createUndoTriggers(db, "special_characters_test");
        //     }

        //     it("Undo/Redo with reserved words, special characters, and DELETE operations", () => {
        //         setupComplexTablesWithReservedWords();

        //         // Insert into reserved_words_test
        //         db.run(
        //             'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
        //         ).run("Group1", "Select1", "From1");
        //         db.run(
        //             'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
        //         ).run("Group2", "Select2", "From2");
        //         incrementUndoGroup(db);

        //         // Insert into special_characters_test
        //         db.run(
        //             "INSERT INTO special_characters_test (description) VALUES (?)",
        //         ).run(
        //             "\"Double quote\", 'Single quote', (Parentheses), [Brackets]",
        //         );
        //         db.run(
        //             "INSERT INTO special_characters_test (description) VALUES (?)",
        //         ).run("Escape \\ backslash");
        //         incrementUndoGroup(db);

        //         // Perform DELETE operations
        //         db.run(
        //             'DELETE FROM reserved_words_test WHERE "order" = 2',
        //         );
        //         db.run(
        //             "DELETE FROM special_characters_test WHERE id = 2",
        //         );
        //         incrementUndoGroup(db);

        //         // Undo DELETE operations
        //         performUndo(db); // Undo the DELETE from special_characters_test
        //         let specialResult = db
        //             .run("SELECT * FROM special_characters_test")
        //             .all();
        //         expect(specialResult.length).toBe(2); // Both rows should be back

        //         performUndo(db); // Undo the DELETE from reserved_words_test
        //         let reservedResult = db
        //             .run("SELECT * FROM reserved_words_test")
        //             .all();
        //         expect(reservedResult.length).toBe(2); // Both rows should be back

        //         // Redo DELETE operations
        //         performUndo(db);
        //         performRedo(db); // Redo the DELETE from reserved_words_test
        //         reservedResult = db
        //             .run("SELECT * FROM reserved_words_test")
        //             .all();
        //         expect(reservedResult.length).toBe(2); // One row should be deleted
        //     });

        //     it("Undo/Redo with random intervals, updates, deletes, and WHERE clauses", () => {
        //         setupComplexTablesWithReservedWords();

        //         // Insert into both tables
        //         db.run(
        //             'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
        //         ).run("Group1", "Select1", "From1");
        //         db.run(
        //             "INSERT INTO special_characters_test (description) VALUES (?)",
        //         ).run(
        //             '"Complex value (with) {all} kinds [of] special characters!"',
        //         );
        //         incrementUndoGroup(db);

        //         // Perform updates and DELETEs
        //         db.run(
        //             'UPDATE reserved_words_test SET "group" = ? WHERE "order" = 1',
        //         ).run("UpdatedGroup");
        //         db.run(
        //             "DELETE FROM special_characters_test WHERE id = 1",
        //         );
        //         incrementUndoGroup(db);

        //         // Perform undo/redo in random order
        //         let response = performUndo(db); // Undo DELETE and update
        //         expect(response.success).toBe(true);
        //         expect(response.error).toBeUndefined();
        //         expect(response.tableNames).toEqual(
        //             new Set(["reserved_words_test", "special_characters_test"]),
        //         );
        //         let reservedResult = db
        //             .run(
        //                 'SELECT "group" FROM reserved_words_test WHERE "order" = 1',
        //             )
        //             .get() as any;
        //         let specialResult = db
        //             .run(
        //                 "SELECT description FROM special_characters_test WHERE id = 1",
        //             )
        //             .get() as any;
        //         expect(reservedResult.group).toBe("Group1");
        //         expect(specialResult.description).toBe(
        //             '"Complex value (with) {all} kinds [of] special characters!"',
        //         );

        //         performRedo(db); // Redo DELETE and update
        //         reservedResult = db
        //             .run(
        //                 'SELECT "group" FROM reserved_words_test WHERE "order" = 1',
        //             )
        //             .get();
        //         specialResult = db
        //             .run("SELECT * FROM special_characters_test")
        //             .all();
        //         expect(reservedResult.group).toBe("UpdatedGroup");
        //         expect(specialResult.length).toBe(0); // The row should be deleted
        //     });

        //     it("Stress test with multiple DELETEs, special characters, and reserved words", () => {
        //         setupComplexTablesWithReservedWords();

        //         // Insert several rows into both tables
        //         db.run(
        //             'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
        //         ).run("GroupA", "SelectA", "FromA");
        //         db.run(
        //             'INSERT INTO reserved_words_test ("group", "select", "from") VALUES (?, ?, ?)',
        //         ).run("GroupB", "SelectB", "FromB");
        //         db.run(
        //             "INSERT INTO special_characters_test (description) VALUES (?)",
        //         ).run('Some "special" (value)');
        //         db.run(
        //             "INSERT INTO special_characters_test (description) VALUES (?)",
        //         ).run('Another "complex" [test] (entry)');
        //         incrementUndoGroup(db);

        //         // Perform random DELETEs
        //         db.run(
        //             'DELETE FROM reserved_words_test WHERE "order" = 1',
        //         );
        //         db.run(
        //             "DELETE FROM special_characters_test WHERE id = 2",
        //         );
        //         incrementUndoGroup(db);

        //         // Undo all DELETEs
        //         performUndo(db);

        //         let reservedResult = db
        //             .run("SELECT * FROM reserved_words_test")
        //             .all();
        //         let specialResult = db
        //             .run("SELECT * FROM special_characters_test")
        //             .all();
        //         expect(reservedResult.length).toBe(2); // Both rows should be restored
        //         expect(specialResult.length).toBe(2); // Both rows should be restored

        //         // Redo all DELETEs
        //         performRedo(db);
        //         performRedo(db);

        //         reservedResult = db
        //             .run("SELECT * FROM reserved_words_test")
        //             .all();
        //         specialResult = db
        //             .run("SELECT * FROM special_characters_test")
        //             .all();
        //         expect(reservedResult.length).toBe(1); // One row should be deleted
        //         expect(specialResult.length).toBe(1); // One row should be deleted
        //     });
        // });

        // describe("flattenUndoGroupsAbove", () => {
        //     let db: Database.Database;
        //     const testDbPath = ":memory:";

        //     // Mock console.log to avoid cluttering test output
        //     beforeEach(() => {
        //         vi.spyOn(console, "log").mockImplementation(() => {});

        //         // Create a new in-memory database for each test
        //         db = new Database(testDbPath);
        //         createHistoryTables(db);
        //     });

        //     afterEach(() => {
        //         vi.restoreAllMocks();
        //         db.close();
        //     });

        //     it("should flatten all undo groups above the specified group", () => {
        //         // Setup: Create multiple undo groups
        //         const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

        //         // Insert records with different group numbers
        //         db.run(insertSql).run(1, 1, "SQL 1");
        //         db.run(insertSql).run(2, 2, "SQL 2");
        //         db.run(insertSql).run(3, 3, "SQL 3");
        //         db.run(insertSql).run(4, 4, "SQL 4");
        //         db.run(insertSql).run(5, 5, "SQL 5");

        //         // Execute the function to flatten groups above 2
        //         flattenUndoGroupsAbove(db, 2);

        //         // Verify: All groups above 2 should now be 2
        //         const result = db
        //             .run(
        //                 `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
        //             )
        //             .all() as { history_group: number }[];

        //         expect(result).toHaveLength(5);
        //         expect(result[0].history_group).toBe(1); // Group 1 should remain unchanged
        //         expect(result[1].history_group).toBe(2); // Group 2 should remain unchanged
        //         expect(result[2].history_group).toBe(2); // Group 3 should be flattened to 2
        //         expect(result[3].history_group).toBe(2); // Group 4 should be flattened to 2
        //         expect(result[4].history_group).toBe(2); // Group 5 should be flattened to 2
        //     });

        //     it("should do nothing when there are no groups above the specified group", () => {
        //         // Setup: Create undo groups all below or equal to the target
        //         const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

        //         db.run(insertSql).run(1, 1, "SQL 1");
        //         db.run(insertSql).run(2, 2, "SQL 2");
        //         db.run(insertSql).run(3, 3, "SQL 3");

        //         // Execute the function to flatten groups above 3
        //         flattenUndoGroupsAbove(db, 3);

        //         // Verify: No groups should change
        //         const result = db
        //             .run(
        //                 `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
        //             )
        //             .all() as { history_group: number }[];

        //         expect(result).toHaveLength(3);
        //         expect(result[0].history_group).toBe(1);
        //         expect(result[1].history_group).toBe(2);
        //         expect(result[2].history_group).toBe(3);
        //     });

        //     it("should work with an empty undo history table", () => {
        //         // Execute the function on an empty table
        //         flattenUndoGroupsAbove(db, 5);

        //         // Verify: No errors should occur
        //         const result = db
        //             .run(
        //                 `SELECT COUNT(*) as count FROM ${Constants.UndoHistoryTableName}`,
        //             )
        //             .get() as { count: number };
        //         expect(result.count).toBe(0);
        //     });

        //     it("should handle negative group numbers correctly", () => {
        //         // Setup: Create undo groups with negative numbers
        //         const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

        //         db.run(insertSql).run(1, -3, "SQL 1");
        //         db.run(insertSql).run(2, -2, "SQL 2");
        //         db.run(insertSql).run(3, -1, "SQL 3");
        //         db.run(insertSql).run(4, 0, "SQL 4");
        //         db.run(insertSql).run(5, 1, "SQL 5");

        //         // Execute the function to flatten groups above -2
        //         flattenUndoGroupsAbove(db, -2);

        //         // Verify: All groups above -2 should now be -2
        //         const result = db
        //             .run(
        //                 `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
        //             )
        //             .all() as { history_group: number }[];

        //         expect(result).toHaveLength(5);
        //         expect(result[0].history_group).toBe(-3); // Group -3 should remain unchanged
        //         expect(result[1].history_group).toBe(-2); // Group -2 should remain unchanged
        //         expect(result[2].history_group).toBe(-2); // Group -1 should be flattened to -2
        //         expect(result[3].history_group).toBe(-2); // Group 0 should be flattened to -2
        //         expect(result[4].history_group).toBe(-2); // Group 1 should be flattened to -2
        //     });

        //     it("should work with incrementUndoGroup to flatten newly created groups", () => {
        //         // Setup: Create initial undo group
        //         incrementUndoGroup(db); // Group 1

        //         // Insert a record in group 1
        //         const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;
        //         db.run(insertSql).run(1, 1, "SQL 1");

        //         // Create more undo groups
        //         incrementUndoGroup(db); // Group 2
        //         db.run(insertSql).run(2, 2, "SQL 2");

        //         incrementUndoGroup(db); // Group 3
        //         db.run(insertSql).run(3, 3, "SQL 3");

        //         // Flatten groups above 1
        //         flattenUndoGroupsAbove(db, 1);

        //         // Verify: All groups above 1 should now be 1
        //         const result = db
        //             .run(
        //                 `SELECT history_group FROM ${Constants.UndoHistoryTableName} ORDER BY sequence`,
        //             )
        //             .all() as { history_group: number }[];

        //         expect(result).toHaveLength(3);
        //         expect(result[0].history_group).toBe(1);
        //         expect(result[1].history_group).toBe(1); // Group 2 should be flattened to 1
        //         expect(result[2].history_group).toBe(1); // Group 3 should be flattened to 1

        //         // Verify the current undo group in stats table is unchanged
        //         const currentGroup = getCurrentUndoGroup(db);
        //         expect(currentGroup).toBe(3); // The current group in stats should still be 3
        //     });

        //     it("should log appropriate messages when flattening groups", () => {
        //         // Setup
        //         const consoleSpy = vi.spyOn(console, "log");

        //         // Execute the function
        //         flattenUndoGroupsAbove(db, 5);

        //         // Verify console.log was called with the expected messages
        //         expect(consoleSpy).toHaveBeenCalledWith(
        //             "-------- Flattening undo groups above 5 --------",
        //         );
        //         expect(consoleSpy).toHaveBeenCalledWith(
        //             "-------- Done flattening undo groups above 5 --------",
        //         );
        //     });

        //     it("should handle large group numbers and many records efficiently", () => {
        //         // Setup: Create many undo groups with large group numbers
        //         const insertSql = `INSERT INTO ${Constants.UndoHistoryTableName} (sequence, history_group, sql) VALUES (?, ?, ?)`;

        //         // Insert 100 records with increasing group numbers
        //         for (let i = 1; i <= 100; i++) {
        //             db.run(insertSql).run(i, i * 100, `SQL ${i}`);
        //         }

        //         // Execute the function to flatten groups above 3000
        //         flattenUndoGroupsAbove(db, 3000);

        //         // Verify: All groups above 3000 should now be 3000
        //         const result = db
        //             .run(
        //                 `
        //   SELECT
        //     CASE
        //       WHEN history_group <= 3000 THEN 'below_or_equal'
        //       ELSE 'above'
        //     END as group_category,
        //     COUNT(*) as count
        //   FROM ${Constants.UndoHistoryTableName}
        //   GROUP BY group_category
        // `,
        //             )
        //             .all() as { group_category: string; count: number }[];

        //         const belowOrEqual = result.find(
        //             (r) => r.group_category === "below_or_equal",
        //         );
        //         const above = result.find((r) => r.group_category === "above");

        //         expect(belowOrEqual?.count || 0).toBe(100);
        //         expect(above).toBeUndefined(); // No groups should be above 3000
        //     });
        // });

        // describe("calculateHistorySize", () => {
        //     let db: Database.Database;

        //     beforeEach(() => {
        //         // Create an in-memory SQLite database for each test
        //         db = new Database(":memory:");
        //         // Create the history tables
        //         createHistoryTables(db);

        //         // Try to create dbstat virtual table, but don't fail if it's not supported
        //         try {
        //             db.run(
        //                 "CREATE VIRTUAL TABLE IF NOT EXISTS dbstat USING dbstat",
        //             );
        //         } catch (e) {
        //             console.log(
        //                 "dbstat not available, tests will use fallback methods",
        //             );
        //         }
        //     });

        //     afterEach(() => {
        //         // Close the database connection after each test
        //         db.close();
        //     });

        //     it("should return 0 for empty history tables", () => {
        //         const size = calculateHistorySize(db);
        //         expect(size).toBe(0);
        //     });

        //     it("should calculate size after adding history entries", () => {
        //         // Create a test table to generate history entries
        //         db.run(
        //             "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
        //         );
        //         createUndoTriggers(db, "test_table");

        //         // Get initial size
        //         const initialSize = calculateHistorySize(db);

        //         // Add some data to generate history entries
        //         incrementUndoGroup(db);
        //         db.run("INSERT INTO test_table (value) VALUES ('test1')");
        //         db.run("INSERT INTO test_table (value) VALUES ('test2')");
        //         db.run(
        //             "UPDATE test_table SET value = 'updated' WHERE id = 1",
        //         );

        //         // Get size after adding data
        //         const sizeAfterAdding = calculateHistorySize(db);

        //         // Size should have increased
        //         expect(sizeAfterAdding).toBeGreaterThan(initialSize);
        //     });

        //     it("should handle large amounts of history data", () => {
        //         // Create a test table to generate history entries
        //         db.run(
        //             "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
        //         );
        //         createUndoTriggers(db, "test_table");

        //         // Get initial size
        //         const initialSize = calculateHistorySize(db);

        //         // Add a significant amount of data
        //         for (let i = 0; i < 10; i++) {
        //             incrementUndoGroup(db);
        //             for (let j = 0; j < 10; j++) {
        //                 db.run("INSERT INTO test_table (value) VALUES (?)").run(
        //                     `test-${i}-${j}`,
        //                 );
        //             }
        //         }

        //         // Get size after adding data
        //         const sizeAfterAdding = calculateHistorySize(db);

        //         // Size should have increased significantly
        //         expect(sizeAfterAdding).toBeGreaterThan(initialSize);
        //         console.log(
        //             `History size increased from ${initialSize} to ${sizeAfterAdding} bytes`,
        //         );
        //     });

        //     it("should return consistent results when called multiple times", () => {
        //         // Create a test table and add some history
        //         db.run(
        //             "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
        //         );
        //         createUndoTriggers(db, "test_table");
        //         incrementUndoGroup(db);
        //         db.run("INSERT INTO test_table (value) VALUES ('test')");

        //         // Calculate size multiple times
        //         const size1 = calculateHistorySize(db);
        //         const size2 = calculateHistorySize(db);
        //         const size3 = calculateHistorySize(db);

        //         // All calculations should return the same value
        //         expect(size1).toBe(size2);
        //         expect(size2).toBe(size3);
        //     });
    });
});
