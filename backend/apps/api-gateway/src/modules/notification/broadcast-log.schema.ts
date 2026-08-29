import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { NotificationChannel } from '@vigov/shared';

export type BroadcastLogDocument = HydratedDocument<BroadcastLog>;

/** Trạng thái một lượt gửi hàng loạt, suy từ số người nhận thành công */
export const BROADCAST_STATUSES = ['sent', 'partial', 'failed'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/**
 * Nhật ký các lượt gửi thông báo hàng loạt (WBS #23).
 * Schema CỤC BỘ của module Notification — cố tình KHÔNG đưa vào libs/shared
 * vì chỉ module này đọc/ghi, giống schema `Notification`.
 * Không lưu danh sách người nhận: chỉ cần con số tổng hợp cho màn hình lịch sử,
 * lưu SĐT ở đây là nhân bản dữ liệu cá nhân không cần thiết.
 */
@Schema({ collection: 'broadcast_logs', timestamps: true })
export class BroadcastLog {
  /** Các kênh đã chọn khi gửi: zns / push / inapp */
  @Prop({ type: [String], required: true })
  channels: NotificationChannel[];

  /** Nhóm đối tượng: công dân hay nội bộ cán bộ */
  @Prop({ required: true, enum: ['citizen', 'internal'], index: true })
  audience: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  body: string;

  /** Username cán bộ bấm gửi */
  @Prop({ required: true, index: true })
  sentBy: string;

  /** Tổng số người nhận đã giải ra được */
  @Prop({ default: 0 })
  total: number;

  /** Số người nhận có ít nhất một kênh gửi thành công */
  @Prop({ default: 0 })
  delivered: number;

  @Prop({ default: 0 })
  failed: number;

  @Prop({ required: true, enum: BROADCAST_STATUSES })
  status: string;

  /** Do `timestamps: true` tự gán — khai báo tường minh để truy vấn/sắp xếp có kiểu */
  @Prop({ index: true })
  createdAt: Date;
}

export const BroadcastLogSchema = SchemaFactory.createForClass(BroadcastLog);
/** Màn hình lịch sử luôn lọc theo nhóm đối tượng + mới nhất trước */
BroadcastLogSchema.index({ audience: 1, createdAt: -1 });
