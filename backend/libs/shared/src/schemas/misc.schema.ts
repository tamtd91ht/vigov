import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Comment, CommentSchema } from './task.schema';

export type ArticleDocument = HydratedDocument<Article>;
export type AuditLogDocument = HydratedDocument<AuditLog>;
export type StoredFileDocument = HydratedDocument<StoredFile>;
export type SlaRuleDocument = HydratedDocument<SlaRule>;


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
