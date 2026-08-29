import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeedbackCategoryDocument = HydratedDocument<FeedbackCategory>;

/**
 * Lĩnh vực phản ánh của người dân — WBS #9.
 *
 * `key` là khoá nghiệp vụ được tham chiếu ở nhiều nơi: `feedbacks.categoryKey`,
 * `sla_rules.categoryKey`, bộ lọc của Zalo Mini App và app công dân. Vì vậy key
 * KHÔNG được đổi sau khi tạo — muốn đổi tên hiển thị thì sửa `label`.
 *
 * Chỉ phân hệ Settings quản lý nên khai báo cục bộ, không đưa vào libs/shared.
 */
@Schema({ collection: 'feedback_categories', timestamps: true })
export class FeedbackCategory {
  /** Khoá nghiệp vụ dạng slug, ví dụ "ve-sinh-moi-truong" */
  @Prop({ required: true, unique: true, index: true })
  key: string;

  /** Tên hiển thị cho người dùng */
  @Prop({ required: true })
  label: string;

  /** Màu nhận diện — dùng biến CSS của admin-web, ví dụ "var(--orange)" */
  @Prop({ default: 'var(--mut)' })
  color: string;

  /** Thứ tự hiển thị trong danh sách và dropdown */
  @Prop({ default: 0 })
  order: number;
}

export const FeedbackCategorySchema = SchemaFactory.createForClass(FeedbackCategory);
