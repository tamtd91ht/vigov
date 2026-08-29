import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Các giá trị hợp lệ — khớp enum trong libs/shared/schemas/task.schema.ts */
export const TASK_STATUSES = ['moi', 'dang', 'cho', 'qua', 'xong'] as const;
export const TASK_PRIORITIES = ['cao', 'tb', 'thap'] as const;
export const TASK_SOURCE_TYPES = ['vb', 'pa', 'hop'] as const;

/** dd/MM/yyyy — giữ nguyên định dạng hiển thị của FE */
export const VN_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

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

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn cán bộ thực hiện' })
  assignee: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn bộ phận chủ trì' })
  department: string;

  @IsString()
  @Matches(VN_DATE_PATTERN, { message: 'Hạn xử lý phải theo định dạng dd/MM/yyyy' })
  deadline: string;

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
  @IsString({ each: true, message: 'Tên cán bộ phối hợp không hợp lệ' })
  collaborators?: string[];
}

/** Cập nhật nhiệm vụ (PATCH /tasks/:code) — mọi trường đều tuỳ chọn */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(500, { message: 'Tiêu đề tối đa 500 ký tự' })
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Cán bộ thực hiện không được để trống' })
  assignee?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Bộ phận chủ trì không được để trống' })
  department?: string;

  @IsOptional()
  @IsString()
  @Matches(VN_DATE_PATTERN, { message: 'Hạn xử lý phải theo định dạng dd/MM/yyyy' })
  deadline?: string;

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
  @IsString({ each: true, message: 'Tên cán bộ phối hợp không hợp lệ' })
  collaborators?: string[];
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

/** Bộ lọc danh sách nhiệm vụ (GET /tasks) */
export class QueryTasksDto {
  @IsOptional()
  @IsIn(TASK_STATUSES, { message: 'Trạng thái lọc không hợp lệ' })
  status?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: 'Mức ưu tiên lọc không hợp lệ' })
  priority?: string;

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
