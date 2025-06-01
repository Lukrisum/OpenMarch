import { WASMDatabaseService } from "@/services/database/WASMDatabaseService";
export {};

declare global {
    interface Window {
        openmarch: {
            version: string;
            db: WASMDatabaseService;
        };
    }
}
