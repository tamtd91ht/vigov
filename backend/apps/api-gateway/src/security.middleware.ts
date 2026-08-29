/**
 * Lớp bảo mật ở tầng HTTP cho API Gateway (task P4-36).
 *
 * Viết thủ công thay vì dùng `helmet` vì Phase 1 chốt danh sách phụ thuộc —
 * chưa bổ sung gói mới. Khi được phép cài đặt, có thể thay thân hàm
 * `securityHeaders()` bằng `helmet(...)` mà không đụng tới main.ts.
 */
import type { NextFunction, Request, Response } from 'express';

/** Giá trị cho phép mọi nguồn (chỉ dùng ở môi trường phát triển) */
export const CORS_ALLOW_ALL = '*';

/** Thời gian trình duyệt ghi nhớ chính sách HSTS (giây) — 1 năm */
export const DEFAULT_HSTS_MAX_AGE = 31_536_000;

/** Thời gian trình duyệt cache kết quả preflight CORS (giây) */
const CORS_PREFLIGHT_MAX_AGE = 600;

/** Phương thức và header được phép trong yêu cầu cross-origin */
const CORS_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'];
const CORS_EXPOSED_HEADERS = ['Content-Disposition', 'Content-Length'];

/**
 * Permissions-Policy tối thiểu: API không cần bất kỳ quyền thiết bị nào,
 * tắt hết để trình duyệt từ chối ngay nếu nội dung trả về bị lạm dụng.
 */
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

/**
 * CSP cho một API thuần dữ liệu: không cho tải bất kỳ tài nguyên nào,
 * không cho nhúng vào iframe. Đây là lớp chặn dự phòng nếu có tệp HTML
 * lọt vào kho lưu trữ và bị mở trực tiếp từ tên miền API.
 */
const CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export interface SecurityHeadersOptions {
  /** Bật Strict-Transport-Security — chỉ đặt ở production (đã có HTTPS/TLS) */
  production: boolean;
  /** Thời gian hiệu lực HSTS (giây) */
  hstsMaxAge?: number;
}

/**
 * Middleware gắn các header bảo mật cho MỌI phản hồi.
 * Đặt trước mọi route để cả phản hồi lỗi cũng được bảo vệ.
 */
export function securityHeaders(options: SecurityHeadersOptions) {
  const hstsMaxAge = options.hstsMaxAge ?? DEFAULT_HSTS_MAX_AGE;

  return (_req: Request, res: Response, next: NextFunction): void => {
    // Chặn trình duyệt tự đoán kiểu nội dung (chống XSS qua tệp tải lên)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Cấm nhúng API vào iframe (chống clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');
    // Không gửi kèm URL nguồn khi điều hướng sang tên miền khác
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Bộ lọc XSS cũ của trình duyệt gây lỗ hổng riêng — tắt hẳn theo khuyến nghị hiện hành
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    // Không cho trang web khác đọc trực tiếp tài nguyên của API
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // Ẩn thông tin công nghệ máy chủ
    res.removeHeader('X-Powered-By');

    if (options.production) {
      res.setHeader('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains`);
    }

    next();
  };
}

/** Tuỳ chọn CORS đã chuẩn hoá, truyền thẳng cho `app.enableCors()` */
export interface ResolvedCorsOptions {
  origin: true | string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Dựng whitelist CORS từ biến môi trường `CORS_ORIGINS` (phân tách bằng dấu phẩy).
 *
 * - Dev: bỏ trống hoặc '*' → cho phép mọi nguồn để tiện chạy thử.
 * - Production: BẮT BUỘC khai báo danh sách tên miền thật; để '*' sẽ dừng khởi động.
 */
export function buildCorsOptions(raw: string | undefined, production: boolean): ResolvedCorsOptions {
  const origins = (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowAll = origins.length === 0 || origins.includes(CORS_ALLOW_ALL);

  if (production && allowAll) {
    throw new Error(
      'CORS_ORIGINS chưa được khai báo. Ở môi trường production phải liệt kê rõ tên miền ' +
        'của Web Quản trị / Zalo Mini App (phân tách bằng dấu phẩy), không được để "*".',
    );
  }

  return {
    origin: allowAll ? true : origins,
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: CORS_EXPOSED_HEADERS,
    // Phiên dùng Bearer token trong header, không dùng cookie
    credentials: false,
    maxAge: CORS_PREFLIGHT_MAX_AGE,
  };
}

/** Giá trị JWT_SECRET mẫu — tuyệt đối không được dùng ở production */
export const PLACEHOLDER_JWT_SECRET = 'change-me-in-production';

/** Dừng khởi động nếu production vẫn dùng khoá ký JWT mẫu */
export function assertProductionSecrets(jwtSecret: string | undefined, production: boolean): void {
  if (!production) return;
  if (!jwtSecret || jwtSecret === PLACEHOLDER_JWT_SECRET || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET chưa được đặt an toàn cho production. Hãy sinh chuỗi ngẫu nhiên tối thiểu 32 ký tự ' +
        '(ví dụ: openssl rand -base64 48) và khai báo trong biến môi trường.',
    );
  }
}
