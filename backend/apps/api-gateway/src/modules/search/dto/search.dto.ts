import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** Số kết quả tối đa trả về cho MỖI loại dữ liệu */
export const MAX_SEARCH_LIMIT = 50;

/** Tham số tìm kiếm toàn cục (WBS #28) */
export class GlobalSearchQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập từ khoá tìm kiếm' })
  q: string;

  /** Danh sách loại cần tìm, phân cách bởi dấu phẩy: tasks,documents,feedback */
  @IsOptional()
  @IsString({ message: 'Danh sách loại dữ liệu không hợp lệ' })
  types?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số kết quả phải là số nguyên' })
  @Min(1, { message: 'Số kết quả phải lớn hơn 0' })
  @Max(MAX_SEARCH_LIMIT, { message: `Số kết quả mỗi loại tối đa ${MAX_SEARCH_LIMIT}` })
  limit?: number;
}
