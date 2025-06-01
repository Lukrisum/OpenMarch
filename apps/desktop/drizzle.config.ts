import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    schema: "./src/drizzle/schema.ts",
    out: "./src/drizzle/migrations",
    casing: "snake_case",
    dbCredentials: {
        url: "file:temp.db",
    },
});
