import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

/** dd/MM/yyyy — giữ nguyên định dạng hiển thị của FE */
const VN_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

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
  assignee?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  @Matches(VN_DATE_PATTERN, { message: 'Hạn xử lý phải theo định dạng dd/MM/yyyy' })
  deadline?: string;
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
  assignee?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  @Matches(VN_DATE_PATTERN, { message: 'Hạn xử lý phải theo định dạng dd/MM/yyyy' })
  deadline?: string;
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
