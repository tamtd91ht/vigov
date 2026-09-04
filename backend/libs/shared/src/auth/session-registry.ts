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

/**
 * Tình trạng của chính cơ chế thu hồi, để hệ giám sát nhìn thấy.
 *
 * VÌ SAO CẦN: cả hai nhánh hỏng của `isActive` đều FAIL-OPEN (cho token đi
 * tiếp). Đó là lựa chọn có chủ ý — không để một trục trặc tra cứu làm sập
 * đăng nhập toàn hệ. Nhưng fail-open mà im lặng thì cơ chế thu hồi có thể
 * chết hàng tháng không ai hay. Trạng thái này được `/health/ready` báo ra.
 */
export interface SessionRegistryStatus {
  /** Đã có nguồn tra cứu thật chưa; false nghĩa là MỌI phiên đều được cho qua */
  resolverRegistered: boolean;
  /** Số lần tra cứu hỏng liên tiếp gần đây */
  consecutiveFailures: number;
  /** Nguyên văn lỗi tra cứu gần nhất */
  lastError: string;
}

@Injectable()
export class SessionRegistry {
  private readonly logger = new Logger(SessionRegistry.name);
  private readonly cache = new Map<string, { state: SessionState; expiresAt: number }>();
  private resolver: SessionResolver | null = null;
  private consecutiveFailures = 0;
  private lastError = '';
  private warnedMissingResolver = false;

  /** Module Users gọi khi khởi động để cung cấp cách tra cứu phiên trong cơ sở dữ liệu */
  registerResolver(resolver: SessionResolver): void {
    this.resolver = resolver;
  }

  /** Tình trạng cơ chế thu hồi — `/health/ready` đọc để hệ giám sát thấy được */
  getStatus(): SessionRegistryStatus {
    return {
      resolverRegistered: this.resolver !== null,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
    };
  }

  /**
   * Phiên còn dùng được không.
   * Chưa đăng ký resolver (ví dụ trong test) thì mặc định cho qua để không chặn nhầm.
   */
  async isActive(sessionId: string): Promise<boolean> {
    if (!this.resolver) {
      /* Cảnh báo MỘT lần, không mỗi request: chưa có nguồn tra cứu nghĩa là
         toàn bộ cơ chế thu hồi phiên đang tắt, mọi token đều được cho qua. Ở
         test thì đúng là mong muốn; trên máy chủ thật thì là sự cố nghiêm trọng
         và không được im lặng. */
      if (!this.warnedMissingResolver) {
        this.warnedMissingResolver = true;
        this.logger.error(
          'Chưa đăng ký nguồn tra cứu phiên — thu hồi phiên và khoá tài khoản ĐANG KHÔNG CÓ HIỆU LỰC',
        );
      }
      return true;
    }

    const cached = this.cache.get(sessionId);
    if (cached && cached.expiresAt > Date.now()) {
      return !cached.state.revoked && !cached.state.subjectLocked;
    }

    try {
      const state = await this.resolver(sessionId);
      // Không tìm thấy phiên (đã bị xoá) thì coi như đã thu hồi
      const resolved: SessionState = state ?? { revoked: true, subjectLocked: false };
      this.cache.set(sessionId, { state: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
      this.consecutiveFailures = 0;
      this.lastError = '';
      return !resolved.revoked && !resolved.subjectLocked;
    } catch (err) {
      /*
       * FAIL-OPEN có chủ ý: lỗi tra cứu không được làm sập xác thực toàn hệ.
       *
       * Nhưng phải hét lên. Trong khoảng thời gian này, phiên ĐÃ THU HỒI và tài
       * khoản ĐÃ KHOÁ vẫn đi lọt — nên đây là mức `error`, không phải `warn`:
       * `warn` lẫn vào nhật ký thường ngày, và cơ chế thu hồi có thể chết âm
       * thầm hàng tháng. `/health/ready` cũng báo ra con số này.
       */
      this.consecutiveFailures += 1;
      this.lastError = (err as Error).message;
      this.logger.error(
        `Không tra được trạng thái phiên ${sessionId} (lần hỏng liên tiếp thứ ${this.consecutiveFailures}) — ` +
          `token đang được CHO QUA mà không kiểm thu hồi: ${this.lastError}`,
      );
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
