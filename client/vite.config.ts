import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // pdfjs-dist is only imported dynamically, inside the letterhead setup modal. Without
    // pre-bundling it here, Vite first discovers it mid-session and triggers a full page
    // reload, which throws away the half-finished setup the user was in the middle of.
    include: ["pdfjs-dist"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    pool: "threads",
  },
});
