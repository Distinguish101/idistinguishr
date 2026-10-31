import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Two projects:
//   unit        - collaborators (database, auth, email, storage) are mocked.
//   integration - real route handlers against a real Postgres (an in-process
//                 PGlite by default, or any local Postgres via TEST_DATABASE_URL),
//                 with only external services (auth session, email, Anthropic)
//                 replaced. Files run one at a time because they share the database.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/setup/global-db.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          restoreMocks: true,
        },
      },
    ],
  },
});

