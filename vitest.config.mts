import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // `server-only` throws outside the React Server runtime; it's a no-op for tests.
    alias: { "server-only": path.resolve(__dirname, "tests/support/empty.ts") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/support/setup-unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/support/setup-integration.ts"],
          globalSetup: ["tests/support/global-setup-integration.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
