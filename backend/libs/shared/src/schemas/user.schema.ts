import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StaffUserDocument = HydratedDocument<StaffUser>;
export type CitizenUserDocument = HydratedDocument<CitizenUser>;
export type LoginSessionDocument = HydratedDocument<LoginSession>;
export type BlacklistRecordDocument = HydratedDocument<BlacklistRecord>;

/** Tài khoản cán bộ đăng nhập Web Quản trị (WBS #9) */
@Schema({ collection: 'staff_users', timestamps: true })
export class StaffUser {
  @Prop({ required: true, unique: true, index: true })
  username: string;

  /** Mật khẩu đã băm — không bao giờ trả ra API */
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true })
  initials: string;

  @Prop({ required: true })
  color: string;

  @Prop({ required: true, index: true })
  department: string;

  /** Khoá vai trò trong roles.ts */
  @Prop({ required: true, index: true })
  roleKey: string;

  @Prop({ default: 'active', enum: ['active', 'locked'] })
  status: string;

  /**
   * Số lần đăng nhập sai LIÊN TIẾP. Về 0 ngay khi đăng nhập đúng.
   *
   * Khác `status: 'locked'` — đó là khoá vĩnh viễn do quản trị viên đặt tay.
   * Bộ đếm này phục vụ khoá TẠM tự mở, chống dò mật khẩu.
   */
  @Prop({ default: 0 })
  failedLoginAttempts: number;

  /**
   * Thời điểm hết khoá tạm; `null` là không bị khoá.
   *
   * Chặn theo tài khoản chứ không theo IP: hạn mức của ThrottlerGuard đếm theo
   * IP nên kẻ dò mật khẩu chỉ cần đổi IP là thoát, còn tài khoản thì không đổi.
   */
  /* Phải khai `type: Date` tay: @nestjs/mongoose đọc kiểu qua reflect-metadata,
     mà union `Date | null` thì metadata trả về Object nên nó không đoán được. */
  @Prop({ type: Date, default: null })
  lockedUntil?: Date | null;

  @Prop()
  lastLoginAt?: Date;

  /**
   * Đang giữ mật khẩu do hệ thống/quản trị viên đặt, PHẢI tự đổi trước khi dùng.
   *
   * Bật khi tạo tài khoản (mật khẩu tạm) và khi quản trị viên đặt lại mật khẩu —
   * hai trường hợp mà mật khẩu đã đi qua tay người khác (đọc trên màn hình, gửi
   * qua tin nhắn). Cờ này vào payload JWT, và `JwtAuthGuard` chặn mọi endpoint
   * trừ đường đổi mật khẩu cho tới khi người dùng tự đặt mật khẩu mới.
   */
  @Prop({ default: false })
  mustChangePassword: boolean;
}
export const StaffUserSchema = SchemaFactory.createForClass(StaffUser);

/** Công dân dùng Zalo Mini App (WBS #11) */
@Schema({ collection: 'citizen_users', timestamps: true })
export class CitizenUser {
  @Prop({ required: true, unique: true, index: true })
  phone: string;

  @Prop({ default: '' })
  displayName: string;

  @Prop({ default: '' })
  area: string;

  /**
   * Kênh định danh. `'app'` là DI SẢN của app Flutter (module `mobile/` đã bỏ
   * 09/09/2026) — giữ trong enum vì tài khoản cũ đang dùng; tài khoản mới vào
   * bằng `'zalo'`.
   */
  @Prop({ enum: ['app', 'zalo'], default: 'app' })
  channel: string;

  @Prop()
  zaloUserId?: string;

  @Prop({ default: 0 })
  feedbackCount: number;

  @Prop({ default: 'active', enum: ['active', 'locked'], index: true })
  status: string;

  @Prop()
  lockReason?: string;

  /** Token nhận thông báo đẩy (FCM/APNs) */
  @Prop({ type: [String], default: [] })
  pushTokens: string[];

