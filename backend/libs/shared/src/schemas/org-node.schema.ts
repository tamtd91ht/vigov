import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { applyEpochTimestamps } from './timestamped';

export type OrgNodeDocument = HydratedDocument<OrgNode>;

/**
 * Nút trong cây tổ chức của UBND xã: phòng, ban, bộ phận, chức danh lãnh đạo.
 *
 * ## Vì sao chuyển vào `libs/shared` ở v2
 *
 * v1 khai báo lớp này **cục bộ trong phân hệ Cấu hình** vì chỉ trang Cấu hình
 * vẽ cây tổ chức. Cùng lúc đó, "bộ phận" trong dữ liệu nghiệp vụ lại là **chuỗi
 * tự do**: nhiệm vụ, văn bản, phản ánh, hồ sơ một cửa mỗi nơi lưu một chuỗi tên
 * bộ phận, và danh mục cho ô chọn được suy ra bằng cách lấy **giá trị phân biệt**
 * của chính các collection đó (`catalogs.service.ts`).
 *
 * Hệ quả: sửa tên một bộ phận trên trang Cấu hình **không** đổi gì trong hồ sơ
 * đã lưu, nên hồ sơ cũ giữ tên cũ và danh mục sinh ra hai lựa chọn cho cùng một
 * bộ phận. Không ai phát hiện cho tới lúc đối chiếu báo cáo theo bộ phận.
 *
 * v2 lấy collection này làm **danh mục bộ phận chuẩn của toàn hệ thống**; mọi
 * bản ghi nghiệp vụ trỏ tới nó bằng `departmentId`. Đổi tên bộ phận từ nay là
 * sửa một bản ghi, và mọi hồ sơ tự hiển thị tên mới.
 */
@Schema({ collection: 'org_nodes' })
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

  /**
   * Nút này có nhận hồ sơ nghiệp vụ hay không.
   *
   * Cây tổ chức có cả nút **không phải bộ phận xử lý việc**: nút gốc "UBND Xã",
   * các chức danh lãnh đạo. Ô chọn "Bộ phận chủ trì" không được hiện những nút
   * đó. v1 lọc bằng cách suy ra "nút lá" — nút nào không có con thì coi là bộ
   * phận — nên thêm một nút con vào "Địa chính – Xây dựng" là bộ phận ấy biến
   * mất khỏi mọi ô chọn, mà không có gì báo.
   *
   * v2 khai tường minh: văn phòng tự đánh dấu nút nào là bộ phận nhận việc.
   */
  @Prop({ type: Boolean, default: false, index: true })
  isDepartment: boolean;
}

export const OrgNodeSchema = SchemaFactory.createForClass(OrgNode);
applyEpochTimestamps(OrgNodeSchema);
