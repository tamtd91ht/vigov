import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, isValidObjectId } from 'mongoose';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  CitizenUser,
  type CitizenUserDocument,
  LoginSession,
  type LoginSessionDocument,
  SessionRegistry,
  StaffUser,
  type StaffUserDocument,
  checkPasswordPolicy,
  type JwtPayload,
} from '@vigov/shared';
import { UsersService } from '../users/users.service';
import { OtpStore } from './otp.store';

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

/**
 * Refresh token có dạng `<mã phiên>.<bí mật ngẫu nhiên>`.
 *
 * VÌ SAO GHÉP MÃ PHIÊN VÀO: bí mật được lưu dưới dạng băm bcrypt, mà bcrypt
 * không tra ngược được — không có phần mã phiên thì mỗi lần refresh phải quét
 * toàn bộ bảng phiên và so bcrypt với từng bản ghi. Phần mã phiên chỉ để TRA,
 * không phải để tin: bí mật vẫn phải khớp băm thì mới được cấp token mới.
 */
const REFRESH_TOKEN_SEPARATOR = '.';
/** 32 byte ngẫu nhiên — đủ để không thể dò, đủ ngắn để nằm gọn trong header */
const REFRESH_TOKEN_BYTES = 32;

/**
 * Thông điệp DUY NHẤT cho mọi nhánh refresh hỏng.
 *
 * Cùng lý do với LOGIN_FAILED_MESSAGE: tách riêng "phiên không tồn tại" với
 * "token sai" là biến chính thông điệp thành công cụ dò mã phiên hợp lệ.
 */
const REFRESH_FAILED_MESSAGE = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại';

/** Hạn dùng mặc định của refresh token khi REFRESH_EXPIRES_IN không đọc được */
const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Hạn dùng mặc định của access token khi JWT_EXPIRES_IN không đọc được */
const DEFAULT_ACCESS_TTL_SECONDS = 8 * 60 * 60;

/** Hệ số quy đổi hậu tố thời lượng kiểu jsonwebtoken ("8h", "7d", "30m") sang giây */
const DURATION_UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * "8h" → 28800. Nhận cả số trần ("3600" = 3600 giây, đúng quy ước jsonwebtoken).
 * Chuỗi không đọc được thì trả `fallback` — cấu hình sai không được làm sập
 * đăng nhập, nhưng phải có giá trị dự phòng rõ ràng thay vì NaN.
 */
