import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Comment, CommentSchema } from './task.schema';

export type BudgetItemDocument = HydratedDocument<BudgetItem>;
export type ArticleDocument = HydratedDocument<Article>;
export type AuditLogDocument = HydratedDocument<AuditLog>;
export type StoredFileDocument = HydratedDocument<StoredFile>;
export type SlaRuleDocument = HydratedDocument<SlaRule>;

/** Một lần giải ngân của hạng mục */
@Schema({ _id: false })
export class DisbursementEntry {
  @Prop({ required: true }) date: string;
  @Prop({ required: true }) content: string;
  @Prop({ required: true }) amount: string;
  @Prop({ default: '' }) vendor: string;
  @Prop({ default: '' }) by: string;
  @Prop({ default: '' }) voucherNo: string;
}
export const DisbursementEntrySchema = SchemaFactory.createForClass(DisbursementEntry);

/** Vướng mắc cần tháo gỡ */
@Schema({ _id: false })
export class Obstacle {
  @Prop({ required: true }) content: string;
  @Prop({ default: '' }) owner: string;
  @Prop({ default: '' }) deadline: string;
}
export const ObstacleSchema = SchemaFactory.createForClass(Obstacle);

/** Hạng mục ngân sách / giải ngân (WBS #5) */
@Schema({ collection: 'budget_items', timestamps: true })
export class BudgetItem {
  @Prop({ required: true, unique: true, index: true }) code: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) fundingSource: string;
  @Prop({ default: 'var(--blue)' }) fundingColor: string;
  @Prop({ required: true, index: true }) owner: string;
  @Prop({ required: true, index: true }) year: number;
  /** Đơn vị: tỷ đồng */
  @Prop({ default: 0 }) planned: number;
  @Prop({ default: 0 }) actual: number;
  @Prop({ default: false }) delayed: boolean;
  @Prop({ type: [DisbursementEntrySchema], default: [] }) entries: DisbursementEntry[];
  @Prop({ type: [CommentSchema], default: [] }) comments: Comment[];
  @Prop({ type: [ObstacleSchema], default: [] }) obstacles: Obstacle[];
}
export const BudgetItemSchema = SchemaFactory.createForClass(BudgetItem);

/** Nội dung CMS đẩy sang app công dân (WBS #10/#16) */
@Schema({ collection: 'articles', timestamps: true })
export class Article {
  @Prop({ enum: ['news', 'event', 'notice'], required: true, index: true }) type: string;
  @Prop({ required: true }) title: string;
  @Prop({ default: '' }) category: string;
  @Prop({ default: '' }) excerpt: string;
  @Prop({ default: '' }) content: string;
  @Prop({ default: 'var(--blue)' }) coverColor: string;
  @Prop() coverFileId?: string;
  @Prop({ enum: ['draft', 'published'], default: 'draft', index: true }) status: string;
  @Prop({ default: '' }) publishedAt: string;
  @Prop({ default: '' }) author: string;
  @Prop({ default: 0 }) views: number;
}
export const ArticleSchema = SchemaFactory.createForClass(Article);
ArticleSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

/** Nhật ký thao tác — ghi vết mọi hành động ghi/duyệt/khoá (WBS #29) */
@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  @Prop({ required: true, index: true }) actor: string;
  @Prop({ required: true, index: true }) action: string;
  @Prop({ required: true, index: true }) resource: string;
  @Prop() resourceId?: string;
  @Prop({ type: Object }) before?: Record<string, unknown>;
  @Prop({ type: Object }) after?: Record<string, unknown>;
  @Prop({ default: '' }) ip: string;
}
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

/** Tệp đã lưu trong file storage (WBS #24) */
@Schema({ collection: 'stored_files', timestamps: true })
export class StoredFile {
  @Prop({ required: true }) originalName: string;
  @Prop({ required: true }) mimeType: string;
  @Prop({ required: true }) size: number;
  /** Đường dẫn/khoá trong driver lưu trữ (local hoặc S3) */
  @Prop({ required: true }) storageKey: string;
  @Prop({ enum: ['scan', 'feedback', 'audio', 'video', 'cover', 'other'], default: 'other', index: true })
  purpose: string;
  @Prop({ default: '' }) uploadedBy: string;
  /** Tệp riêng tư chỉ truy cập qua signed URL */
  @Prop({ default: false }) isPrivate: boolean;
}
export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);

/** Cấu hình SLA theo lĩnh vực phản ánh (WBS #9) */
@Schema({ collection: 'sla_rules', timestamps: true })
export class SlaRule {
  @Prop({ required: true, unique: true, index: true }) categoryKey: string;
  @Prop({ required: true }) intakeDays: number;
  @Prop({ required: true }) resolveDays: number;
  @Prop({ default: 'ngày làm việc' }) unit: string;
  @Prop({ default: '' }) warnBefore: string;
}
export const SlaRuleSchema = SchemaFactory.createForClass(SlaRule);
