export interface DatabaseError {
    message: string;
    stack?: string;
}

export interface DatabaseResponse<T> {
    success: boolean;
    data: T | undefined;
    error?: DatabaseError;
}

export interface QueryResult<T> {
    rows: T[];
    rowsAffected: number;
    lastInsertRowid?: number;
}
