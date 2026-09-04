import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomInt, timingSafeEqual } from 'node:crypto';
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

/** Điểm cuối Zalo Open API đổi mã dùng một lần lấy số điện thoại */
const ZALO_GRAPH_ME_INFO_URL = 'https://graph.zalo.me/v2.0/me/info';
/** Hạn chờ gọi Zalo — quá thì coi như thất bại, để công dân rẽ sang OTP */
const ZALO_GRAPH_TIMEOUT_MS = 8000;

/** Thân phản hồi của graph.zalo.me/v2.0/me/info */
interface ZaloMeInfoResponse {
  data?: { number?: string };
  error: number;
  message?: string;
}

/**
 * Đưa số Zalo trả về đúng dạng hệ thống đang lưu: 10 chữ số bắt đầu bằng 0.
 * Zalo trả kèm mã quốc gia ("84987654321") hoặc dạng "+84…"; hồ sơ công dân
 * trong Mongo lưu "0987654321" nên không quy đổi là tạo ra hai tài khoản khác
 * nhau cho cùng một người.
 */
export function normalizeVnPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
  return /^0\d{9}$/.test(local) ? local : null;
}

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

/**
 * Khoá tạm tài khoản cán bộ sau các lần đăng nhập sai liên tiếp (P4-36 bổ sung).
 *
 * VÌ SAO CẦN, dù đã có ThrottlerGuard: hạn mức 5 lượt/phút của nhóm auth đếm
 * theo ĐỊA CHỈ IP. Kẻ dò mật khẩu chỉ cần đổi IP là hạn mức reset, trong khi
 * tài khoản đích thì không đổi được — nên rải mật khẩu phổ biến lên toàn bộ
 * danh sách cán bộ vẫn chạy được. Bộ đếm theo tài khoản bịt đúng khe đó.
 *
 * 15 phút: đủ dài để phá tan tốc độ dò (5 lần / 15 phút ≈ 480 lần/ngày), đủ
 * ngắn để cán bộ gõ nhầm mật khẩu không phải gọi quản trị viên mở khoá.
 */
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

/**
 * Thông điệp DUY NHẤT cho mọi nhánh đăng nhập hỏng: sai tên, sai mật khẩu,
 * tài khoản bị khoá vĩnh viễn, hay đang khoá tạm.
 *
 * Nếu tách riêng câu "tài khoản đang bị khoá" thì chính nó thành công cụ dò
 * danh sách tài khoản: gõ sai 5 lần, thấy đổi thông điệp là biết tên đó có
 * thật. Đánh đổi: cán bộ bị khoá tạm không biết vì sao — bù lại khoá tự mở
 * sau 15 phút và máy chủ có ghi nhật ký mức warn để quản trị viên tra được.
 */
const LOGIN_FAILED_MESSAGE = 'Tài khoản hoặc mật khẩu không đúng';

/** Tài khoản có đang trong thời gian khoá tạm không */
export function isTemporarilyLocked(lockedUntil: Date | null | undefined, now = Date.now()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now;
}

/**
 * Trạng thái khoá sau MỘT lần đăng nhập sai.
 *
 * `attempts` là số lần sai liên tiếp ĐÃ TÍNH cả lần vừa rồi. Chạm ngưỡng thì
 * đặt hạn khoá và đưa bộ đếm về 0 — hết 15 phút, người dùng lại có trọn 5 lượt
 * chứ không phải bị khoá lại ngay ở lần sai kế tiếp.
 */
