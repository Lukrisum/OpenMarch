import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as OpenMarchSchema from "./schema";
import { createClient } from "@libsql/client";
import drizzleConfig from "../../drizzle.config";

export type OpenMarchDatabase = LibSQLDatabase<typeof OpenMarchSchema>;

export const createTemporaryDatabase = async (): Promise<OpenMarchDatabase> => {
    const client = createClient({
        url: "file::memory:",
    });
    const db: OpenMarchDatabase = await drizzle(client, {
        schema: OpenMarchSchema,
    });
    try {
        await migrate(db, {
            migrationsFolder: "./migrations",
        });
    } catch (err: any) {
        if (err?.code === "SQLITE_OK") {
            // libsql weirdness — no-op
        } else {
            throw err;
        }
    }
    return db;
};
