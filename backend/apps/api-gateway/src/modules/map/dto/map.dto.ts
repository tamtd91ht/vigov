import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** Toạ độ % trong khung bản đồ mô phỏng */
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

/** Bộ lọc danh sách ghim */
export class ListPinQueryDto {
  @IsOptional()
  @IsString({ message: 'Mã lớp dữ liệu phải là chuỗi ký tự' })
  layerKey?: string;

  /** Từ khoá tìm trong tên / ngành nghề / địa chỉ cơ sở */
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi ký tự' })
  q?: string;
}

/** Thêm lớp dữ liệu mới */
export class CreateLayerDto {
  @IsString({ message: 'Mã lớp phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập mã lớp dữ liệu' })
  key: string;

  @IsString({ message: 'Tên lớp phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên lớp dữ liệu' })
  label: string;

  @IsOptional()
  @IsString({ message: 'Màu lớp phải là chuỗi ký tự' })
  color?: string;

  @IsOptional()
  @IsBoolean({ message: 'Cờ bật sẵn phải là true hoặc false' })
  defaultOn?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}

/** Cập nhật lớp dữ liệu — mọi trường đều tuỳ chọn, KHÔNG cho đổi `key` */
export class UpdateLayerDto {
  @IsOptional()
  @IsString({ message: 'Tên lớp phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên lớp không được để trống' })
  label?: string;

  @IsOptional()
  @IsString({ message: 'Màu lớp phải là chuỗi ký tự' })
  color?: string;

  @IsOptional()
  @IsBoolean({ message: 'Cờ bật sẵn phải là true hoặc false' })
  defaultOn?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm' })
  order?: number;
}

/** Thêm ghim mới lên bản đồ */
export class CreatePinDto {
  @IsString({ message: 'Mã lớp dữ liệu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng chọn lớp dữ liệu cho ghim' })
  layerKey: string;

  @IsString({ message: 'Tên cơ sở phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên cơ sở' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Ngành nghề phải là chuỗi ký tự' })
  industry?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lao động phải là số nguyên' })
  @Min(0, { message: 'Số lao động không được âm' })
  workers?: number;

  @IsOptional()
  @IsString({ message: 'Người đại diện phải là chuỗi ký tự' })
  representative?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Toạ độ x phải là số' })
  @Min(MIN_PERCENT, { message: 'Toạ độ x nằm ngoài khung bản đồ' })
  @Max(MAX_PERCENT, { message: 'Toạ độ x nằm ngoài khung bản đồ' })
  x?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Toạ độ y phải là số' })
  @Min(MIN_PERCENT, { message: 'Toạ độ y nằm ngoài khung bản đồ' })
  @Max(MAX_PERCENT, { message: 'Toạ độ y nằm ngoài khung bản đồ' })
  y?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'Vĩ độ không hợp lệ' })
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'Kinh độ không hợp lệ' })
  lng?: number;
}

/** Cập nhật ghim — mọi trường đều tuỳ chọn */
export class UpdatePinDto {
  @IsOptional()
  @IsString({ message: 'Mã lớp dữ liệu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã lớp dữ liệu không được để trống' })
  layerKey?: string;

  @IsOptional()
  @IsString({ message: 'Tên cơ sở phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên cơ sở không được để trống' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Ngành nghề phải là chuỗi ký tự' })
  industry?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lao động phải là số nguyên' })
  @Min(0, { message: 'Số lao động không được âm' })
  workers?: number;

  @IsOptional()
  @IsString({ message: 'Người đại diện phải là chuỗi ký tự' })
  representative?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Toạ độ x phải là số' })
  @Min(MIN_PERCENT, { message: 'Toạ độ x nằm ngoài khung bản đồ' })
  @Max(MAX_PERCENT, { message: 'Toạ độ x nằm ngoài khung bản đồ' })
  x?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Toạ độ y phải là số' })
  @Min(MIN_PERCENT, { message: 'Toạ độ y nằm ngoài khung bản đồ' })
  @Max(MAX_PERCENT, { message: 'Toạ độ y nằm ngoài khung bản đồ' })
  y?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'Vĩ độ không hợp lệ' })
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'Kinh độ không hợp lệ' })
  lng?: number;
}
