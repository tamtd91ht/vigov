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

  @Prop()
  lastLoginAt?: Date;
}
export const StaffUserSchema = SchemaFactory.createForClass(StaffUser);

/** Công dân dùng app Flutter / Zalo Mini App (WBS #11) */
@Schema({ collection: 'citizen_users', timestamps: true })
export class CitizenUser {
  @Prop({ required: true, unique: true, index: true })
  phone: string;

  @Prop({ default: '' })
  displayName: string;

  @Prop({ default: '' })
  area: string;

  /** Kênh định danh: app Flutter hay Zalo Mini App */
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
