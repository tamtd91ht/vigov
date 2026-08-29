import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TimelineStep, TimelineStepSchema } from './task.schema';

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
 */
@Schema({ collection: 'documents', timestamps: true })
export class IncomingDocument {
  /** Số đến trong sổ văn bản */
  @Prop({ required: true, index: true })
  arrivalNo: string;

  /** Số ký hiệu văn bản gốc */
  @Prop({ required: true })
  refNo: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  sender: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ required: true })
  deadline: string;

  @Prop({ index: true })
  deadlineAt?: Date;

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

  @Prop({ type: [OcrFieldSchema], default: [] })
  ocrFields: OcrField[];

  @Prop({ type: [TimelineStepSchema], default: [] })
  timeline: TimelineStep[];

  /** Mã nhiệm vụ đã tạo từ văn bản này (workflow P3-30) */
  @Prop()
  linkedTaskCode?: string;
}

export const IncomingDocumentSchema = SchemaFactory.createForClass(IncomingDocument);
IncomingDocumentSchema.index({ summary: 'text', refNo: 'text', sender: 'text' });
