import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "db/migrations"));
      return {
        main: "./worker/index.ts",
        miniflare: {
          compatibilityDate: "2026-09-29",
          d1Databases: ["DB"],
          bindings: {
            ENVIRONMENT: "test",
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
