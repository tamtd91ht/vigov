import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Giới hạn hợp lý cho số ngày SLA */
export const MIN_SLA_DAYS = 0;
export const MAX_SLA_DAYS = 365;

/** Một dòng cấu hình SLA theo lĩnh vực phản ánh */
export class SlaRuleDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu mã lĩnh vực (categoryKey)' })
  categoryKey: string;

  @Type(() => Number)
  @IsInt({ message: 'Số ngày tiếp nhận phải là số nguyên' })
  @Min(MIN_SLA_DAYS, { message: 'Số ngày tiếp nhận không được âm' })
  @Max(MAX_SLA_DAYS, { message: `Số ngày tiếp nhận tối đa ${MAX_SLA_DAYS}` })
  intakeDays: number;

  @Type(() => Number)
  @IsInt({ message: 'Số ngày xử lý phải là số nguyên' })
  @Min(MIN_SLA_DAYS, { message: 'Số ngày xử lý không được âm' })
  @Max(MAX_SLA_DAYS, { message: `Số ngày xử lý tối đa ${MAX_SLA_DAYS}` })
  resolveDays: number;

  @IsOptional()
  @IsString({ message: 'Đơn vị tính không hợp lệ' })
  unit?: string;

  @IsOptional()
  @IsString({ message: 'Mốc cảnh báo trước hạn không hợp lệ' })
  warnBefore?: string;
}

/** Lưu toàn bộ bảng SLA (PUT /settings/sla) */
export class UpdateSlaDto {
  @IsArray({ message: 'Danh sách SLA không hợp lệ' })
  @ArrayNotEmpty({ message: 'Danh sách SLA không được rỗng' })
  @ValidateNested({ each: true })
  @Type(() => SlaRuleDto)
  rules: SlaRuleDto[];
}

/** Thêm một nút vào cây tổ chức */
export class CreateOrgNodeDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đơn vị' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Mô tả ngắn không hợp lệ' })
  subtitle?: string;

  @IsOptional()
  @IsString({ message: 'Màu nhận diện không hợp lệ' })
  color?: string;

  @IsOptional()
  @IsString({ message: 'Mã đơn vị cha không hợp lệ' })
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}

/** Cập nhật một nút của cây tổ chức */
export class UpdateOrgNodeDto {
  @IsOptional()
  @IsString({ message: 'Tên đơn vị không hợp lệ' })
  @IsNotEmpty({ message: 'Tên đơn vị không được để trống' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả ngắn không hợp lệ' })
  subtitle?: string;

  @IsOptional()
  @IsString({ message: 'Màu nhận diện không hợp lệ' })
  color?: string;

  /** Chuỗi rỗng nghĩa là chuyển nút lên làm nút gốc */
  @IsOptional()
  @IsString({ message: 'Mã đơn vị cha không hợp lệ' })
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}
