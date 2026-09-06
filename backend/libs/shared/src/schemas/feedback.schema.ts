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

  /**
   * Số điện thoại người phản ánh.
   *
   * KHÔNG còn `required`: phiếu do cán bộ lập hộ người dân đến trực tiếp
   * (`source: 'offline'`, WBS #6) có thể không có số điện thoại — người dân
   * trình bày tại trụ sở rồi về, không phải ai cũng để lại số. Mongoose coi
   * chuỗi rỗng là VI PHẠM `required`, nên để `required: true` thì cả luồng
   * tiếp nhận trực tiếp không tạo được phiếu.
   */
  @Prop({ default: '', index: true })
  citizenPhone: string;

  @Prop({ default: '' })
  citizenName: string;

  /** Thôn / tổ dân phố của người phản ánh (cán bộ ghi khi lập phiếu trực tiếp) */
  @Prop({ default: '' })
  area: string;

  /** Kênh gửi: app Flutter hay Zalo Mini App */
  @Prop({ enum: ['app', 'zalo', 'web'], default: 'app' })
  channel: string;

  /**
   * Nguồn phiếu — phân biệt hai đường vào của WBS #6:
   *   • 'app'     — công dân TỰ gửi qua app Flutter / Zalo Mini App;
   *   • 'offline' — cán bộ lập hộ người dân đến trình bày trực tiếp tại xã.
   *
   * Mặc định 'app' để mọi phiếu tạo trước khi có trường này vẫn phân loại
   * đúng (chúng đều do công dân tự gửi).
   *
   * Tách riêng khỏi `channel`: `channel` nói phiếu tới qua thiết bị nào, còn
   * trường này nói AI đã lập phiếu — hai câu hỏi khác nhau, và báo cáo tiếp
   * nhận trực tiếp cần đúng câu thứ hai.
   */
  @Prop({ enum: ['app', 'offline'], default: 'app', index: true })
  source: string;

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
