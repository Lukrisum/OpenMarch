import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as OpenMarchSchema from "./schema";
import { createClient } from "@libsql/client";
import type * as DrizzleKit from "drizzle-kit/api";
import { createRequire } from "node:module";
import { DrizzleSQLiteSnapshotJSON } from "drizzle-kit/api";

// workaround for https://github.com/drizzle-team/drizzle-orm/issues/2853
const require = createRequire(import.meta.url);
const { generateSQLiteDrizzleJson, generateSQLiteMigration } =
    require("drizzle-kit/api") as typeof DrizzleKit;
// end of workaround
export type OpenMarchDatabase = LibSQLDatabase<typeof OpenMarchSchema>;

// workaround for https://github.com/drizzle-team/drizzle-orm/issues/3913
async function pushSchema(db: OpenMarchDatabase) {
    const prevJson = await generateSQLiteDrizzleJson({});
    const curJson = (await generateSQLiteDrizzleJson(
        OpenMarchSchema,
        "snake_case",
    )) as DrizzleSQLiteSnapshotJSON;
    const statements = await generateSQLiteMigration(prevJson, curJson as any);
    for (const statement of statements) {
        await db.run(statement);
    }
}
// end of workaround

export const createTemporaryDatabase = async (): Promise<OpenMarchDatabase> => {
    const client = createClient({
        url: "file::memory:",
    });
    const db: OpenMarchDatabase = await drizzle(client, {
        schema: OpenMarchSchema,
        casing: "snake_case",
    });
    await pushSchema(db);
    return db;
};
