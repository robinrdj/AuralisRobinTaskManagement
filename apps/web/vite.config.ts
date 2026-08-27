/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
  server: {
    port: 5173,
    // The API is same-origin in development, so cookies behave exactly as they
    // do in production and there is no CORS special-casing to get wrong.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // The landing page is the entry point for anyone not signed in, and it
    // needs none of the board machinery — so the budget is measured against
    // what a first-time visitor actually downloads, not the total.
    /*
     * Splitting is left to Rollup, which derives it from the dynamic import
     * boundaries in App.tsx. Hand-written `manualChunks` rules produced
     * circular chunks here — grouping by package name cuts across the real
     * dependency graph, and the lazy routes already put the heavy libraries
     * (charts, drag-and-drop) where they belong.
     */
    chunkSizeWarningLimit: 250,
  },
  test: {
    name: "web",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
