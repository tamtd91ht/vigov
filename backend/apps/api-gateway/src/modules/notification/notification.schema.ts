import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

/**
 * Thông báo in-app (WBS #23) — schema CỤC BỘ của module Notification,
 * cố tình KHÔNG đưa vào libs/shared vì chỉ module này đọc/ghi.
 * `recipient` là username cán bộ (Web Quản trị) hoặc SĐT công dân (app/Zalo).
 */
@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipient: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  body: string;

  /** Dữ liệu kèm theo để FE điều hướng: { feedbackCode, taskCode... } */
  @Prop({ type: Object, default: {} })
  data: Record<string, string>;

  @Prop({ default: false, index: true })
  read: boolean;

  /** Do `timestamps: true` tự gán — khai báo tường minh để truy vấn/sắp xếp có kiểu */
  @Prop({ index: true })
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
/** Hộp thông báo luôn đọc theo người nhận + mới nhất trước */
NotificationSchema.index({ recipient: 1, createdAt: -1 });
