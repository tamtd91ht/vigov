import { Prop, Schema } from '@nestjs/mongoose';
import type { FilterQuery } from 'mongoose';

/**
 * Xoá MỀM dùng chung cho mọi phân hệ (Nhiệm vụ, Văn bản, Công dân, Ngân sách…).
 *
 * Toàn bộ quy ước xoá mềm của dự án nằm ở ĐÚNG một chỗ: bộ trường, điều kiện
 * lọc, và hai hàm đánh dấu. Trước đây mỗi service tự khai `NOT_DELETED` /
 * `IS_DELETED` riêng — bốn bản sao y nhau cộng hơn mười chỗ viết thẳng
 * `deletedAt: null` rải rác, nên thêm một phân hệ là lại quên một chỗ.
 *
 * ## Vì sao tách `isDeleted` khỏi `deletedAt`
 *
 * `isDeleted` là CỜ để truy vấn; `deletedAt` chỉ là mốc thời gian tham chiếu
 * (xoá lúc nào), KHÔNG dùng trong điều kiện lọc. Lọc theo một trường boolean
 * có index rẻ và rõ nghĩa hơn là lọc theo `Date | null`.
 *
 * Hai trường này phải LUÔN đi cùng nhau — dùng `markDeleted` / `markRestored`
 * thay vì gán tay, để không bao giờ có bản ghi `isDeleted: true` mà thiếu mốc
 * thời gian (hoặc ngược lại).
 */
@Schema()
export class SoftDeletable {
  /**
   * Cờ xoá mềm — trường DUY NHẤT được dùng trong điều kiện truy vấn.
   *
   * `default: false` chỉ áp cho bản ghi MỚI. Bản ghi tạo trước khi có tính năng
   * xoá không hề có trường này, nên điều kiện lọc phải là `$ne: true` chứ không
   * phải `false` — xem `NOT_DELETED`.
   */
  @Prop({ type: Boolean, default: false, index: true })
  isDeleted: boolean;

  /**
   * Mốc xoá — chỉ để hiển thị và truy vết, KHÔNG lọc theo trường này.
   *
   * Phải khai `type: Date` tay: union `Date | null` làm reflect-metadata trả về
   * `Object` và Mongoose dựng sai kiểu cột.
   */
  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  /**
   * TÊN ĐĂNG NHẬP (`JwtPayload.username`) của cán bộ đã xoá — KHÔNG phải
   * `displayName`. Nhật ký kiểm toán tra theo tên đăng nhập, mà hai cán bộ có
   * thể trùng họ tên. Cả 4 phân hệ phải thống nhất một kiểu giá trị.
   */
  @Prop()
  deletedBy?: string;

  /** Lý do xoá (không bắt buộc) — chỉ lưu để truy vết nội bộ */
  @Prop()
  deleteReason?: string;
}

/**
 * Điều kiện "CHƯA bị xoá mềm" — dùng cho mọi danh sách, thống kê, tìm kiếm.
 *
 * `$ne: true` chứ KHÔNG phải `false`: nó khớp cả ba trường hợp cùng lúc —
 * tài liệu thiếu hẳn trường (bản ghi cũ tạo trước khi có tính năng xoá),
 * `false`, và `null`. Nếu lọc `isDeleted: false` thì mọi bản ghi cũ trong CSDL
 * biến mất khỏi danh sách cho tới khi chạy xong script backfill — nghĩa là
 * không deploy được nếu chưa migrate.
 */
export const NOT_DELETED: FilterQuery<SoftDeletable> = { isDeleted: { $ne: true } };

/** Điều kiện "ĐÃ bị xoá mềm" — dùng cho bộ lọc "Đã xoá" của Web Quản trị */
export const IS_DELETED: FilterQuery<SoftDeletable> = { isDeleted: true };

/**
 * Tài liệu Mongoose có mang bộ trường xoá mềm.
 * Khai tối thiểu để `markDeleted` / `markRestored` dùng được với mọi schema mà
 * không cần biết phần nghiệp vụ còn lại.
 */
export interface SoftDeletableDoc {
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: string;
  deleteReason?: string;
}

/**
 * Đánh dấu một tài liệu là đã xoá mềm — KHÔNG tự `save()`.
 *
 * Bên gọi chịu trách nhiệm ghi nhật ký nghiệp vụ (mỗi phân hệ có định dạng
 * timeline riêng) rồi mới `save()`, để cả hai việc nằm trong cùng một lượt ghi.
 *
 * Lý do rỗng / chỉ có khoảng trắng thì KHÔNG ghi trường `deleteReason`, tránh
 * để lại chuỗi rỗng vô nghĩa trong CSDL.
 *
 * @param actor TÊN ĐĂNG NHẬP (`user.username`), không phải `displayName`.
 */
export function markDeleted(doc: SoftDeletableDoc, actor?: string, reason?: string): void {
  const trimmed = reason?.trim();
  doc.isDeleted = true;
  doc.deletedAt = new Date();
  doc.deletedBy = actor;
  if (trimmed) doc.deleteReason = trimmed;
}

/**
 * Bỏ cờ xoá để khôi phục tài liệu — KHÔNG tự `save()`.
 *
 * Dọn luôn người xoá và lý do xoá: bản ghi đã trở lại danh sách thì hai thông
 * tin đó chỉ còn gây nhầm — lần xoá sau không nêu lý do sẽ hiển thị lại lý do
 * của lần trước.
 *
 * Gán `undefined` là ĐỦ để Mongoose sinh `$unset` khi `save()` (đã kiểm chứng
 * bằng `doc.getChanges()`: `{$set:{isDeleted:false}, $unset:{deletedBy:1,
 * deleteReason:1}}`), nên hàm này tương đương `softRestoreUpdate()` dùng cho
 * `findOneAndUpdate`.
 */
export function markRestored(doc: SoftDeletableDoc): void {
  doc.isDeleted = false;
  doc.deletedAt = null;
  doc.deletedBy = undefined;
  doc.deleteReason = undefined;
}

/**
 * Toán tử cập nhật để xoá mềm bằng `findOneAndUpdate` (không nạp tài liệu về).
 * Dùng khi không cần ghi nhật ký nghiệp vụ — ví dụ phân hệ Công dân, Ngân sách.
 *
 * @param actor TÊN ĐĂNG NHẬP (`user.username`), không phải `displayName`.
 */
export function softDeleteUpdate(actor?: string, reason?: string) {
  const trimmed = reason?.trim();
  return {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: actor,
      ...(trimmed ? { deleteReason: trimmed } : {}),
    },
  };
}

/** Toán tử cập nhật để khôi phục bằng `findOneAndUpdate` */
export function softRestoreUpdate() {
  return {
    $set: { isDeleted: false, deletedAt: null },
    $unset: { deletedBy: '', deleteReason: '' },
  };
}
