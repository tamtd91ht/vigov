import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TimelineStep, TimelineStepSchema } from './task.schema';

export type FeedbackDocument = HydratedDocument<Feedback>;

/**
 * Phiếu phản ánh của người dân (WBS #6/#13) — nguồn gửi từ app Flutter
 * hoặc Zalo Mini App; tên field khớp CitizenFeedback (admin-web)
 * và FeedbackTicket (mobile / zalo-miniapp).
 */
@Schema({ collection: 'feedbacks', timestamps: true })
export class Feedback {
  /** Mã phiếu hiển thị: #PA-2026-0141 */
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true, index: true })
  categoryKey: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  location: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  @Prop({ required: true })
  sentAt: string;

  @Prop({ enum: ['received', 'processing', 'resolved'], default: 'received', index: true })
  status: string;

  /** Mốc hết hạn SLA phục vụ CronJob cảnh báo (P3-30) */
  @Prop({ index: true })
  slaDueAt?: Date;

  /** Id ảnh hiện trường trong file storage (P3-24) */
  @Prop({ type: [String], default: [] })
  imageFileIds: string[];

  /** Ảnh sau xử lý do cán bộ cập nhật */
  @Prop({ type: [String], default: [] })
  resultImageFileIds: string[];

  @Prop({ required: true, index: true })
  citizenPhone: string;

  @Prop({ default: '' })
  citizenName: string;

  /** Kênh gửi: app Flutter hay Zalo Mini App */
  @Prop({ enum: ['app', 'zalo', 'web'], default: 'app' })
  channel: string;

  @Prop({ default: '', index: true })
  assignee: string;

  @Prop({ default: '', index: true })
  department: string;

  @Prop({ type: [TimelineStepSchema], default: [] })
  timeline: TimelineStep[];

  @Prop({ default: 0, min: 0, max: 5 })
  rating: number;

  @Prop()
  ratingComment?: string;

  /** Mã nhiệm vụ đã tạo từ phản ánh này (workflow P3-30) */
  @Prop()
  linkedTaskCode?: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
FeedbackSchema.index({ title: 'text', description: 'text' });