export function nextLockState(
  attempts: number,
  now = Date.now(),
): { failedLoginAttempts: number; lockedUntil: Date | null } {
  if (attempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
    return { failedLoginAttempts: 0, lockedUntil: new Date(now + LOGIN_LOCK_MS) };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null };
}

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
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
    }

    /* Kiểm tra khoá TRƯỚC khi so mật khẩu: đang khoá thì mật khẩu đúng cũng
       không vào được, và không tốn một lượt bcrypt cho mỗi request dò. */
    if (isTemporarilyLocked(user.lockedUntil)) {
      this.logger.warn(
        `Từ chối đăng nhập ${username} từ ${ip}: tài khoản đang khoá tạm tới ${user.lockedUntil?.toISOString()}`,
      );
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
    }

    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) {
      await this.registerFailedLogin(user, ip);
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
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

    // Vào được rồi thì xoá dấu vết các lần sai trước — 5 lượt lại đầy
    user.lastLoginAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
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
   * Ghi nhận một lần đăng nhập sai, khoá tạm tài khoản khi chạm ngưỡng.
   *
   * Tăng bộ đếm bằng `$inc` ngay dưới Mongo chứ không đọc-rồi-ghi: nhiều
   * request dò song song mà cộng trên bản sao trong bộ nhớ thì chúng ghi đè
   * lẫn nhau, 5 lần sai cùng lúc chỉ đếm thành 1 và khoá không bao giờ đóng.
   */
  private async registerFailedLogin(user: StaffUserDocument, ip: string): Promise<void> {
    const updated = await this.staffModel
      .findOneAndUpdate({ _id: user._id }, { $inc: { failedLoginAttempts: 1 } }, { new: true })
      .exec();

    const state = nextLockState(updated?.failedLoginAttempts ?? 1);
    if (!state.lockedUntil) return;

    await this.staffModel.updateOne({ _id: user._id }, { $set: state }).exec();
    this.logger.warn(
      `Khoá tạm tài khoản ${user.username} tới ${state.lockedUntil.toISOString()} — ` +
        `sai mật khẩu ${LOGIN_MAX_FAILED_ATTEMPTS} lần liên tiếp, lần cuối từ ${ip}`,
    );
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

  /**
   * Mã tạm thời khai trong CITIZEN_OTP_BYPASS_CODE có đang bật và có khớp không.
   *
   * VÌ SAO CÓ: Zalo chưa cấp quyền getPhoneNumber cho Mini App, mà mã OTP thật
   * hiện chỉ ghi vào nhật ký máy chủ (chưa nối SMS/ZNS) nên không ai định danh
   * được từ điện thoại. Đây là lối vào tạm cho giai đoạn thử nghiệm.
   *
   * So sánh bằng timingSafeEqual để thời gian đáp ứng không hé lộ dần từng ký
   * tự. Để trống biến môi trường là tắt hẳn — mặc định của cấu hình.
   *
   * KHÔNG ép độ dài tối thiểu: ô nhập OTP của Mini App cố định 6 chữ số
   * (maxLength=6, inputMode="numeric", lọc bỏ ký tự không phải số), nên mã dài
   * hơn thì không gõ vào đâu được. Thứ chặn dò mã ở đây là hạn mức 5 lượt/phút
   * mỗi IP của AUTH_THROTTLE, không phải độ dài.
   */
  private matchesFallbackCode(otp: string): boolean {
    const configured = (this.config.get<string>('auth.otpBypassCode') ?? '').trim();
    if (!configured) return false;

    const a = Buffer.from(configured);
    const b = Buffer.from(otp);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Xác thực OTP và cấp token cho công dân */
  async verifyOtp(phone: string, otp: string, ip: string, device: string) {
    if (this.matchesFallbackCode(otp)) {
      /* Ghi mức warn kèm số điện thoại và IP: đây là lối vào không qua xác
         thực thật, phải truy được ai đã dùng khi rà nhật ký. */
      this.logger.warn(
        `Định danh bằng mã tạm thời cho ${phone} từ ${ip} — xoá CITIZEN_OTP_BYPASS_CODE khi Zalo cấp quyền`,
      );
      return this.issueCitizenToken(phone, 'app', ip, device);
    }

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
  async identifyZalo(
    token: string,
    accessToken: string | undefined,
    zaloUserId: string | undefined,
    displayName: string | undefined,
    ip: string,
  ) {
    const phone = await this.exchangeZaloToken(token, accessToken);
    if (!phone) throw new UnauthorizedException('Không lấy được số điện thoại từ Zalo');

    const result = await this.issueCitizenToken(phone, 'zalo', ip, 'Zalo Mini App');
    if (zaloUserId || displayName) {
      await this.citizenModel
        .updateOne({ phone }, { $set: { zaloUserId, displayName: displayName ?? '' } })
        .exec();
    }
    return result;
  }

  /**
   * Đổi token Zalo lấy số điện thoại thật.
   *
   * SDK KHÔNG đưa số điện thoại thẳng cho Mini App — client không đáng tin. Nó
   * trả một mã dùng một lần; máy chủ cầm mã đó cùng khoá bí mật của ứng dụng
   * gọi sang Zalo, và Zalo mới là bên khẳng định số. Nhờ vậy không ai tự khai
   * được số của người khác.
   *
   * Cần ĐỦ BA thứ, thiếu một là Zalo từ chối:
   *   · access_token — phiên đăng nhập Zalo của chính người dùng
   *   · code         — mã dùng một lần từ getPhoneNumber()
   *   · secret_key   — ZALO_APP_SECRET, chỉ có ở máy chủ
   */
  private async exchangeZaloToken(token: string, accessToken: string | undefined): Promise<string | null> {
    const secret = this.config.get<string>('zalo.appSecret');
    if (!secret) {
      this.logger.warn('Chưa cấu hình ZALO_APP_SECRET — không đổi được token định danh');
      return null;
    }
    if (!accessToken) {
      this.logger.warn('Mini App không gửi access_token — Zalo sẽ từ chối đổi mã');
      return null;
    }

    /* Đặt hạn chờ: không có thì một lần Zalo treo là giữ luôn kết nối của công
       dân cho tới khi nginx cắt, người dùng nhìn thấy màn hình đứng im. */
    const abort = AbortSignal.timeout(ZALO_GRAPH_TIMEOUT_MS);

    try {
      const res = await fetch(ZALO_GRAPH_ME_INFO_URL, {
        method: 'GET',
        headers: { access_token: accessToken, code: token, secret_key: secret },
        signal: abort,
      });

      if (!res.ok) {
        this.logger.error(`Zalo trả HTTP ${res.status} khi đổi mã định danh`);
        return null;
      }

      const body = (await res.json()) as ZaloMeInfoResponse;

      /* Zalo trả HTTP 200 cả khi lỗi nghiệp vụ; `error` khác 0 mới là thất bại.
         Chỉ ghi mã và thông điệp, KHÔNG ghi token vào nhật ký. */
      if (body.error !== 0) {
        this.logger.error(`Zalo từ chối đổi mã định danh: [${body.error}] ${body.message ?? ''}`);
        return null;
      }

      const phone = normalizeVnPhone(body.data?.number);
      if (!phone) {
        this.logger.error('Zalo trả số điện thoại không đúng định dạng Việt Nam');
        return null;
      }
      return phone;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Không gọi được Zalo Graph API: ${reason}`);
      return null;
    }
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
