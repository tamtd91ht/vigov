import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IssuingAgencyDocument = HydratedDocument<IssuingAgency>;

/**
 * Cấp hành chính của cơ quan ban hành — dùng để nhóm danh sách cho dễ tìm.
 *
 * Không phải bảng phân quyền, chỉ là nhãn hiển thị. Xếp theo thứ tự từ trên
 * xuống đúng như cách gọi trong văn bản hành chính.
 */
export const AGENCY_LEVELS = ['trung-uong', 'tinh', 'huyen', 'xa', 'khac'] as const;

export const AGENCY_LEVEL_LABELS: Record<string, string> = {
  'trung-uong': 'Trung ương',
  tinh: 'Cấp tỉnh',
  huyen: 'Cấp huyện',
  xa: 'Cấp xã',
  khac: 'Khác',
};

/**
 * Cơ quan ban hành văn bản — danh mục sửa được ở trang Cấu hình.
 *
 * VÌ SAO CẦN DANH MỤC: trước đây cán bộ tự nhập tay tên cơ quan ở form Tiếp
 * nhận văn bản. Cùng một cơ quan bị nhập ra nhiều biến thể ("UBND huyện Đông
 * Phú", "UBND H. Đông Phú", "ubnd huyện đông phú"), làm hai việc hỏng cùng lúc:
 * lọc theo cơ quan không ra hết văn bản, và báo cáo thống kê theo cơ quan sai số.
 *
 * KHÔNG xoá cứng: `active = false` để ẩn khỏi ô chọn nhưng vẫn giữ tên cho các
 * văn bản cũ đang tham chiếu. Cơ quan sáp nhập, đổi tên là chuyện thường xuyên
 * trong hành chính — xoá hẳn là làm mồ côi dữ liệu sổ văn bản đã vào.
 */
@Schema({ collection: 'issuing_agencies', timestamps: true })
export class IssuingAgency {
  /** Tên đầy đủ, đúng như ghi trên văn bản. Đây là giá trị lưu vào `sender` */
  @Prop({ required: true, unique: true, index: true, trim: true })
  name: string;

  /** Tên viết tắt để hiện gọn trong bảng, ví dụ "UBND H. Đông Phú" */
  @Prop({ default: '', trim: true })
  shortName: string;

  @Prop({ default: 'khac', enum: AGENCY_LEVELS })
  level: string;

  /** Thứ tự hiển thị; cùng thứ tự thì xếp theo tên */
  @Prop({ default: 0 })
  order: number;

  /** `false` = ẩn khỏi ô chọn nhưng vẫn giữ bản ghi cho dữ liệu cũ */
  @Prop({ default: true })
  active: boolean;
}

export const IssuingAgencySchema = SchemaFactory.createForClass(IssuingAgency);
