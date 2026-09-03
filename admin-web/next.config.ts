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

  /**
   * Chuyển tiếp lời gọi API qua chính máy chủ Next (same-origin proxy).
   *
   * VÌ SAO: gateway dùng chung .151 tự chèn bộ header CORS của dự án khác, và
   * bộ đó thiếu PATCH — trình duyệt chặn mọi thao tác sửa của Web Quản trị
   * ngay tại máy người dùng dù backend hoàn toàn khoẻ. Ta không được phép sửa
   * cấu hình gateway (hạ tầng đi mượn), nên thay vì đấu tranh với CORS thì bỏ
   * hẳn nó: trình duyệt gọi /api/v1/* trên CÙNG tên miền admin, Next chuyển
   * tiếp sang backend ở phía máy chủ — nơi CORS không tồn tại.
   *
   * Kèm lợi ích: mọi khác biệt header giữa gateway và backend sau này cũng
   * không còn ảnh hưởng tới Web Quản trị.
   *
   * LƯU Ý: Next đọc rewrites lúc BUILD và ghi vào routes-manifest, nên
   * API_PROXY_TARGET phải có mặt khi `next build` chạy — xem Dockerfile.
   * Mặc định `http://backend:3001` là tên service trong mạng Docker nội bộ,
   * không đi vòng ra Internet.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://backend:3001";
    return [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }];
  },

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
