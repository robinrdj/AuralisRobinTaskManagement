import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PGlite downloads and boots a WASM Postgres on first use.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
