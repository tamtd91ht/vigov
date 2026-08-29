import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  CitizenUser,
  type CitizenUserDocument,
  LoginSession,
  type LoginSessionDocument,
  StaffUser,
  type StaffUserDocument,
  type JwtPayload,
} from '@vigov/shared';

/** Hiệu lực mã OTP định danh công dân */
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

/**
 * Số lần nhập sai tối đa cho mỗi mã OTP (P4-36).
 * Mã chỉ có 6 chữ số nên nếu cho nhập sai không giới hạn thì kẻ xấu dò hết
 * 10^6 khả năng trong vòng đời 5 phút của mã. Sai quá ngưỡng thì huỷ mã,
 * buộc yêu cầu mã mới.
 */
const OTP_MAX_ATTEMPTS = 5;

interface OtpEntry {
  code: string;
  expiresAt: number;
  /** Số lần đã nhập sai */
  attempts: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Kho OTP tạm trong bộ nhớ — đủ cho Phase 1 (1 tiến trình).
   * Khi chạy nhiều instance: chuyển sang Redis.
   */
  private readonly otpStore = new Map<string, OtpEntry>();

  constructor(
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
    @InjectModel(LoginSession.name) private readonly sessionModel: Model<LoginSessionDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Đăng nhập cán bộ Web Quản trị */
  async staffLogin(username: string, password: string, ip: string, device: string) {
    const user = await this.staffModel.findOne({ username }).select('+passwordHash').exec();
    if (!user || user.status === 'locked') {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }
    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }

    // Tạo phiên trước để lấy mã phiên nhúng vào token — nhờ đó thu hồi được trước hạn
    const sessionId = await this.recordSession(user.username, 'web', ip, device);

    const payload: JwtPayload = {
      sub: String(user._id),
      username: user.username,
      displayName: user.displayName,
      roleKey: user.roleKey,
      department: user.department,
      sid: sessionId,
    };

    user.lastLoginAt = new Date();
    await user.save();

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        username: user.username,
        displayName: user.displayName,
        initials: user.initials,
        color: user.color,
        department: user.department,
        roleKey: user.roleKey,
      },
    };
  }

  /**
   * Gửi mã OTP định danh công dân (app Flutter).
   * Phase 1 chỉ ghi log; gửi SMS/ZNS thật thuộc hệ số tích hợp bên ngoài.
   */
  async requestOtp(phone: string) {
    // randomInt của node:crypto — Math.random() không đủ khó đoán cho mã xác thực
    const code = String(randomInt(10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
    this.otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
    this.logger.log(`Mã OTP cho ${phone}: ${code} (Phase 1 chưa gửi SMS/ZNS thật)`);
    return { sent: true, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  /** Xác thực OTP và cấp token cho công dân */
  async verifyOtp(phone: string, otp: string, ip: string, device: string) {
    const entry = this.otpStore.get(phone);
    if (!entry || entry.expiresAt < Date.now()) {
      this.otpStore.delete(phone);
      throw new UnauthorizedException('Mã xác thực không đúng hoặc đã hết hạn');
    }
    if (entry.code !== otp) {
      entry.attempts += 1;
      // Sai quá ngưỡng thì huỷ mã, buộc công dân yêu cầu mã mới
      if (entry.attempts >= OTP_MAX_ATTEMPTS) this.otpStore.delete(phone);
      throw new UnauthorizedException('Mã xác thực không đúng hoặc đã hết hạn');
    }
    this.otpStore.delete(phone);
    return this.issueCitizenToken(phone, 'app', ip, device);
  }

  /**
   * Định danh công dân qua Zalo Mini App.
   * Token do SDK trả về được đổi sang số điện thoại tại Zalo Open API —
   * kết nối thật thuộc hệ số tích hợp bên ngoài (câu hỏi mở #3).
   */
  async identifyZalo(token: string, zaloUserId: string | undefined, displayName: string | undefined, ip: string) {
    const phone = await this.exchangeZaloToken(token);
    if (!phone) throw new UnauthorizedException('Không lấy được số điện thoại từ Zalo');

    const result = await this.issueCitizenToken(phone, 'zalo', ip, 'Zalo Mini App');
    if (zaloUserId || displayName) {
      await this.citizenModel
        .updateOne({ phone }, { $set: { zaloUserId, displayName: displayName ?? '' } })
        .exec();
    }
    return result;
  }

  /** Đổi token Zalo lấy số điện thoại — hiện trả null khi chưa cấu hình OA */
  private async exchangeZaloToken(token: string): Promise<string | null> {
    const secret = this.config.get<string>('zalo.appSecret');
    if (!secret) {
      this.logger.warn('Chưa cấu hình ZALO_APP_SECRET — bỏ qua đổi token định danh');
      return null;
    }
    // Thật: POST https://graph.zalo.me/v2.0/me/info với access_token + code
    void token;
    return null;
  }

  private async issueCitizenToken(phone: string, channel: 'app' | 'zalo', ip: string, device: string) {
    const citizen = await this.citizenModel
      .findOneAndUpdate(
        { phone },
        { $setOnInsert: { phone, channel, status: 'active' } },
        { new: true, upsert: true },
      )
      .exec();

    if (citizen.status === 'locked') {
      throw new UnauthorizedException('Tài khoản đã bị khoá. Vui lòng liên hệ UBND xã.');
    }

    const sessionId = await this.recordSession(phone, channel, ip, device);

    const payload: JwtPayload = {
      sub: String(citizen._id),
      username: phone,
      displayName: citizen.displayName || `Công dân ${phone.slice(-3)}`,
      roleKey: 'citizen',
      sid: sessionId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { phone, displayName: payload.displayName, area: citizen.area },
    };
  }

  /** Ghi phiên đăng nhập và trả mã phiên để nhúng vào token (P5-08) */
  private async recordSession(subject: string, kind: string, ip: string, device: string): Promise<string> {
    const now = new Date();
    const session = await this.sessionModel.create({
      subject,
      kind,
      ip,
      device,
      startedAt: now,
      lastActiveAt: now,
    });
    return String(session._id);
  }

  /** Tạo tài khoản cán bộ (dùng cho seed và trang Cấu hình) */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }
}
