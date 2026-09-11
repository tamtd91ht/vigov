import { Prop, Schema } from '@nestjs/mongoose';
import type { FilterQuery } from 'mongoose';
import { nowMs, type EpochMs } from '../time/epoch';
import { Timestamped } from './timestamped';

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
 *
 * ## Vì sao kế thừa `Timestamped`
 *
 * Mọi bản ghi nghiệp vụ có xoá mềm đều cần `createdAt` / `updatedAt`, mà
 * TypeScript chỉ cho kế thừa MỘT lớp. Gộp ở đây để schema nghiệp vụ chỉ cần
 * `extends SoftDeletable` là có đủ cả hai bộ trường, thay vì khai lại hai mốc
 * thời gian ở mười ba chỗ.
 */
@Schema()
export class SoftDeletable extends Timestamped {
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
   * Milli-giây UTC theo khuôn thời gian v2 (`time/epoch.ts`). Phải khai
   * `type: Number` tay: union `number | null` làm reflect-metadata trả về
   * `Object` và Mongoose dựng sai kiểu cột.
   *
   * Khai `number` chứ KHÔNG phải bí danh `EpochMs`: dự án bật `declaration`,
   * mà bí danh nằm trong trường schema làm kiểu `lean()` mà Mongoose suy ra
   * phình quá giới hạn serialize của TypeScript — lỗi hiện ra ở những module
   * không liên quan (TS7056 tại `map`, `settings`). Bí danh vẫn dùng ở chữ ký
   * hàm, nơi nó có giá trị diễn giải mà không vào kiểu suy ra.
   */
  @Prop({ type: Number, default: null })
  deletedAt?: number | null;

  /**
   * `staff_users._id` của cán bộ đã xoá — khuôn tham chiếu v2 (`refs.ts`).
   *
   * v1 lưu TÊN ĐĂNG NHẬP ở trường `deletedBy`. Đổi sang id vì tên đăng nhập vẫn
   * đổi được, và vì mọi tham chiếu trong v2 phải cùng một kiểu giá trị để tra
   * được về tài khoản.
   *
   * Nhật ký kiểm toán (`audit_logs`) vẫn tra theo tên đăng nhập — đó là kho
   * riêng, không đổi ở task này.
   */
  @Prop()
  deletedById?: string;

  /** Lý do xoá (không bắt buộc) — chỉ lưu để truy vết nội bộ */
  @Prop()
  deleteReason?: string;

  /**
   * Tên cũ của những tham chiếu KHÔNG tra được id khi di trú sang v2.
   *
   * v1 lưu tham chiếu bằng TÊN; v2 lưu id. Di trú (P7-04) tra tên → id, nhưng
   * hồ sơ cũ có thể trỏ tới cán bộ đã nghỉ việc hoặc bộ phận đã giải thể — lúc
   * đó **không được đoán**, và cũng không được để trống: cán bộ đọc hồ sơ sẽ
   * tưởng hệ thống mất dữ liệu.
   *
   * Nên tên gốc được giữ lại ở đây, và tầng đọc trả nó về kèm cờ `legacy` để
   * giao diện nói rõ "đây là tên cũ trong hồ sơ" (xem `DirectoryLookup`).
   *
   * Một trường chung thay vì mười trường `legacyAssignee`, `legacyDepartment`…:
   * đây là dữ liệu của **một lần di trú**, không phải dữ liệu nghiệp vụ, nên
   * không đáng làm phình bộ trường của mọi bản ghi.
   */
  @Prop({ type: Object, default: undefined })
  legacyRefs?: Record<string, string>;
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
  deletedAt?: EpochMs | null;
  deletedById?: string;
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
 * @param actorId `staff_users._id` (`JwtPayload.sub`), không phải tên đăng nhập.
 */
export function markDeleted(doc: SoftDeletableDoc, actorId?: string, reason?: string): void {
  const trimmed = reason?.trim();
  doc.isDeleted = true;
  doc.deletedAt = nowMs();
  doc.deletedById = actorId;
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
 * bằng `doc.getChanges()`: `{$set:{isDeleted:false}, $unset:{deletedById:1,
 * deleteReason:1}}`), nên hàm này tương đương `softRestoreUpdate()` dùng cho
 * `findOneAndUpdate`.
 */
export function markRestored(doc: SoftDeletableDoc): void {
  doc.isDeleted = false;
  doc.deletedAt = null;
  doc.deletedById = undefined;
  doc.deleteReason = undefined;
}

/**
 * Toán tử cập nhật để xoá mềm bằng `findOneAndUpdate` (không nạp tài liệu về).
 * Dùng khi không cần ghi nhật ký nghiệp vụ — ví dụ phân hệ Công dân, Ngân sách.
 *
 * @param actorId `staff_users._id` (`JwtPayload.sub`), không phải tên đăng nhập.
 */
export function softDeleteUpdate(actorId?: string, reason?: string) {
  const trimmed = reason?.trim();
  return {
    $set: {
      isDeleted: true,
      deletedAt: nowMs(),
      deletedById: actorId,
      ...(trimmed ? { deleteReason: trimmed } : {}),
    },
  };
}

/** Toán tử cập nhật để khôi phục bằng `findOneAndUpdate` */
export function softRestoreUpdate() {
  return {
    $set: { isDeleted: false, deletedAt: null },
    $unset: { deletedById: '', deleteReason: '' },
  };
}
