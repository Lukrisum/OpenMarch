interface FileSystemHandle {
    kind: "file" | "directory";
    name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
    kind: "file";
    getFile(): Promise<File>;
    createWritable(
        options?: FileSystemCreateWritableOptions,
    ): Promise<FileSystemWritableFileStream>;
    queryPermission(
        descriptor: FileSystemHandlePermissionDescriptor,
    ): Promise<PermissionState>;
    requestPermission(
        descriptor: FileSystemHandlePermissionDescriptor,
    ): Promise<PermissionState>;
}

interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
}

interface FileSystemHandlePermissionDescriptor {
    mode?: "read" | "readwrite";
}

interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

interface Window {
    showOpenFilePicker(
        options?: FilePickerOptions,
    ): Promise<[FileSystemFileHandle]>;
    showSaveFilePicker(
        options?: SaveFilePickerOptions,
    ): Promise<FileSystemFileHandle>;
    showDirectoryPicker(
        options?: DirectoryPickerOptions,
    ): Promise<FileSystemDirectoryHandle>;
}

interface FilePickerOptions {
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
}

interface SaveFilePickerOptions extends FilePickerOptions {
    suggestedName?: string;
}
