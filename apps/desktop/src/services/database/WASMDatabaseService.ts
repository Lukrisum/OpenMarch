// src/services/database/WASMDatabaseService.ts
import { createClient, Client } from "@libsql/client-wasm";

export class WASMDatabaseService {
    private client: Client | null = null;
    private _currentPath: string | null = null;

    static getInstance(): WASMDatabaseService {
        if (!window.openmarch.db) {
            throw new Error("Database not initialized");
        }
        return window.openmarch.db;
    }

    async initialize(path: string): Promise<void> {
        try {
            this.client = createClient({
                url: `file:${path}`,
            });
            this._currentPath = path;
        } catch (error) {
            console.error("Failed to initialize database:", error);
            throw error;
        }
        window.openmarch.db = this;
    }

    get currentPath(): string | null {
        return this._currentPath;
    }

    async query<T>(sql: string, params: any[] = []): Promise<T[]> {
        if (!this.client) throw new Error("Database not initialized");
        const result = await this.client.execute(sql, params);
        return result.rows as T[];
    }

    async execute(sql: string, params: any[] = []): Promise<void> {
        if (!this.client) throw new Error("Database not initialized");
        await this.client.execute(sql, params);
    }

    async transaction<T>(operations: () => Promise<T>): Promise<T> {
        if (!this.client) throw new Error("Database not initialized");

        await this.execute("BEGIN TRANSACTION");
        try {
            const result = await operations();
            await this.execute("COMMIT");
            return result;
        } catch (error) {
            await this.execute("ROLLBACK");
            throw error;
        }
    }

    async close(): Promise<void> {
        this._currentPath = null;
        this.client = null;
    }
}
