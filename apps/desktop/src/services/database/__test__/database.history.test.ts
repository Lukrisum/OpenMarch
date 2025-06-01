import { describe, it, expect, beforeEach } from "vitest";
import Constants from "@/global/Constants";
import { sql } from "drizzle-orm";
import { createTemporaryDatabase, OpenMarchDatabase } from "@/drizzle/utils";

describe("History Tables and Triggers", () => {
    let db: OpenMarchDatabase;
    // type HistoryRow = { sequence: number; group: number; sql: string };

    beforeEach(async () => {
        db = await createTemporaryDatabase();
        const response = await db.run(
            sql`SELECT * from sqlite_master WHERE type='table'`,
        );
        console.log(response);
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
    });
});
