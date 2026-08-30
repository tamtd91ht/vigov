import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // import.meta.dirname thay cho __dirname để chạy được với config loader native của Vite
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  // Zalo nạp bundle bằng thẻ <script> cổ điển, ở đó `import.meta` là LỖI CÚ PHÁP
  // lúc parse — cả bundle chết, app trắng trơn. Rolldown vẫn chèn import.meta.url
  // vào helper dynamic-import (react-router lazy, await import("zmp-sdk")) kể cả
  // khi đã gộp một tệp. Thay bằng hằng số ở đây.
  // Không dùng format iife được: Vite 8/rolldown làm rơi hẳn bước xuất CSS.
  define: {
    "import.meta.url": '""',
    "import.meta.resolve": "undefined",
  },
  build: {
    outDir: "dist",
    // Zalo Mini App nạp bundle theo đường dẫn tương đối
    assetsDir: "assets",
    // Zalo KHÔNG phục vụ index.html của ta: nó dựng trang riêng rồi nạp các tệp
    // liệt kê trong app-config.json bằng thẻ <script> cổ điển.
    // Bản nginx tĩnh (cổng 8085) dùng chung bundle này, chạy bình thường.
    rollupOptions: {
      output: {
        // Gộp về MỘT tệp JS: services/zalo.ts dùng await import("zmp-sdk") nên
        // mặc định sinh chunk thứ hai, mà chunk kéo theo lệnh import giữa các
        // tệp — Zalo nạp bằng thẻ script cổ điển sẽ chết. Gộp lại thì bundle
        // không còn lệnh import nào, chạy được ở cả hai nơi.
        codeSplitting: false,
      },
    },
  },
  base: "",
});
