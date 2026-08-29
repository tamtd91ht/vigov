import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GovContactDocument = HydratedDocument<GovContact>;

/** Nhóm hiển thị trong danh bạ của app công dân và Zalo Mini App */
export const CONTACT_GROUPS = ['leader', 'department', 'emergency'] as const;

/**
 * Danh bạ chính quyền công khai cho công dân — WBS #19.
 *
 * KHÔNG suy ra từ `staff_users`: một người có thể xuất hiện nhiều dòng với chức
 * danh và số máy khác nhau (ví dụ Phó Chủ tịch UBND đồng thời phụ trách Văn
 * phòng — hai dòng, hai số máy). Đây cũng là dữ liệu văn phòng chủ động biên
 * tập để công bố, khác với tài khoản đăng nhập.
 *
 * Số điện thoại ở đây là số máy công vụ công bố công khai, không phải số cá
 * nhân, nên endpoint đọc để `@Public()`.
 */
@Schema({ collection: 'gov_contacts', timestamps: true })
export class GovContact {
  @Prop({ required: true, index: true })
  name: string;

  /** Chức danh công bố, ví dụ "Chủ tịch UBND xã" */
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  department: string;

  /** Số máy công vụ */
  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, enum: CONTACT_GROUPS, index: true })
  group: string;

  /** Thứ tự hiển thị trong cùng một nhóm */
  @Prop({ default: 0 })
  order: number;
}

export const GovContactSchema = SchemaFactory.createForClass(GovContact);
