export interface FilePickerOptions {
    types: Array<{
        description: string;
        accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
}

export class FileSystemService {
    private static readonly FILE_TYPES: FilePickerOptions = {
        types: [
            {
                description: "OpenMarch File",
                accept: {
                    "application/x-sqlite3": [".dots"],
                },
            },
        ],
        excludeAcceptAllOption: true,
    };

    static async requestFileForSave(): Promise<FileSystemFileHandle> {
        try {
            return await window.showSaveFilePicker({
                ...this.FILE_TYPES,
                suggestedName: "untitled.dots",
            });
        } catch (error) {
            console.error("Failed to request file for save:", error);
            throw error;
        }
    }

    static async requestFileForOpen(): Promise<FileSystemFileHandle> {
        try {
            const [handle] = await window.showOpenFilePicker(this.FILE_TYPES);
            return handle;
        } catch (error) {
            console.error("Failed to request file for open:", error);
            throw error;
        }
    }

    static async verifyPermission(
        fileHandle: FileSystemFileHandle,
        readWrite: boolean = false,
    ): Promise<boolean> {
        const options: FileSystemHandlePermissionDescriptor = {
            mode: readWrite ? "readwrite" : "read",
        };

        // Check if we already have permission
        if ((await fileHandle.queryPermission(options)) === "granted") {
            return true;
        }

        // Request permission if we don't have it
        if ((await fileHandle.requestPermission(options)) === "granted") {
            return true;
        }

        return false;
    }

    static async getFileForDatabase(
        handle: FileSystemFileHandle,
    ): Promise<File> {
        try {
            // Verify we have permission to read the file
            const hasPermission = await this.verifyPermission(handle, true);
            if (!hasPermission) {
                throw new Error("Permission denied to access file");
            }

            return await handle.getFile();
        } catch (error) {
            console.error("Failed to get file:", error);
            throw error;
        }
    }

    static async writeFile(
        handle: FileSystemFileHandle,
        contents: Uint8Array,
    ): Promise<void> {
        try {
            const hasPermission = await this.verifyPermission(handle, true);
            if (!hasPermission) {
                throw new Error("Permission denied to write to file");
            }

            const writable = await handle.createWritable();
            await writable.write(contents);
            await writable.close();
        } catch (error) {
            console.error("Failed to write file:", error);
            throw error;
        }
    }
}
