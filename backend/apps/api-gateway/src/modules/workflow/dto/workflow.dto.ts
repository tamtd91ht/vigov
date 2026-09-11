import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { IsEpochMs } from '@vigov/shared';

/**
 * Nút "Chuyển thành công việc" trên màn hình Văn bản đến.
 * Các trường bỏ trống sẽ lấy theo bản ghi văn bản gốc.
 */
export class DocumentToTaskDto {
  @IsMongoId({ message: 'Mã văn bản không hợp lệ' })
  @IsNotEmpty({ message: 'Thiếu mã văn bản' })
  documentId: string;

  /** Cán bộ thực hiện; bỏ trống thì giao cho bộ phận chủ trì */
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEpochMs('Hạn xử lý')
  deadline?: number;
}

/**
 * Nút "Chuyển thành công việc" trên màn hình Phản ánh của công dân.
 * Các trường bỏ trống sẽ lấy theo phiếu phản ánh gốc.
 */
export class FeedbackToTaskDto {
  @IsMongoId({ message: 'Mã phiếu phản ánh không hợp lệ' })
  @IsNotEmpty({ message: 'Thiếu mã phiếu phản ánh' })
  feedbackId: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEpochMs('Hạn xử lý')
  deadline?: number;
}

/** Tham số cho GET /workflow/deadline-warnings */
export class DeadlineWarningQueryDto {
  /** Số ngày quét tới trước; bỏ trống dùng ngưỡng mặc định của module */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ngày phải là số nguyên' })
  @Min(1, { message: 'Số ngày nhỏ nhất là 1' })
  days?: number;
}
