import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    // integration tests share one database: run files one after another
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**", "src/i18n/**"],
      reporter: ["text-summary", "json-summary", "html"],
    },
  },
});