  /**
   * Thời điểm vô danh hoá theo yêu cầu rút đồng ý của chủ thể dữ liệu
   * (NĐ 13/2023), nhận qua webhook Zalo. Có giá trị nghĩa là bản ghi đã bị bỏ
   * hết trường nhận dạng — giữ lại vỏ để không phá tham chiếu từ hồ sơ và
   * phản ánh mà xã có nghĩa vụ lưu trữ.
   */
  @Prop()
  erasedAt?: Date;

  /**
   * Thời điểm bị QUẢN TRỊ VIÊN xoá mềm trên Web Quản trị; `null` là chưa xoá.
   *
   * Không xoá hẳn tài liệu vì số điện thoại là khoá liên kết tới hồ sơ một cửa
   * và phản ánh đã gửi — xoá cứng là mất tham chiếu của dữ liệu xã phải lưu.
   * Bản ghi đã xoá bị ẩn khỏi mọi danh sách và KHÔNG đăng nhập lại được, nhưng
   * dữ liệu vẫn nguyên trong CSDL và khôi phục được từ bộ lọc "Đã xoá".
   *
   * Khác `erasedAt`: đó là vô danh hoá theo yêu cầu rút đồng ý của chính chủ
   * thể dữ liệu (NĐ 13/2023), có xoá thật các trường nhận dạng.
   */
  /* Phải khai `type: Date` tay vì union `Date | null` làm reflect-metadata trả về Object */
  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;

  /** Tên đăng nhập cán bộ đã xoá — để truy vết cùng nhật ký kiểm toán */
  @Prop()
  deletedBy?: string;

  /** Lý do xoá (tuỳ chọn), hiển thị lại ở bộ lọc "Đã xoá" */
  @Prop()
  deleteReason?: string;
}
export const CitizenUserSchema = SchemaFactory.createForClass(CitizenUser);

/** Phiên đăng nhập đang hoạt động (WBS #11) */
@Schema({ collection: 'login_sessions', timestamps: true })
export class LoginSession {
  @Prop({ required: true, index: true })
  subject: string;

  @Prop({ enum: ['web', 'app', 'zalo'], required: true, index: true })
  kind: string;

  @Prop({ default: '' })
  device: string;

  @Prop({ default: '' })
  ip: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true })
  lastActiveAt: Date;

  @Prop({ default: false })
  revoked: boolean;

  /**
   * BĂM (bcrypt) của refresh token đang có hiệu lực cho phiên này — T-09.
   *
   * Lưu băm chứ không lưu token thô: bảng `login_sessions` đọc được bởi mọi
   * thứ chạm tới cơ sở dữ liệu (backup, công cụ quản trị, kết xuất sự cố), mà
   * refresh token thô cầm được là mở lại phiên trong suốt 7 ngày.
   *
   * `select: false` để mọi truy vấn danh sách phiên không vô tình kéo trường
   * này ra — chỉ luồng xoay vòng token mới đọc, và đọc tường minh.
   *
   * Mỗi lần refresh, trường này bị GHI ĐÈ bằng băm của token mới; nhờ vậy
   * token cũ lập tức hết hiệu lực, và ai gửi lại token cũ là dấu hiệu token đã
   * bị lộ (AuthService thu hồi luôn cả phiên khi gặp).
   */
  @Prop({ select: false })
  refreshTokenHash?: string;

  /** Hạn dùng của refresh token hiện tại (REFRESH_EXPIRES_IN) */
  @Prop()
  refreshExpiresAt?: Date;
}
export const LoginSessionSchema = SchemaFactory.createForClass(LoginSession);

/** Bản ghi chặn công dân / thiết bị / IP (WBS #11, P3-31) */
@Schema({ collection: 'blacklist_records', timestamps: true })
export class BlacklistRecord {
  @Prop({ required: true, index: true })
  subject: string;

  @Prop({ enum: ['citizen', 'device', 'ip'], required: true })
  kind: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ required: true })
  by: string;

  @Prop({ default: true, index: true })
  active: boolean;
}
export const BlacklistRecordSchema = SchemaFactory.createForClass(BlacklistRecord);
