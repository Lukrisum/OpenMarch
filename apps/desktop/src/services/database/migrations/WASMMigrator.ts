import { WASMDatabaseService } from "../WASMDatabaseService";

export abstract class WASMMigrator {
    protected db: WASMDatabaseService;

    constructor() {
        this.db = WASMDatabaseService.getInstance();
    }

    abstract get version(): number;

    abstract createTables(): Promise<void>;

    // protected async createTable(params: {
    //     schema: string;
    //     tableName: string;
    //     createHistoryTriggers?: boolean;
    // }): Promise<void> {
    //     try {
    //         await window.electronAPI.database.execute(params.schema);
    //         console.log(`Table ${params.tableName} created.`);

    //         if (params.createHistoryTriggers) {
    //             await this.createHistoryTriggers(params.tableName);
    //             console.log(
    //                 `\tHistory triggers created for ${params.tableName}.`,
    //             );
    //         }
    //     } catch (error: any) {
    //         throw new Error(
    //             `Failed to create table ${params.tableName}: ${error.message}`,
    //         );
    //     }
    // }

    // async getVersion(): Promise<number> {
    //     const result = await window.electronAPI.database.query(
    //         "PRAGMA user_version",
    //     );
    //     return result[0]?.user_version ?? -1;
    // }

    // protected async createHistoryTriggers(tableName: string): Promise<void> {
    //     const columns = await this.getTableColumns(tableName);

    //     // Create INSERT trigger
    //     await window.electronAPI.database.execute(`
    //   CREATE TRIGGER IF NOT EXISTS "${tableName}_it" AFTER INSERT ON "${tableName}"
    //   BEGIN
    //     INSERT INTO undo_history ("sequence", "history_group", "sql")
    //     VALUES (
    //       NULL,
    //       (SELECT cur_undo_group FROM history_stats),
    //       'DELETE FROM "${tableName}" WHERE rowid=' || new.rowid
    //     );
    //   END;
    // `);

    //     // Create UPDATE trigger
    //     const columnUpdates = columns
    //         .map((col) => `"${col.name}"='||quote(old."${col.name}")||'`)
    //         .join(",");

    //     await window.electronAPI.database.execute(`
    //   CREATE TRIGGER IF NOT EXISTS "${tableName}_ut" AFTER UPDATE ON "${tableName}"
    //   BEGIN
    //     INSERT INTO undo_history ("sequence", "history_group", "sql")
    //     VALUES (
    //       NULL,
    //       (SELECT cur_undo_group FROM history_stats),
    //       'UPDATE "${tableName}" SET ${columnUpdates} WHERE rowid=' || old.rowid
    //     );
    //   END;
    // `);

    //     // Create DELETE trigger
    //     const columnNames = columns.map((col) => `"${col.name}"`).join(",");
    //     const columnValues = columns
    //         .map((col) => `'||quote(old."${col.name}")||'`)
    //         .join(",");

    //     await window.electronAPI.database.execute(`
    //   CREATE TRIGGER IF NOT EXISTS "${tableName}_dt" BEFORE DELETE ON "${tableName}"
    //   BEGIN
    //     INSERT INTO undo_history ("sequence", "history_group", "sql")
    //     VALUES (
    //       NULL,
    //       (SELECT cur_undo_group FROM history_stats),
    //       'INSERT INTO "${tableName}" (${columnNames}) VALUES (${columnValues})'
    //     );
    //   END;
    // `);
    // }

    // private async getTableColumns(
    //     tableName: string,
    // ): Promise<Array<{ name: string }>> {
    //     const result = await window.electronAPI.database.query<{
    //         name: string;
    //     }>(`PRAGMA table_info("${tableName}")`);
    //     return result;
    // }

    // protected async setPragmaToThisVersion(): Promise<void> {
    //     await window.electronAPI.database.execute(
    //         `PRAGMA user_version = ${this.version}`,
    //     );
    // }

    // async isThisVersion(): Promise<boolean> {
    //     const currentVersion = await this.getVersion();
    //     console.log(
    //         `Current version: ${currentVersion}, Target version: ${this.version}`,
    //     );
    //     return currentVersion === this.version;
    // }

    // protected async clearHistory(): Promise<void> {
    //     await window.electronAPI.database.execute("DELETE FROM undo_history");
    //     await window.electronAPI.database.execute("DELETE FROM redo_history");
    // }
}
