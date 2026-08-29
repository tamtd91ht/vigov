import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import type { AuthedRequest } from '@vigov/shared';
import { AuditService } from './audit.service';

/** Chỉ ghi vết các phương thức làm THAY ĐỔI dữ liệu */
const AUDITED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

/** Trường nhạy cảm không bao giờ được lưu vào nhật ký */
const REDACTED_FIELDS = ['password', 'newPassword', 'currentPassword', 'passwordHash', 'token', 'accessToken', 'otp'];
const REDACTED_PLACEHOLDER = '***';

/** Giới hạn kích thước dữ liệu body lưu kèm nhật ký (số ký tự JSON) */
const MAX_PAYLOAD_CHARS = 4000;

/** Thứ tự ưu tiên khi suy ra resourceId từ tham số đường dẫn */
const ID_PARAM_KEYS = ['id', 'code', 'username', 'phone', 'arrivalNo'];

/**
 * Ghi vết tự động mọi request ghi dữ liệu THÀNH CÔNG (WBS #29, P3-29).
 * Đăng ký ở cấp AuditModule bằng APP_INTERCEPTOR nên áp dụng toàn ứng dụng.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Chỉ xử lý ngữ cảnh HTTP (bỏ qua message pattern của RabbitMQ)
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const method = (req.method ?? '').toUpperCase();
    if (!AUDITED_METHODS.includes(method)) return next.handle();

    const actor = req.user?.username ?? 'anonymous';
    const resource = this.routePath(req);
    const resourceId = this.resourceId(req);
    const ip = req.ip ?? req.socket?.remoteAddress ?? '';
    const after = this.sanitize(req.body);

    // tap() chỉ chạy nhánh next → request lỗi sẽ không bị ghi vết
    return next.handle().pipe(
      tap(() => {
        void this.audit.record({ actor, action: method, resource, resourceId, after, ip });
      }),
    );
  }

  /** Đường dẫn route đã bỏ tiền tố API, ví dụ: 'users/citizens/:phone' */
  private routePath(req: AuthedRequest): string {
    const raw = (req.route as { path?: string } | undefined)?.path ?? req.path ?? '';
    const prefix = this.config.get<string>('apiPrefix', 'api/v1');
    let path = raw.replace(/^\/+/, '');
    if (prefix && path.startsWith(`${prefix}/`)) path = path.slice(prefix.length + 1);
    return path || '/';
  }

  /** Suy ra mã đối tượng bị tác động từ tham số đường dẫn */
  private resourceId(req: AuthedRequest): string | undefined {
    const params = (req.params ?? {}) as Record<string, string>;
    for (const key of ID_PARAM_KEYS) {
      if (params[key]) return params[key];
    }
    const first = Object.values(params)[0];
    return first ?? undefined;
  }

  /** Loại bỏ trường nhạy cảm và cắt bớt payload quá lớn trước khi lưu */
  private sanitize(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      cleaned[key] = REDACTED_FIELDS.includes(key) ? REDACTED_PLACEHOLDER : value;
    }
    if (Object.keys(cleaned).length === 0) return undefined;

    if (JSON.stringify(cleaned).length > MAX_PAYLOAD_CHARS) {
      return { note: 'Nội dung quá lớn nên không lưu chi tiết', fields: Object.keys(cleaned) };
    }
    return cleaned;
  }
}