export function parseDurationSeconds(value: string | undefined, fallback: number): number {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  const matched = /^(\d+)([smhd])?$/.exec(raw);
  if (!matched) return fallback;
  const amount = Number.parseInt(matched[1], 10);
  const unit = matched[2] ? DURATION_UNIT_SECONDS[matched[2]] : 1;
  return Number.isFinite(amount) && amount > 0 ? amount * unit : fallback;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
    @InjectModel(LoginSession.name) private readonly sessionModel: Model<LoginSessionDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionRegistry,
    private readonly otpStore: OtpStore,
    private readonly users: UsersService,
  ) {}

  /** Hạn dùng access token (giây) — đọc từ JWT_EXPIRES_IN */
  private get accessTtlSeconds(): number {
    return parseDurationSeconds(this.config.get<string>('auth.jwtExpiresIn'), DEFAULT_ACCESS_TTL_SECONDS);
  }

  /** Hạn dùng refresh token (giây) — đọc từ REFRESH_EXPIRES_IN */
  private get refreshTtlSeconds(): number {
    return parseDurationSeconds(this.config.get<string>('auth.refreshExpiresIn'), DEFAULT_REFRESH_TTL_SECONDS);
  }

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
      // Còn mật khẩu tạm thì token chỉ dùng được để đổi mật khẩu (JwtAuthGuard chặn phần còn lại)
      mustChangePassword: user.mustChangePassword || undefined,
    };

    // Vào được rồi thì xoá dấu vết các lần sai trước — 5 lượt lại đầy
    user.lastLoginAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.issueRefreshToken(sessionId),
      user: {
        username: user.username,
        displayName: user.displayName,
        initials: user.initials,
        color: user.color,
        department: user.department,
        roleKey: user.roleKey,
        /* Giao diện đọc cờ này để mở ngay ô đổi mật khẩu; việc CHẶN thì do
           JwtAuthGuard làm, không phụ thuộc giao diện có tử tế hay không. */
        mustChangePassword: user.mustChangePassword,
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
   * Gửi mã OTP định danh công dân (Zalo Mini App).
   * Phase 1 chỉ ghi log; gửi SMS/ZNS thật thuộc hệ số tích hợp bên ngoài.
   */
  async requestOtp(phone: string) {
    // randomInt của node:crypto — Math.random() không đủ khó đoán cho mã xác thực
    const code = String(randomInt(10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
    await this.otpStore.put(phone, code, OTP_TTL_MS);
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

    /* Một thông báo duy nhất cho mọi nhánh sai (không có mã / hết hạn / sai /
       hết lượt): phân biệt là chỉ điểm cho người dò biết số nào đang có mã sống. */
    const result = await this.otpStore.verify(phone, otp, OTP_MAX_ATTEMPTS);
    if (result !== 'ok') {
      if (result === 'exhausted') {
        this.logger.warn(
          `Huỷ mã OTP của ${phone} sau ${OTP_MAX_ATTEMPTS} lần nhập sai (IP ${ip || 'không rõ'})`,
        );
      }
      throw new UnauthorizedException('Mã xác thực không đúng hoặc đã hết hạn');
    }
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

    // Tài khoản bị quản trị viên xoá mềm coi như không còn tồn tại: bản ghi vẫn
    // nằm trong CSDL (upsert ở trên tìm thấy nó) nhưng không được cấp token mới
    if (citizen.isDeleted) {
      throw new UnauthorizedException('Tài khoản đã bị xoá. Vui lòng liên hệ UBND xã.');
    }

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
      refreshToken: await this.issueRefreshToken(sessionId),
      user: { phone, displayName: payload.displayName, area: citizen.area },
    };
  }

  /**
   * Cấp lại cặp token bằng refresh token, có XOAY VÒNG (T-09).
   *
   * Mỗi lần gọi sinh một bí mật mới và ghi đè băm cũ, nên refresh token vừa
   * dùng lập tức hết hiệu lực. Nếu ai đó gửi lại một token ĐÃ xoay vòng thì
   * hoặc token bị lộ, hoặc có người đang phát lại — cả hai đều phải xử lý như
   * nhau: thu hồi luôn phiên, buộc đăng nhập lại. Chấp nhận phiền cho người
   * dùng thật hơn là để một token đã lộ tiếp tục gia hạn vô hạn.
   *
   * Việc kiểm "phiên còn hiệu lực / chủ tài khoản còn hoạt động" giao cho
   * SessionRegistry — đúng cơ chế mà JwtAuthGuard đang dùng. Viết thêm một
   * đường kiểm tra riêng ở đây là mở đường cho hai chỗ lệch nhau.
   */
  async refresh(rawToken: string, ip: string, device: string) {
    const separator = rawToken.indexOf(REFRESH_TOKEN_SEPARATOR);
    const sessionId = separator > 0 ? rawToken.slice(0, separator) : '';
    const secret = separator > 0 ? rawToken.slice(separator + 1) : '';
    if (!sessionId || !secret || !isValidObjectId(sessionId)) {
      throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
    }

    // `refreshTokenHash` khai select:false nên phải xin tường minh
    const session = await this.sessionModel.findById(sessionId).select('+refreshTokenHash').exec();
    if (!session?.refreshTokenHash) {
      throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
    }

    // Phiên đã thu hồi, hoặc chủ tài khoản bị khoá / xoá mềm
    if (!(await this.sessions.isActive(sessionId))) {
      throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
    }

    if (!(await bcrypt.compare(secret, session.refreshTokenHash))) {
      await this.revokeSessionOnReuse(session, ip);
      throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
    }

    if (session.refreshExpiresAt && session.refreshExpiresAt.getTime() <= Date.now()) {
      /* Hết hạn refresh (7 ngày) thì access token 8 giờ đã chết từ lâu —
         đóng hẳn phiên để nó không nằm lại trong danh sách phiên đang mở. */
      await this.markRevoked(session);
      throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
    }

    const payload = await this.buildPayloadForSession(session.subject, session.kind, sessionId);

    session.lastActiveAt = new Date();
    if (ip) session.ip = ip;
    if (device) session.device = device;
    await session.save();

    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.issueRefreshToken(sessionId),
      expiresInSeconds: this.accessTtlSeconds,
    };
  }

  /**
   * Phiên đăng nhập của chính người đang gọi.
   *
   * Trả cả phiên đã thu hồi? KHÔNG — người dùng chỉ quan tâm thiết bị nào đang
   * đăng nhập được; phiên đã thu hồi là rác lịch sử, để lại chỉ gây hoang mang
   * ("sao tôi thấy 12 thiết bị?"). Nhật ký đầy đủ nằm ở trang Bảo mật của quản trị.
   */
  async listOwnSessions(username: string, currentSid?: string) {
    if (!username) return { items: [], total: 0 };
    const docs = await this.sessionModel
      .find({ subject: username, revoked: false })
      .sort({ lastActiveAt: -1 })
      .exec();
    return {
      items: docs.map((doc) => ({
        id: String(doc._id),
        kind: doc.kind,
        device: doc.device,
        ip: doc.ip,
        startedAt: doc.startedAt,
        lastActiveAt: doc.lastActiveAt,
        /* Phiên đang dùng để gọi chính lời gọi này — giao diện gắn nhãn
           "Thiết bị này" và không cho tự thu hồi. Suy theo `sid` trong token
           chứ không theo thời điểm, nên chính xác kể cả khi đăng nhập hai máy
           gần nhau. */
        current: currentSid !== undefined && String(doc._id) === currentSid,
      })),
      total: docs.length,
    };
  }

  /**
   * Đăng xuất một thiết bị cụ thể của chính mình.
   *
   * Chặn tự thu hồi phiên đang dùng: bấm vào sẽ tự đăng xuất chính mình giữa
   * lúc đang thao tác, mà nút "Đăng xuất" ở thanh trên cùng làm việc đó rõ ràng
   * hơn nhiều.
   */
  async revokeOwnSession(username: string, sessionId: string) {
    if (!username || !isValidObjectId(sessionId)) {
      throw new NotFoundException('Không tìm thấy phiên đăng nhập');
    }
    const doc = await this.sessionModel.findOne({ _id: sessionId, subject: username }).exec();
    // Phiên của người khác trả 404 y như phiên không tồn tại — không tiết lộ mã phiên có thật
    if (!doc) throw new NotFoundException('Không tìm thấy phiên đăng nhập');

    doc.revoked = true;
    await doc.save();
    // Xoá bộ nhớ đệm 10 giây, nếu không token của phiên vừa cắt còn sống thêm 10 giây
    this.sessions.invalidate(sessionId);
    return { id: sessionId, revoked: true };
  }

  /**
   * Cán bộ tự đổi mật khẩu của CHÍNH MÌNH.
   *
   * Thu hồi các phiên KHÁC (giữ lại phiên đang thao tác qua `exceptSessionId`)
   * bằng đúng cơ chế `UsersService.revokeOtherSessions` mà trang Bảo mật đang
   * dùng — cùng lý do với `changeStaffPassword`: người ta đổi mật khẩu thường
   * vì nghi bị lộ, để nguyên phiên cũ thì kẻ giữ token vẫn dùng tiếp 8 giờ.
   * Khác `changeStaffPassword` ở chỗ KHÔNG tự đá mình ra ngoài.
   */
  async changeOwnPassword(
    username: string,
    currentPassword: string,
    newPassword: string,
    exceptSessionId?: string,
  ) {
    /*
     * SAI MẬT KHẨU HIỆN TẠI TRẢ 400, KHÔNG PHẢI 401 — có lý do:
     * client coi 401 là "phiên hết hạn" và tự đăng xuất (xem `services/api.ts`
     * của Web Quản trị). Nếu nhánh này cũng trả 401 thì gõ sai mật khẩu một lần
     * là bị đá ra trang đăng nhập giữa lúc đang đổi mật khẩu, mà lỗi thật lại
     * không nói được với người dùng. Yêu cầu này ĐÃ mang token hợp lệ nên nó
     * không phải lỗi xác thực phiên; đây là dữ liệu vào không hợp lệ.
     */
    const user = await this.staffModel.findOne({ username }).select('+passwordHash').exec();
    if (!user) {
      // Tài khoản công dân không có mật khẩu — cũng rơi vào nhánh này
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      this.logger.warn(`Đổi mật khẩu thất bại cho ${username}: sai mật khẩu hiện tại`);
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    /*
     * Luật "không chứa tên đăng nhập" chỉ kiểm được ở đây: DTO không mang
     * username. Các luật còn lại đã chạy ở tầng DTO qua @IsStrongPassword.
     */
    const problem = checkPasswordPolicy(newPassword, { username });
    if (problem) throw new BadRequestException(problem);

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // Tự đặt mật khẩu xong thì tài khoản hết trạng thái "đang giữ mật khẩu tạm"
    const wasPending = user.mustChangePassword;
    user.mustChangePassword = false;
    await user.save();

    const { revoked } = await this.users.revokeOtherSessions(username, exceptSessionId);

    /*
     * Vừa thoát trạng thái mật khẩu tạm thì token đang cầm VẪN mang cờ cũ, mà
     * cờ đó nằm trong chữ ký JWT nên không sửa được — người dùng sẽ tiếp tục bị
     * guard chặn cho tới khi token hết hạn. Cấp luôn cặp token mới để họ dùng
     * được ngay; các trường hợp khác không cần nên không cấp, tránh đổi phiên
     * một cách vô ích.
     */
    if (!wasPending || !exceptSessionId) {
      return { updated: true, revokedSessions: revoked };
    }
    const payload = await this.buildPayloadForSession(username, 'web', exceptSessionId);
    return {
      updated: true,
      revokedSessions: revoked,
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.issueRefreshToken(exceptSessionId),
    };
  }

  /**
   * Sinh refresh token mới cho một phiên và ghi băm của nó xuống bản ghi phiên.
   * Ghi đè băm cũ chính là hành vi "vô hiệu token trước đó".
   */
  private async issueRefreshToken(sessionId: string): Promise<string> {
    const secret = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const refreshTokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    await this.sessionModel
      .updateOne({ _id: sessionId }, { $set: { refreshTokenHash, refreshExpiresAt } })
      .exec();

    return `${sessionId}${REFRESH_TOKEN_SEPARATOR}${secret}`;
  }

  /**
   * Phát hiện dùng lại refresh token đã xoay vòng — thu hồi cả phiên.
   * Nhật ký ghi mã phiên và IP để truy vết; TUYỆT ĐỐI không ghi token.
   */
  private async revokeSessionOnReuse(session: LoginSessionDocument, ip: string): Promise<void> {
    await this.markRevoked(session);
    this.logger.warn(
      `Refresh token đã bị xoay vòng lại được gửi cho phiên ${String(session._id)} từ ${ip || 'IP không xác định'} — ` +
        'đã thu hồi phiên. Nghi token bị lộ hoặc bị phát lại.',
    );
  }

  /** Đóng phiên và xoá bộ nhớ đệm để token hiện có mất hiệu lực ngay */
  private async markRevoked(session: LoginSessionDocument): Promise<void> {
    session.revoked = true;
    await session.save();
    this.sessions.invalidate(String(session._id));
  }

  /**
   * Dựng payload JWT mới từ dữ liệu HIỆN TẠI của chủ phiên.
   *
   * Đọc lại bản ghi thay vì chép payload cũ: vai trò và phòng ban có thể đã
   * đổi kể từ lần đăng nhập, mà JwtAuthGuard tin thẳng `roleKey` trong token.
   * Refresh mà giữ nguyên vai trò cũ là kéo dài vô hạn một quyền đã bị thu hồi.
   */
  private async buildPayloadForSession(subject: string, kind: string, sid: string): Promise<JwtPayload> {
    if (kind === 'web') {
      const staff = await this.staffModel.findOne({ username: subject }).exec();
      if (!staff || staff.status === 'locked') throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
      return {
        sub: String(staff._id),
        username: staff.username,
        displayName: staff.displayName,
        roleKey: staff.roleKey,
        department: staff.department,
        sid,
        mustChangePassword: staff.mustChangePassword || undefined,
      };
    }

    const citizen = await this.citizenModel.findOne({ phone: subject }).exec();
    if (!citizen || citizen.status === 'locked' || citizen.isDeleted) {
      throw new UnauthorizedException(REFRESH_FAILED_MESSAGE);
    }
    return {
      sub: String(citizen._id),
      username: citizen.phone,
      displayName: citizen.displayName || `Công dân ${citizen.phone.slice(-3)}`,
      roleKey: 'citizen',
      sid,
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
