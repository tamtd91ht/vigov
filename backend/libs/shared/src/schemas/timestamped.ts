import { Prop, Schema } from '@nestjs/mongoose';
import type { Schema as MongooseSchema } from 'mongoose';
import { nowMs, type EpochMs } from '../time/epoch';

/**
 * Hai mốc `createdAt` / `updatedAt` dạng số — nâng cấp v2.
 *
 * ## Vì sao không dùng `@Schema({ timestamps: true })` của Mongoose
 *
 * Tuỳ chọn đó luôn ghi `Date`, không cấu hình được sang số. v2 lưu mọi mốc thời
 * gian bằng `number` (xem `time/epoch.ts`), nên phải tự quản hai trường này.
 *
 * ## Vì sao GIỮ NGUYÊN tên trường
 *
 * Chỉ đổi kiểu, không đổi tên. `sort({ createdAt: -1 })` và mọi điều kiện lọc
 * đang viết đều đúng cú pháp với trường số, nên đổi tên là thêm hơn hai trăm
 * điểm sửa mà không đổi được gì về nghiệp vụ.
 *
 * ## Cách dùng
 *
 * ```ts
 * @Schema({ collection: 'tasks' })   // KHÔNG còn timestamps: true
 * export class Task extends SoftDeletable { ... }
 *
 * export const TaskSchema = SchemaFactory.createForClass(Task);
 * applyEpochTimestamps(TaskSchema);  // BẮT BUỘC, nếu không hai mốc luôn rỗng
 * ```
 */
@Schema()
export class Timestamped {
  /**
   * Mốc tạo bản ghi.
   *
   * Có index vì **mọi** danh sách của hệ thống đều sắp xếp theo trường này
   * (`sort({ createdAt: -1 })`), và bộ lọc khoảng thời gian mặc định cũng lọc
   * theo nó.
   */
  @Prop({ type: Number, index: true })
  createdAt: number;

  /**
   * Mốc sửa gần nhất.
   *
   * KHÔNG đánh index: không chỗ nào sắp xếp hay lọc theo nó, mà mỗi lượt ghi
   * đều đổi giá trị — index ở đây chỉ làm chậm mọi thao tác sửa để đổi lấy một
   * truy vấn không tồn tại.
   */
  @Prop({ type: Number })
  updatedAt: number;
}

/** Bộ trường thời gian mà `applyEpochTimestamps` quản lý */
export interface EpochTimestamps {
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

/**
 * Gắn cơ chế tự điền `createdAt` / `updatedAt` dạng số cho một schema.
 *
 * Phủ cả bốn đường ghi của Mongoose: `save()`, `insertMany()`, và nhóm
 * `findOneAndUpdate` / `updateOne` / `updateMany`. Thiếu một đường là có bản
 * ghi không mốc thời gian, mà lỗi kiểu đó chỉ lộ ra khi báo cáo đếm thiếu.
 *
 * ## Giá trị truyền tường minh luôn được tôn trọng
 *
 * Nếu lượt ghi đã tự nêu `updatedAt` thì hook KHÔNG ghi đè. Đây là điều kiện
 * bắt buộc để script di trú (P7-04) chuyển được mốc thời gian **lịch sử** của
 * dữ liệu cũ sang khuôn mới — nếu hook luôn đặt "bây giờ", toàn bộ mốc sửa của
 * hồ sơ hành chính sẽ bị đổi thành ngày chạy di trú. Đó là mất dữ liệu.
 */
export function applyEpochTimestamps(schema: MongooseSchema): void {
  schema.pre('save', function (next) {
    const doc = this as unknown as Partial<EpochTimestamps> & {
      isNew: boolean;
      isModified(path: string): boolean;
    };
    const at = nowMs();
    if (doc.createdAt === undefined && !doc.isModified('createdAt')) doc.createdAt = at;
    if (!doc.isModified('updatedAt')) doc.updatedAt = at;
    next();
  });

  schema.pre('insertMany', function (next, docs: Partial<EpochTimestamps>[]) {
    const at = nowMs();
    for (const doc of docs ?? []) {
      if (doc.createdAt === undefined) doc.createdAt = at;
      if (doc.updatedAt === undefined) doc.updatedAt = at;
    }
    next();
  });

  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    const update = this.getUpdate();
    // Cập nhật dạng đường ống (mảng) tự quản mốc thời gian — không chen vào
    if (!update || Array.isArray(update)) return next();

    const doc = update as Record<string, unknown> & {
      $set?: Record<string, unknown>;
      $setOnInsert?: Record<string, unknown>;
    };

    // Đã tự nêu updatedAt (di trú, sửa dữ liệu có chủ ý) thì giữ nguyên
    const daNeu = doc.updatedAt !== undefined || doc.$set?.updatedAt !== undefined;
    if (!daNeu) {
      doc.$set = { ...doc.$set, updatedAt: nowMs() };
    }

    // Upsert có thể tạo bản ghi mới, lúc đó phải có mốc tạo
    doc.$setOnInsert = { createdAt: nowMs(), ...doc.$setOnInsert };
    this.setUpdate(doc);
    next();
  });
}
