import { create } from "zustand";
import { WASMDatabaseService } from "../services/database/WASMDatabaseService";
import { MigrationManager } from "../services/database/migrations/MigrationManager";
import { DatabaseResponse } from "../services/database/types";

interface DatabaseState {
    isInitialized: boolean;
    currentPath: string | null;
    initialize: (path: string, isNewFile?: boolean) => Promise<void>;
    query: <T>(sql: string, params?: any[]) => Promise<DatabaseResponse<T[]>>;
    execute: (sql: string, params?: any[]) => Promise<DatabaseResponse<void>>;
    transaction: <T>(
        operations: () => Promise<T>,
    ) => Promise<DatabaseResponse<T>>;
    close: () => Promise<void>;
}

export const useDatabaseStore = create<DatabaseState>((set, get) => {
    const db = WASMDatabaseService.getInstance();

    return {
        isInitialized: false,
        currentPath: null,

        initialize: async (path: string, isNewFile = false) => {
            try {
                await db.initialize(path);

                // Initialize migrations if needed
                // const migrationManager = new MigrationManager([/* migrations */]);
                // await migrationManager.migrateToLatest(path, isNewFile);

                set({
                    isInitialized: true,
                    currentPath: path,
                });
            } catch (error) {
                console.error("Failed to initialize database:", error);
                throw error;
            }
        },

        query: async <T>(sql: string, params: any[] = []) => {
            return await db.query<T>(sql, params);
        },

        execute: async (sql: string, params: any[] = []) => {
            return await db.execute(sql, params);
        },

        transaction: async <T>(operations: () => Promise<T>) => {
            return await db.transaction(operations);
        },

        close: async () => {
            await db.close();
            set({
                isInitialized: false,
                currentPath: null,
            });
        },
    };
});
