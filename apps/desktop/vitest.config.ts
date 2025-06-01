import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.join(__dirname, "src"),
        },
        extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["**/__test__/**.test.ts?(x)"],
        coverage: {
            reporter: ["text", "json", "json-summary", "html"],
            reportOnFailure: true,
        },
        // environmentMatchGlobs: [
        //     ["src/**", "jsdom"],
        //     ["electron/**", "node"],
        // ],
        testTimeout: 120000, // 2 minute global timeout for all tests
    },
});
