import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Cấu hình chạy kiểm thử đơn vị / thành phần cho admin-web (Next.js + React 19). */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Trùng với "paths" trong tsconfig.json: "@/*" -> "./src/*"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
