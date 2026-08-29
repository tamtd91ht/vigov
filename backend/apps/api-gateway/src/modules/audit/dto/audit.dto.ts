import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

/** Số bản ghi tối đa mỗi trang khi tra cứu nhật ký */
export const MAX_AUDIT_PAGE_SIZE = 200;

/** Bộ lọc tra cứu nhật ký thao tác (WBS #29) */
export class ListAuditQueryDto {
  @IsOptional()
  @IsString({ message: 'Tên người thao tác không hợp lệ' })
  actor?: string;

  @IsOptional()
  @IsString({ message: 'Đối tượng tác động không hợp lệ' })
  resource?: string;

  @IsOptional()
  @IsString({ message: 'Hành động không hợp lệ' })
  action?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời điểm bắt đầu phải theo định dạng ISO 8601' })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời điểm kết thúc phải theo định dạng ISO 8601' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi mỗi trang phải lớn hơn 0' })
  @Max(MAX_AUDIT_PAGE_SIZE, { message: `Số bản ghi mỗi trang tối đa ${MAX_AUDIT_PAGE_SIZE}` })
  limit?: number;
}
