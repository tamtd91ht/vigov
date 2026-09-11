import { Type } from 'class-transformer';
import {
  IsEpochMs,
  SoftDeleteBodyDto,
  SoftDeleteQueryDto,
  TransformStringArray,
} from '@vigov/shared';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Các giá trị hợp lệ — khớp enum trong libs/shared/schemas/task.schema.ts */
export const TASK_STATUSES = ['moi', 'dang', 'cho', 'qua', 'xong'] as const;
export const TASK_PRIORITIES = ['cao', 'tb', 'thap'] as const;
export const TASK_SOURCE_TYPES = ['vb', 'pa', 'hop'] as const;

/*
 * `VN_DATE_PATTERN` đã bỏ: hạn xử lý nhận vào dạng SỐ milli-giây (khuôn thời
 * gian v2), không còn chuỗi `dd/MM/yyyy`. Máy chủ tự chuẩn hoá về hết ngày giờ
 * Việt Nam, xem `endOfVnDayMs`.
 */

/** Một việc con trong checklist nhiệm vụ */
export class ChecklistItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên việc con không được để trống' })
  @MaxLength(300, { message: 'Tên việc con tối đa 300 ký tự' })
  title: string;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái việc con phải là true/false' })
  done?: boolean;
}

/** Tạo nhiệm vụ mới (POST /tasks) */
export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề nhiệm vụ' })
  @MaxLength(500, { message: 'Tiêu đề tối đa 500 ký tự' })
  title: string;

  @IsMongoId({ message: 'Cán bộ thực hiện không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn cán bộ thực hiện' })
  assigneeId: string;

  @IsMongoId({ message: 'Bộ phận chủ trì không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn bộ phận chủ trì' })
  departmentId: string;

  @IsEpochMs('Hạn xử lý')
  deadline: number;

  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: 'Mức ưu tiên chỉ nhận: cao, tb, thap' })
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Mô tả tối đa 5000 ký tự' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách việc con không hợp lệ' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];

  @IsOptional()
  @IsIn(TASK_SOURCE_TYPES, { message: 'Nguồn nhiệm vụ chỉ nhận: vb, pa, hop' })
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Nhãn nguồn tối đa 300 ký tự' })
  sourceLabel?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách phối hợp không hợp lệ' })
  @IsMongoId({ each: true, message: 'Cán bộ phối hợp không hợp lệ' })
  collaboratorIds?: string[];
}

/** Cập nhật nhiệm vụ (PATCH /tasks/:code) — mọi trường đều tuỳ chọn */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(500, { message: 'Tiêu đề tối đa 500 ký tự' })
  title?: string;

  @IsOptional()
  @IsMongoId({ message: 'Cán bộ thực hiện không hợp lệ' })
  assigneeId?: string;

  @IsOptional()
  @IsMongoId({ message: 'Bộ phận chủ trì không hợp lệ' })
  departmentId?: string;

  @IsOptional()
  @IsEpochMs('Hạn xử lý')
  deadline?: number;

  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: 'Mức ưu tiên chỉ nhận: cao, tb, thap' })
  priority?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES, { message: 'Trạng thái chỉ nhận: moi, dang, cho, qua, xong' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Tiến độ phải là số nguyên' })
  @Min(0, { message: 'Tiến độ nhỏ nhất là 0' })
  @Max(100, { message: 'Tiến độ lớn nhất là 100' })
  progress?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Mô tả tối đa 5000 ký tự' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách việc con không hợp lệ' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];

  @IsOptional()
  @IsArray({ message: 'Danh sách phối hợp không hợp lệ' })
  @IsMongoId({ each: true, message: 'Cán bộ phối hợp không hợp lệ' })
  collaboratorIds?: string[];
}

/** Tick / bỏ tick một việc con (PATCH /tasks/:code/checklist/:index) */
export class ToggleChecklistDto {
  /** Bỏ trống = đảo trạng thái hiện tại */
  @IsOptional()
  @IsBoolean({ message: 'Giá trị done phải là true/false' })
  done?: boolean;
}

/** Thêm bình luận trao đổi (POST /tasks/:code/comments) */
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung bình luận' })
  @MaxLength(2000, { message: 'Nội dung bình luận tối đa 2000 ký tự' })
  content: string;
}

/** Số tệp minh chứng tối đa gắn một lần cho nhiệm vụ */
export const MAX_TASK_ATTACHMENTS_PER_CALL = 10;

/** Gắn tệp minh chứng vào nhiệm vụ (POST /tasks/:code/attachments) */
export class AttachTaskFilesDto {
  @IsArray({ message: 'Danh sách tệp không hợp lệ' })
  @ArrayNotEmpty({ message: 'Vui lòng chọn ít nhất một tệp cần gắn' })
  @ArrayMaxSize(MAX_TASK_ATTACHMENTS_PER_CALL, {
    message: `Chỉ được gắn tối đa ${MAX_TASK_ATTACHMENTS_PER_CALL} tệp mỗi lần`,
  })
  @IsString({ each: true, message: 'Mã tệp không hợp lệ' })
  fileIds: string[];
}

/** Xoá mềm nhiệm vụ (PATCH /tasks/:code/delete) — lý do không bắt buộc */
export class DeleteTaskDto extends SoftDeleteBodyDto {}

/**
 * Bộ lọc danh sách nhiệm vụ (GET /tasks).
 *
 * Ba bộ lọc trạng thái / người thực hiện / mức ưu tiên nhận NHIỀU giá trị: cán
 * bộ thường cần "việc của tôi và của anh B", hoặc "cao và rất cao". Tham số một
 * giá trị (`?status=moi`) vẫn dùng được — `toStringArray` quy về mảng một phần
 * tử, nên giao diện cũ và các đường gọi API sẵn có không hỏng.
 */
export class QueryTasksDto extends SoftDeleteQueryDto {
  @IsOptional()
  @TransformStringArray()
  @IsIn(TASK_STATUSES, { each: true, message: 'Trạng thái lọc không hợp lệ' })
  status?: string[];

  @IsOptional()
  @IsMongoId({ message: 'Bộ phận lọc không hợp lệ' })
  departmentId?: string;

  /** Lọc theo NHIỀU cán bộ thực hiện, nhận `staff_users._id` */
  @IsOptional()
  @TransformStringArray()
  @IsMongoId({ each: true, message: 'Cán bộ lọc không hợp lệ' })
  assigneeId?: string[];

  @IsOptional()
  @TransformStringArray()
  @IsIn(TASK_PRIORITIES, { each: true, message: 'Mức ưu tiên lọc không hợp lệ' })
  priority?: string[];

  /** Lọc theo ngày giao việc (`createdAt`), dạng yyyy-MM-dd */
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Mốc "từ ngày" phải theo định dạng yyyy-MM-dd' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Mốc "đến ngày" phải theo định dạng yyyy-MM-dd' })
  to?: string;

  /** Từ khoá tìm theo mã / tiêu đề / mô tả */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang nhỏ nhất là 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi mỗi trang nhỏ nhất là 1' })
  limit?: number;
}
