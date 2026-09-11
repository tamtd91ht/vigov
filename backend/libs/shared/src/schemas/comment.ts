import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { nowMs, type EpochMs } from '../time/epoch';

/**
 * Ý kiến trao đổi trong một bản ghi nghiệp vụ — khuôn dùng chung v2.
 *
 * Thay bản v1 (khai trong `task.schema.ts`, được Nhiệm vụ, Ngân sách và các
 * phân hệ khác dùng lại), khuôn cũ có ba trường không nên nằm trong cơ sở dữ
 * liệu:
 *
 * | Trường v1 | Vì sao bỏ |
 * |---|---|
 * | `authorName` | Lưu tên nên hai cán bộ trùng họ tên không phân biệt được, và cán bộ đổi tên thì bình luận cũ nói tên cũ. v2 lưu `authorId` |
 * | `authorInitials` | Chữ viết tắt là **cách trình bày**, tính được từ tên. `admin-web` đã có component `Avatar` tự tính |
 * | `authorColor` | Màu avatar cũng là cách trình bày, và v1 còn lưu thẳng chuỗi `var(--navy)` — tức là một biến CSS của một client cụ thể nằm trong dữ liệu nghiệp vụ |
 * | `time` | Chuỗi đã định dạng `HH:mm dd/MM/yyyy` nên không sắp xếp, không lọc theo khoảng được. v2 lưu số |
 */
@Schema({ _id: false })
export class Comment {
  /** Thời điểm gửi, milli-giây UTC */
  @Prop({ type: Number, required: true })
  at: number;

  /**
   * `staff_users._id` của người gửi.
   *
   * Rỗng nghĩa là hệ thống ghi (ví dụ ghi chú tự động khi luân chuyển hồ sơ).
   * Tên, chữ viết tắt và màu avatar do tầng đọc resolve từ id này.
   */
  @Prop({ default: '' })
  authorId: string;

  @Prop({ required: true })
  content: string;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

/** Dựng một ý kiến trao đổi — để mọi phân hệ ghi cùng bộ trường */
export function comment(
  content: string,
  options: { authorId?: string; at?: EpochMs } = {},
): Comment {
  return {
    at: options.at ?? nowMs(),
    authorId: options.authorId ?? '',
    content,
  };
}
