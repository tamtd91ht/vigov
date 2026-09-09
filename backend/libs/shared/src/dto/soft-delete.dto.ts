import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO dùng chung cho xoá mềm — đi kèm `schemas/soft-delete.ts`.
 *
 * Mọi phân hệ có xoá mềm đều `extends` hai lớp dưới đây thay vì khai lại
 * trường `deleted` / `reason`. Trước đây bốn phân hệ khai bốn kiểu: có nơi
 * `deleted?: string` với `@IsIn(['true','false'])`, có nơi `deleted?: boolean`
 * với `@Transform` — cùng một API mà hai kiểu dữ liệu.
 */

/** Độ dài tối đa của lý do xoá — đủ cho một câu giải trình, không thành bài viết */
export const MAX_DELETE_REASON_LENGTH = 500;

/**
 * Thêm bộ lọc "Đã xoá" vào một Query DTO có sẵn.
 *
 * Tham số truy vấn luôn tới dưới dạng chuỗi ("?deleted=true"), nên `@Transform`
 * quy đổi về boolean TRƯỚC khi `@IsBoolean` kiểm tra. Nhờ vậy service chỉ cần
 * viết `query.deleted ? IS_DELETED : NOT_DELETED`, không phải so chuỗi.
 */
export class SoftDeleteQueryDto {
  /**
   * `true` thì CHỈ trả bản ghi đã xoá mềm (thùng "Đã xoá" của Web Quản trị);
   * bỏ trống hoặc `false` thì chỉ trả bản ghi còn hiệu lực.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean({ message: 'Tham số deleted phải là true hoặc false' })
  deleted?: boolean;
}

/**
 * Thân yêu cầu của endpoint xoá mềm — lý do KHÔNG bắt buộc.
 *
 * Bắt buộc nêu lý do sẽ làm cán bộ gõ cho xong ("xoá", "abc") nên chỉ khuyến
 * khích; có thì lưu vào nhật ký để truy vết.
 */
export class SoftDeleteBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DELETE_REASON_LENGTH, {
    message: `Lý do xoá tối đa ${MAX_DELETE_REASON_LENGTH} ký tự`,
  })
  reason?: string;
}
