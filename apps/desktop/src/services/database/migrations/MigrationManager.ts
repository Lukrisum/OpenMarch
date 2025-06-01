// import { WASMMigrator } from "./WASMMigrator";
// import { WASMDatabaseService } from "../WASMDatabaseService";
// import { app } from "electron";
// import { join } from "path";
// import * as fs from "fs";

// export class MigrationManager {
//     private db: WASMDatabaseService;
//     private migrations: WASMMigrator[];

//     constructor(migrations: WASMMigrator[]) {
//         this.db = window.openmarch.db;
//         this.migrations = migrations.sort((a, b) => a.version - b.version);
//     }

//     async migrateToLatest(
//         path: string,
//         isNewFile: boolean = false,
//     ): Promise<void> {
//         try {
//             if (!isNewFile) {
//                 // Create backup before migration
//                 const currentVersion = await this.db.pragma("user_version");
//                 const targetVersion =
//                     this.migrations[this.migrations.length - 1].version;

//                 if (currentVersion === targetVersion) {
//                     console.log("Database is up to date");
//                     return;
//                 }

//                 await this.createBackup(path);
//             }

//             // For new files or existing files that need migration
//             for (const migration of this.migrations) {
//                 if (!(await migration.isThisVersion())) {
//                     await migration.createTables();
//                 }
//             }
//         } catch (error: any) {
//             console.error("Migration error:", error);
//             throw new Error(`Failed to migrate database: ${error.message}`);
//         }
//     }

//     private async createBackup(originalPath: string): Promise<void> {
//         const backupDir = join(app.getPath("userData"), "backups");
//         if (!fs.existsSync(backupDir)) {
//             fs.mkdirSync(backupDir);
//         }

//         const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//         const originalName = originalPath.split(/[\\/]/).pop();
//         const backupPath = join(
//             backupDir,
//             `backup_${timestamp}_${originalName}`,
//         );

//         console.log("Creating backup of database in " + backupPath);
//         fs.copyFileSync(originalPath, backupPath);

//         // Delete backups older than 30 days
//         console.log("Deleting backups older than 30 days");
//         const files = fs.readdirSync(backupDir);
//         const thirtyDaysAgo = new Date();
//         thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//         files.forEach((file) => {
//             const filePath = join(backupDir, file);
//             const stats = fs.statSync(filePath);
//             if (stats.birthtime < thirtyDaysAgo) {
//                 fs.unlinkSync(filePath);
//             }
//         });
//     }
// }
