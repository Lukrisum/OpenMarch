import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const undoHistory = sqliteTable("undo_history", {
    sequence: integer("sequence").primaryKey(),
    historyGroup: integer("history_group").notNull(),
    sql: text("sql").notNull(),
});

export const redoHistory = sqliteTable("redo_history", {
    sequence: integer("sequence").primaryKey(),
    historyGroup: integer("history_group").notNull(),
    sql: text("sql").notNull(),
});

export const historyStats = sqliteTable("history_stats", {
    id: integer("id")
        .primaryKey()
        .$default(() => 1), // enforce id = 1 in app logic
    curUndoGroup: integer("cur_undo_group").notNull(),
    curRedoGroup: integer("cur_redo_group").notNull(),
    groupLimit: integer("group_limit").notNull(),
});
