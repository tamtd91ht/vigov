import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SoftDeletable } from './soft-delete';
import { HydratedDocument } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

/** Việc con trong checklist nhiệm vụ */
@Schema({ _id: false })
export class ChecklistItem {
  @Prop({ required: true })
  title: string;

  @Prop({ default: false })
  done: boolean;
}
export const ChecklistItemSchema = SchemaFactory.createForClass(ChecklistItem);

/** Bình luận trao đổi trong nhiệm vụ */
@Schema({ _id: false })
export class Comment {
  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true })
  authorInitials: string;

  @Prop({ required: true })
  authorColor: string;

  @Prop({ required: true })
  time: string;

  @Prop({ required: true })
  content: string;
}
export const CommentSchema = SchemaFactory.createForClass(Comment);

/** Mục nhật ký / timeline */
@Schema({ _id: false })
export class TimelineStep {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  meta: string;

  @Prop({ enum: ['ok', 'cur'], default: 'ok' })
  state: string;
}
export const TimelineStepSchema = SchemaFactory.createForClass(TimelineStep);

/**
 * Nhiệm vụ (WBS #3) — tên field khớp admin-web/src/types Task
 * để FE chuyển từ mock sang API không phải đổi mã.
 *
 * Kế thừa `SoftDeletable` (isDeleted/deletedAt/deletedBy/deleteReason): nhiệm vụ
 * không bị xoá khỏi CSDL vì nhật ký xử lý, bình luận và mã tệp minh chứng còn là
 * bằng chứng phục vụ thanh tra, mà mã NV-xxxx đã được văn bản / phản ánh dẫn
 * chiếu qua `sourceRefId` nên xoá cứng là để lại liên kết chết.
 */
@Schema({ collection: 'tasks', timestamps: true })
export class Task extends SoftDeletable {
  /** Mã hiển thị: NV-2601 */
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  sourceLabel: string;

  @Prop({ enum: ['vb', 'pa', 'hop'], default: 'hop' })
  sourceType: string;

  /** Liên kết nguồn xuyên phân hệ (id văn bản / phản ánh) */
  @Prop({ index: true })
  sourceRefId?: string;

  @Prop({ required: true, index: true })
  assignee: string;

  @Prop({ required: true, index: true })
  department: string;

  /** dd/MM/yyyy — giữ nguyên định dạng hiển thị của FE */
  @Prop({ required: true })
  deadline: string;

  /** Mốc hạn dạng Date phục vụ CronJob nhắc hạn (P3-30) */
  @Prop({ index: true })
  deadlineAt?: Date;

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ enum: ['moi', 'dang', 'cho', 'qua', 'xong'], default: 'moi', index: true })
  status: string;

  @Prop({ enum: ['cao', 'tb', 'thap'], default: 'tb' })
  priority: string;

  @Prop({ required: true })
  assigner: string;

  @Prop({ type: [String], default: [] })
  collaborators: string[];

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [ChecklistItemSchema], default: [] })
  checklist: ChecklistItem[];

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Prop({ type: [TimelineStepSchema], default: [] })
  timeline: TimelineStep[];

  /**
   * Tên tệp đính kèm dạng chuỗi — DI SẢN, giữ lại cho tương thích ngược.
   *
   * Đây chỉ là tên hiển thị: không tải lên, không tải về được. Bản ghi cũ và
   * dữ liệu seed đang dùng trường này, nên xoá đi là làm rỗng cột đính kèm
   * trên giao diện. Tệp thật nằm ở `attachmentFileIds`.
   */
  @Prop({ type: [String], default: [] })
  attachments: string[];

  /**
   * Mã tệp minh chứng trong module Files (WBS #3, #24) — tệp tải lên/tải về được.
   *
   * Tệp minh chứng nhiệm vụ là tài liệu nội bộ, nên BẮT BUỘC tải lên với
   * `isPrivate = true` theo quy ước TB-09 trong SECURITY.md; TasksService từ
   * chối gắn tệp công khai vào nhiệm vụ.
   */
  @Prop({ type: [String], default: [] })
  attachmentFileIds: string[];

}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ title: 'text', description: 'text' });
