import { Type } from 'class-transformer';
import { AGENCY_LEVELS } from '../schemas/issuing-agency.schema';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Matches,
  MaxLength,
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

/** Độ dài tối đa tên hiển thị của lĩnh vực phản ánh */
const MAX_CATEGORY_LABEL = 60;

/**
 * Khoá lĩnh vực: chữ thường, số và dấu gạch ngang.
 * Ràng buộc chặt vì key đi vào đường dẫn API và bộ lọc của Mini App.
 */
const CATEGORY_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateFeedbackCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã lĩnh vực' })
  @Matches(CATEGORY_KEY_PATTERN, {
    message: 'Mã lĩnh vực chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên lĩnh vực' })
  @MaxLength(MAX_CATEGORY_LABEL, {
    message: `Tên lĩnh vực không vượt quá ${MAX_CATEGORY_LABEL} ký tự`,
  })
  label: string;

  @IsOptional()
  @IsString({ message: 'Màu nhận diện không hợp lệ' })
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}

/** Độ dài tối đa tên cơ quan ban hành */
export const MAX_AGENCY_NAME = 300;

/** Thêm cơ quan ban hành (POST /settings/agencies) */
export class CreateIssuingAgencyDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên cơ quan ban hành' })
  @MaxLength(MAX_AGENCY_NAME, { message: `Tên cơ quan tối đa ${MAX_AGENCY_NAME} ký tự` })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGENCY_NAME, { message: `Tên viết tắt tối đa ${MAX_AGENCY_NAME} ký tự` })
  shortName?: string;

  @IsOptional()
  @IsIn(AGENCY_LEVELS, { message: 'Cấp cơ quan không hợp lệ' })
  level?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}

/**
 * Sửa cơ quan ban hành (PATCH /settings/agencies/:id).
 *
 * `active = false` là cách ẩn một cơ quan đã sáp nhập / đổi tên: nó không còn
 * trong ô chọn nhưng các văn bản cũ vẫn giữ đúng tên cơ quan lúc ban hành.
 */
export class UpdateIssuingAgencyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên cơ quan không được để trống' })
  @MaxLength(MAX_AGENCY_NAME, { message: `Tên cơ quan tối đa ${MAX_AGENCY_NAME} ký tự` })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGENCY_NAME)
  shortName?: string;

  @IsOptional()
  @IsIn(AGENCY_LEVELS, { message: 'Cấp cơ quan không hợp lệ' })
  level?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái sử dụng phải là true/false' })
  active?: boolean;
}

/** Giới hạn độ dài khoá API và điểm cuối của nhà cung cấp */
export const MAX_API_KEY_LENGTH = 500;
export const MAX_ENDPOINT_LENGTH = 300;

/**
 * Cập nhật cấu hình nhà cung cấp OCR.
 *
 * Ba trường tuỳ chọn để sửa từng phần (đổi điểm cuối mà không phải dán lại
 * khoá). Bỏ qua `apiKey` = giữ khoá đang lưu; gửi chuỗi rỗng = xoá khoá.
 */
export class UpdateOcrIntegrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]*$/, {
    message: 'Mã nhà cung cấp chỉ gồm chữ thường, số và dấu gạch ngang',
  })
  provider?: string;

  /**
   * Khoá API dạng rõ — backend mã hoá trước khi lưu, không bao giờ trả lại.
   * Tên trường `apiKey` nằm trong `REDACTED_FIELDS` nên nhật ký ghi `***`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_API_KEY_LENGTH, {
    message: `Khoá API không vượt quá ${MAX_API_KEY_LENGTH} ký tự`,
  })
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ENDPOINT_LENGTH, {
    message: `Điểm cuối không vượt quá ${MAX_ENDPOINT_LENGTH} ký tự`,
  })
  @Matches(/^(https?:\/\/.+)?$/, {
    message: 'Điểm cuối phải là địa chỉ http:// hoặc https://, hoặc để trống',
  })
  endpoint?: string;
}

/**
 * Cập nhật lĩnh vực — KHÔNG cho đổi `key`.
 * Key đã nằm trong `feedbacks.categoryKey` và `sla_rules.categoryKey` của các
 * bản ghi cũ; đổi key là làm mồ côi toàn bộ dữ liệu đã gắn với nó.
 */
export class UpdateFeedbackCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên lĩnh vực không được để trống' })
  @MaxLength(MAX_CATEGORY_LABEL, {
    message: `Tên lĩnh vực không vượt quá ${MAX_CATEGORY_LABEL} ký tự`,
  })
  label?: string;

  @IsOptional()
  @IsString({ message: 'Màu nhận diện không hợp lệ' })
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}
