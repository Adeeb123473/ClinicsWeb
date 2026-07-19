import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    hookTimeout: 30000,
    testTimeout: 20000,
    // All suites share a single SQL Server database. Most fixtures are namespaced per run,
    // but a few rows are true singletons (e.g. PlatformSettings, which the registration
    // toggle flips). Run test files sequentially so those can't race across workers.
    fileParallelism: false,
  },
});
