import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // import.meta.dirname thay cho __dirname để chạy được với config loader native của Vite
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: "dist",
    // Zalo Mini App nạp bundle theo đường dẫn tương đối
    assetsDir: "assets",
  },
  base: "",
});
