import path from "node:path";
import type { NextConfig } from "next";

/**
 * Content-Security-Policy cho Web Quản trị.
 *
 * VÌ SAO CẦN Ở ĐÂY: backend tự đặt đủ bộ header trong security.middleware.ts,
 * nhưng đó là header của phản hồi API. Trang quản trị do Next phục vụ, và cả
 * nginx lẫn next.config đều chưa đặt gì — nên tới trước bản này, tên miền
 * admin không có một header bảo mật nào.
 *
 * Từng chỉ thị:
 *   · default-src 'self'  — mặc định chỉ cùng nguồn; API, ảnh và video đều đi
 *     qua rewrite /api/v1/* nên cũng là same-origin, không cần mở thêm nguồn.
 *   · script-src thêm 'unsafe-inline' — Next App Router nhúng thẳng dữ liệu
 *     flight vào các thẻ <script> nội tuyến. Siết được chỗ này phải dùng nonce,
 *     mà nonce buộc phải có middleware và làm mọi trang chuyển sang render động
 *     — đổi kiến trúc render của hệ đang chạy, không gộp vào bản vá bảo mật.
 *     Dù còn 'unsafe-inline', CSP vẫn chặn được đường rút dữ liệu ra ngoài:
 *     script tiêm vào không nạp được payload từ máy chủ lạ, cũng không gửi
 *     token trong localStorage đi đâu được vì connect-src/img-src khoá 'self'.
 *   · style-src 'unsafe-inline' — React đặt style nội tuyến qua thuộc tính style.
 *   · frame-src youtube-nocookie — CMS xem trước video nhúng ngay trong trang.
 *   · frame-ancestors 'none' — chống nhúng trang quản trị vào iframe
 *     (clickjacking); đây là bản CSP của X-Frame-Options bên dưới.
 *   · object-src 'none' + base-uri 'self' + form-action 'self' — bịt các lối
 *     chèn plugin, đổi gốc đường dẫn tương đối, và bẻ đích của form.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Tắt sẵn các quyền thiết bị: trang quản trị không dùng camera, micro hay GPS.
 * Khai tường minh để mã bị tiêm cũng không mở được chúng.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

/**
 * HSTS — buộc trình duyệt chỉ nói chuyện qua HTTPS trong 1 năm.
 *
 * Trình duyệt BỎ QUA header này khi trang tới qua HTTP trần, nên đặt sẵn không
 * gây hại; nó có tác dụng ngay khi truy cập qua nginx (đã có TLS 1.2/1.3).
 */
const HSTS = "max-age=31536000; includeSubDomains";

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "Strict-Transport-Security", value: HSTS },
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Giữ song song với frame-ancestors: trình duyệt cũ chưa đọc CSP thì vẫn
     còn header này chặn nhúng iframe. */
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  { key: "X-XSS-Protection", value: "0" },
];

const nextConfig: NextConfig = {
  /**
   * Xuất bản dạng "standalone" (P4-34): `next build` sinh thêm `.next/standalone`
   * gồm server.js tối giản + đúng các file node_modules thực sự cần.
   * Nhờ vậy ảnh Docker runtime không phải cài lại dependencies —
   * xem `admin-web/Dockerfile` (stage runner chỉ copy standalone + static + public).
   */
  output: "standalone",

  /* Giấu "X-Powered-By: Next.js" — khỏi chỉ tên và phiên bản framework cho
     người dò. Backend đã gỡ header cùng loại trong security.middleware.ts. */
  poweredByHeader: false,

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

  /**
   * Bộ header bảo mật cho MỌI phản hồi do Next phục vụ.
   *
   * Đặt ở tầng ứng dụng chứ không ở nginx là có chủ ý: nginx trên máy chủ này
   * là hạ tầng đi mượn (xem ghi chú rewrites ở trên), sửa cấu hình của nó có
   * thể động vào dự án khác. Ảnh Docker mang sẵn header thì bê sang máy chủ
   * nào cũng giữ nguyên hiệu lực.
   *
   * Đường dẫn `/api/v1/*` KHÔNG loại trừ: rewrite giữ header của Next ở tầng
   * ngoài, còn header do backend đặt vẫn đi kèm phản hồi, hai bộ không đụng nhau.
   */
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
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
