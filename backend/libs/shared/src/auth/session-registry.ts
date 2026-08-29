import { Injectable, Logger } from '@nestjs/common';

/**
 * Sổ theo dõi phiên đăng nhập còn hiệu lực (P5-08).
 *
 * Vấn đề: JWT là chứng chỉ tự chứa, khoá tài khoản hay thu hồi phiên không làm
 * token đang lưu hết hiệu lực — token cũ vẫn dùng được tới khi hết hạn (8 giờ).
 * Giải pháp: mỗi token mang `sid` (mã phiên); guard tra sổ này trước khi cho qua.
 *
 * Phase 1 lưu trong bộ nhớ tiến trình, có thời gian sống ngắn để không phải
 * truy vấn cơ sở dữ liệu mỗi request. Khi chạy nhiều instance: thay bằng Redis,
 * giữ nguyên interface.
 */

/** Thời gian nhớ kết quả tra cứu (ms) — đủ ngắn để thu hồi có hiệu lực gần như tức thì */
const CACHE_TTL_MS = 10_000;

export interface SessionState {
  revoked: boolean;
  /** Chủ tài khoản đã bị khoá */
  subjectLocked: boolean;
}

/** Nguồn dữ liệu thật về trạng thái phiên — module Users cài đặt và đăng ký */
export type SessionResolver = (sessionId: string) => Promise<SessionState | null>;

@Injectable()
export class SessionRegistry {
  private readonly logger = new Logger(SessionRegistry.name);
  private readonly cache = new Map<string, { state: SessionState; expiresAt: number }>();
  private resolver: SessionResolver | null = null;

  /** Module Users gọi khi khởi động để cung cấp cách tra cứu phiên trong cơ sở dữ liệu */
  registerResolver(resolver: SessionResolver): void {
    this.resolver = resolver;
  }

  /**
   * Phiên còn dùng được không.
   * Chưa đăng ký resolver (ví dụ trong test) thì mặc định cho qua để không chặn nhầm.
   */
  async isActive(sessionId: string): Promise<boolean> {
    if (!this.resolver) return true;

    const cached = this.cache.get(sessionId);
    if (cached && cached.expiresAt > Date.now()) {
      return !cached.state.revoked && !cached.state.subjectLocked;
    }

    try {
      const state = await this.resolver(sessionId);
      // Không tìm thấy phiên (đã bị xoá) thì coi như đã thu hồi
      const resolved: SessionState = state ?? { revoked: true, subjectLocked: false };
      this.cache.set(sessionId, { state: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
      return !resolved.revoked && !resolved.subjectLocked;
    } catch (err) {
      // Lỗi tra cứu không được làm sập xác thực — ghi log rồi cho qua
      this.logger.warn(`Không tra được trạng thái phiên ${sessionId}: ${(err as Error).message}`);
      return true;
    }
  }

  /** Xoá kết quả đã nhớ để lần tra tiếp theo lấy trạng thái mới nhất */
  invalidate(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  /** Xoá toàn bộ bộ nhớ đệm — dùng khi khoá tài khoản hoặc thu hồi hàng loạt */
  invalidateAll(): void {
    this.cache.clear();
  }
}
