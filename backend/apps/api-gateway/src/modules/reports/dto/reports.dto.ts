import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Kỳ báo cáo hỗ trợ ở Phase 1 */
export const REPORT_PERIODS = ['month', 'quarter', 'half', 'year'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** Khoảng năm hợp lệ của báo cáo */
const MIN_REPORT_YEAR = 2000;
const MAX_REPORT_YEAR = 2100;

/** Tham số chung của các endpoint báo cáo và kết xuất */
export class ReportQueryDto {
  /** Kỳ báo cáo; mặc định là tháng */
  @IsOptional()
  @IsEnum(REPORT_PERIODS, { message: 'Kỳ báo cáo phải là month, quarter, half hoặc year' })
  period?: ReportPeriod;

  /** Năm báo cáo; bỏ trống thì lấy năm hiện tại */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm báo cáo phải là số nguyên' })
  @Min(MIN_REPORT_YEAR, { message: `Năm báo cáo phải từ ${MIN_REPORT_YEAR} trở lên` })
  @Max(MAX_REPORT_YEAR, { message: `Năm báo cáo không vượt quá ${MAX_REPORT_YEAR}` })
  year?: number;

  /** true: kèm số liệu so sánh với kỳ liền trước */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean({ message: 'Tham số so sánh phải là true hoặc false' })
  compare?: boolean;
}
