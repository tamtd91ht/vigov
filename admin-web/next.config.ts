import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Xuất bản dạng "standalone" (P4-34): `next build` sinh thêm `.next/standalone`
   * gồm server.js tối giản + đúng các file node_modules thực sự cần.
   * Nhờ vậy ảnh Docker runtime không phải cài lại dependencies —
   * xem `admin-web/Dockerfile` (stage runner chỉ copy standalone + static + public).
   */
  output: "standalone",

  turbopack: {
    /**
     * Cố định thư mục gốc là chính admin-web.
     * Nếu để Next.js tự suy luận, chỉ cần xuất hiện một package-lock.json ở thư mục
     * cha (do lỡ chạy lệnh npm sai chỗ) là nó chọn nhầm gốc workspace, kéo theo
     * cảnh báo và sai đường dẫn nạp module.
     */
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
