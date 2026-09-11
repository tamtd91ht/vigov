import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ActivityEntry, ActivityEntrySchema } from './activity-log';
import { applyEpochTimestamps } from './timestamped';
import { SoftDeletable } from './soft-delete';

export type IncomingDocumentDocument = HydratedDocument<IncomingDocument>;

/** Trường được OCR trích xuất, cán bộ xác nhận (WBS #4) */
@Schema({ _id: false })
export class OcrField {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  label: string;

  @Prop({ default: '' })
  value: string;

  @Prop({ default: false })
  confirmed: boolean;

  /** Độ tin cậy do OCR provider trả về (0..1) */
  @Prop({ default: 0 })
  confidence: number;
}
export const OcrFieldSchema = SchemaFactory.createForClass(OcrField);

/**
 * Văn bản đến / Đơn thư công dân (WBS #4)
 * — tên field khớp admin-web/src/types IncomingDocument.
 *
 * Kế thừa `SoftDeletable`: sổ văn bản đến là hồ sơ pháp lý — số đến đã cấp phải
 * giữ nguyên vết, nhật ký xử lý và bản scan còn là bằng chứng phục vụ thanh tra,
 * mà nhiệm vụ sinh từ văn bản đã dẫn chiếu ngược lại qua `sourceRefId`. Xoá cứng
 * là để lại lỗ trong sổ và liên kết chết.
 */
@Schema({ collection: 'documents' })
export class IncomingDocument extends SoftDeletable {
  /** Số đến trong sổ văn bản */
  @Prop({ required: true, index: true })
  arrivalNo: string;

  /** Số ký hiệu văn bản gốc */
  @Prop({ required: true })
  refNo: string;

  /** Ngày ký trên văn bản của cơ quan gửi — milli-giây UTC */
  @Prop({ required: true })
  date: number;

  @Prop({ required: true })
  sender: string;

  @Prop({ required: true })
  summary: string;

  /**
   * Hạn xử lý — milli-giây UTC, chuẩn hoá về hết ngày giờ Việt Nam.
   * **BỎ TRỐNG** khi văn bản chưa ấn định hạn: form "Tiếp nhận văn bản" cho
   * phép vào sổ trước, ấn định hạn sau.
   *
   * Để `undefined` chứ KHÔNG dùng `0` làm giá trị rỗng: `0` là 01/01/1970 nên
   * mọi chỗ so hạn sẽ coi văn bản chưa có hạn là quá hạn 56 năm, và cron nhắc
   * hạn sẽ dội cảnh báo cho toàn bộ số văn bản chưa ấn định hạn.
   *
   * v1 lưu hai trường cho cùng một cái hạn (`deadline` chuỗi + `deadlineAt`
   * Date); v2 giữ một trường — xem chú thích ở `task.schema.ts`.
   */
  @Prop({ index: true })
  deadline?: number;

  @Prop({ default: 0 })
  daysLeft: number;

  @Prop({ required: true, index: true })
  department: string;

  @Prop({ enum: ['moi', 'dangxl', 'choduyet', 'xong'], default: 'moi', index: true })
  status: string;

  @Prop({ required: true })
  docType: string;

  /** Phân loại nguồn: văn bản đến hay đơn thư công dân */
  @Prop({ enum: ['incoming', 'petition'], default: 'incoming', index: true })
  kind: string;

  @Prop({ default: 'Thường' })
  confidentiality: string;

  @Prop({ default: 'Thường' })
  urgency: string;

  @Prop({ default: '' })
  signer: string;

  @Prop({ default: 1 })
  pageCount: number;

  /** Id tệp bản scan trong file storage (P3-24) */
  @Prop()
  scanFileId?: string;

  /**
   * Tệp đính kèm khác ngoài bản scan chính (phụ lục, biên bản, tờ trình).
   *
   * Tách khỏi `scanFileId` vì bản scan là văn bản gốc dùng cho OCR, còn đây là
   * tài liệu kèm theo — cùng bộ với `Task.attachmentFileIds`, và cũng bắt buộc
   * là tệp riêng tư (SECURITY.md TB-09).
   */
  @Prop({ type: [String], default: [] })
  attachmentFileIds: string[];

  @Prop({ type: [OcrFieldSchema], default: [] })
  ocrFields: OcrField[];

  @Prop({ type: [ActivityEntrySchema], default: [] })
  timeline: ActivityEntry[];

  /** Mã nhiệm vụ đã tạo từ văn bản này (workflow P3-30) */
  @Prop()
  linkedTaskCode?: string;
}

export const IncomingDocumentSchema = SchemaFactory.createForClass(IncomingDocument);
applyEpochTimestamps(IncomingDocumentSchema);
IncomingDocumentSchema.index({ summary: 'text', refNo: 'text', sender: 'text' });
