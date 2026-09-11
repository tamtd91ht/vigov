import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SoftDeletable } from './soft-delete';
import { applyEpochTimestamps } from './timestamped';
import { ActivityEntry, ActivityEntrySchema } from './activity-log';
import { Comment, CommentSchema } from './comment';
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

/*
 * `Comment` và `TimelineStep` từng khai tại tệp này, và được Văn bản, Hồ sơ một
 * cửa, Phản ánh, Ngân sách, Nội dung dùng lại — tức là khuôn dùng chung của cả
 * hệ thống lại nằm trong schema của một phân hệ.
 *
 * Nâng cấp v2 chuyển chúng về đúng chỗ, kèm chuẩn hoá:
 *   `Comment`      → `./comment`       (thời điểm dạng số, người gửi là id)
 *   `TimelineStep` → `./activity-log`  (`ActivityEntry`: at · actorId · action · detail)
 */

/**
 * Nhiệm vụ (WBS #3) — tên field khớp admin-web/src/types Task
 * để FE chuyển từ mock sang API không phải đổi mã.
 *
 * Kế thừa `SoftDeletable` (isDeleted/deletedAt/deletedBy/deleteReason): nhiệm vụ
 * không bị xoá khỏi CSDL vì nhật ký xử lý, bình luận và mã tệp minh chứng còn là
 * bằng chứng phục vụ thanh tra, mà mã NV-xxxx đã được văn bản / phản ánh dẫn
 * chiếu qua `sourceRefId` nên xoá cứng là để lại liên kết chết.
 */
@Schema({ collection: 'tasks' })
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

  /**
   * Hạn xử lý — milli-giây UTC, đã chuẩn hoá về **hết ngày** giờ Việt Nam
   * (`endOfVnDayMs`). Hạn hành chính là một NGÀY, không phải một thời điểm.
   *
   * v1 lưu hai trường cho cùng một cái hạn: `deadline` dạng chuỗi `dd/MM/yyyy`
   * để hiển thị và `deadlineAt` dạng `Date` để cron so sánh. Sửa một trường mà
   * quên trường kia là bảng hiện một ngày còn cron tính một ngày khác — mà lệch
   * kiểu đó không báo lỗi gì. v2 giữ MỘT trường; định dạng là việc của client.
   */
  @Prop({ required: true, index: true })
  deadline: number;

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

  @Prop({ type: [ActivityEntrySchema], default: [] })
  timeline: ActivityEntry[];

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
applyEpochTimestamps(TaskSchema);
TaskSchema.index({ title: 'text', description: 'text' });
