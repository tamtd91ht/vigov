import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrgNodeDocument = HydratedDocument<OrgNode>;

/**
 * Nút trong cây tổ chức (phòng/ban/bộ phận) của trang Cấu hình — WBS #9.
 * Chỉ phân hệ Settings dùng nên khai báo cục bộ, KHÔNG đưa vào libs/shared.
 * Cây được dựng từ `parentId`: nút gốc có parentId rỗng/undefined.
 */
@Schema({ collection: 'org_nodes', timestamps: true })
export class OrgNode {
  @Prop({ required: true })
  name: string;

  /** Mô tả ngắn hiển thị dưới tên (ví dụ: số cán bộ, chức năng) */
  @Prop({ default: '' })
  subtitle: string;

  /** Màu nhận diện — dùng biến CSS của admin-web */
  @Prop({ default: 'var(--blue)' })
  color: string;

  /** Id nút cha; bỏ trống nghĩa là nút gốc */
  @Prop({ index: true })
  parentId?: string;

  /** Thứ tự hiển thị trong cùng một cấp */
  @Prop({ default: 0 })
  order: number;
}

export const OrgNodeSchema = SchemaFactory.createForClass(OrgNode);
