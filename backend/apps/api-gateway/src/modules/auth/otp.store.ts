import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Model } from 'mongoose';
import { OtpCode, type OtpCodeDocument } from './otp.schema';

/**
 * Kho mã OTP định danh công dân (SECURITY.md TB-08).
 *
 * Hai driver, chọn bằng biến môi trường `OTP_STORE`:
 *
 * | `memory` (mặc định) | Map trong bộ nhớ tiến trình. Đủ và nhanh nhất khi chạy MỘT instance |
 * | `mongo`             | Bảng `otp_codes` có TTL index. BẮT BUỘC khi chạy nhiều instance |
 *
 * VÌ SAO KHÔNG DÙNG MONGO CHO CẢ HAI: phần lớn triển khai cấp xã chỉ một
 * instance, ở đó driver bộ nhớ tránh được hai lượt vào ra CSDL cho mỗi lần định
 * danh mà không mất gì. Nhưng để mặc định là bộ nhớ thì phải có đường đổi rõ
 * ràng, nếu không ngày mở thêm instance sẽ không ai nhớ chỗ này.
 *
 * MỌI ĐƯỜNG ĐỀU KHÔNG LƯU MÃ DẠNG RÕ: cả hai driver chỉ giữ HMAC của mã.
 */

/** Kết quả xác thực một mã OTP — service dịch sang thông báo cho người dùng */
export type OtpVerifyResult = 'ok' | 'missing' | 'expired' | 'wrong' | 'exhausted';

/** Khoá HMAC khi chưa cấu hình `JWT_SECRET` (chỉ xảy ra ở môi trường phát triển) */
const FALLBACK_HMAC_KEY = 'vigov-otp-fallback-key';

interface MemoryEntry {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class OtpStore {
  private readonly logger = new Logger(OtpStore.name);

  /** Chỉ dùng khi driver là `memory` */
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(
    @InjectModel(OtpCode.name) private readonly otpModel: Model<OtpCodeDocument>,
    private readonly config: ConfigService,
  ) {
    if (this.driver === 'mongo') {
      this.logger.log('Kho OTP dùng MongoDB (chạy được nhiều instance)');
    }
  }

  private get driver(): 'memory' | 'mongo' {
    const configured = (this.config.get<string>('auth.otpStore') ?? 'memory').trim().toLowerCase();
    if (configured === 'mongo') return 'mongo';
    if (configured !== 'memory') {
      this.logger.warn(`OTP_STORE="${configured}" không hợp lệ — dùng kho trong bộ nhớ`);
    }
    return 'memory';
  }

  /** HMAC của mã: cùng một mã luôn cho cùng chuỗi băm, độ dài cố định */
  private hash(code: string): string {
    const key = this.config.get<string>('auth.jwtSecret') ?? FALLBACK_HMAC_KEY;
    return createHmac('sha256', key).update(code).digest('hex');
  }

  /** So chuỗi băm theo thời gian hằng — tránh rò rỉ qua thời gian phản hồi */
  private matches(expected: string, actual: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(actual);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Ghi mã mới cho một số điện thoại, ghi đè mã cũ nếu còn */
  async put(phone: string, code: string, ttlMs: number): Promise<void> {
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + ttlMs);

    if (this.driver === 'memory') {
      this.memory.set(phone, { codeHash, expiresAt: expiresAt.getTime(), attempts: 0 });
      return;
    }
    await this.otpModel
      .findOneAndUpdate(
        { phone },
        { $set: { codeHash, expiresAt, attempts: 0 } },
        { upsert: true, new: true },
      )
      .exec();
  }

  /**
   * Xác thực rồi TIÊU HUỶ mã nếu đúng (mã dùng một lần).
   *
   * Nhập sai thì tăng bộ đếm; chạm `maxAttempts` là xoá luôn mã — người dùng
   * phải xin mã mới, nhờ đó không dò được hết 10⁶ khả năng bằng một mã.
   */
  async verify(phone: string, code: string, maxAttempts: number): Promise<OtpVerifyResult> {
    const codeHash = this.hash(code);

    if (this.driver === 'memory') {
      const entry = this.memory.get(phone);
      if (!entry) return 'missing';
      if (entry.expiresAt <= Date.now()) {
        this.memory.delete(phone);
        return 'expired';
      }
      if (!this.matches(entry.codeHash, codeHash)) {
        entry.attempts += 1;
        if (entry.attempts >= maxAttempts) {
          this.memory.delete(phone);
          return 'exhausted';
        }
        return 'wrong';
      }
      this.memory.delete(phone);
      return 'ok';
    }

    const doc = await this.otpModel.findOne({ phone }).exec();
    if (!doc) return 'missing';
    if (doc.expiresAt.getTime() <= Date.now()) {
      await doc.deleteOne();
      return 'expired';
    }
    if (!this.matches(doc.codeHash, codeHash)) {
      doc.attempts += 1;
      if (doc.attempts >= maxAttempts) {
        await doc.deleteOne();
        return 'exhausted';
      }
      await doc.save();
      return 'wrong';
    }
    await doc.deleteOne();
    return 'ok';
  }

  /** Xoá mã của một số điện thoại (dùng khi định danh thành công bằng đường khác) */
  async clear(phone: string): Promise<void> {
    if (this.driver === 'memory') {
      this.memory.delete(phone);
      return;
    }
    await this.otpModel.deleteOne({ phone }).exec();
  }
}
