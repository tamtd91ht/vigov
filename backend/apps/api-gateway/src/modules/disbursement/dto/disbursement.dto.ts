import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  DISBURSEMENT_REQUEST_STATUSES,
  SoftDeleteBodyDto,
  SoftDeleteQueryDto,
  type DisbursementRequestStatus,
} from '@vigov/shared';

/** Khoảng năm ngân sách hợp lệ — chặn dữ liệu rác từ query string */
const MIN_BUDGET_YEAR = 2000;
const MAX_BUDGET_YEAR = 2100;

/**
 * Bộ lọc danh sách hạng mục ngân sách.
 * Trường `deleted` (bộ lọc "Đã xoá") kế thừa từ `SoftDeleteQueryDto` dùng chung.
 */
export class ListBudgetQueryDto extends SoftDeleteQueryDto {
  /** Năm ngân sách; bỏ trống thì service lấy năm hiện tại */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm ngân sách phải là số nguyên' })
  @Min(MIN_BUDGET_YEAR, { message: `Năm ngân sách phải từ ${MIN_BUDGET_YEAR} trở lên` })
  @Max(MAX_BUDGET_YEAR, { message: `Năm ngân sách không vượt quá ${MAX_BUDGET_YEAR}` })
  year?: number;

  /** true: chỉ lấy hạng mục đang chậm tiến độ */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean({ message: 'Tham số chậm tiến độ phải là true hoặc false' })
  delayed?: boolean;

  /** Bộ phận/cán bộ phụ trách hạng mục */
  @IsOptional()
  @IsString({ message: 'Đơn vị phụ trách phải là chuỗi ký tự' })
  owner?: string;
}

/** Tạo mới hạng mục ngân sách — mã HM-xx do server tự sinh */
export class CreateBudgetItemDto {
  @IsString({ message: 'Tên hạng mục phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên hạng mục' })
  name: string;

  @IsString({ message: 'Nguồn vốn phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nguồn vốn' })
  fundingSource: string;

  @IsString({ message: 'Đơn vị phụ trách phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị phụ trách' })
  owner: string;

  @Type(() => Number)
  @IsInt({ message: 'Năm ngân sách phải là số nguyên' })
  @Min(MIN_BUDGET_YEAR, { message: `Năm ngân sách phải từ ${MIN_BUDGET_YEAR} trở lên` })
  @Max(MAX_BUDGET_YEAR, { message: `Năm ngân sách không vượt quá ${MAX_BUDGET_YEAR}` })
  year: number;

  /** Kế hoạch vốn, đơn vị: tỷ đồng */
  @Type(() => Number)
  @IsNumber({}, { message: 'Kế hoạch vốn phải là số (đơn vị: tỷ đồng)' })
  @Min(0, { message: 'Kế hoạch vốn không được âm' })
  planned: number;

  /** Màu hiển thị nguồn vốn trên Web Quản trị */
  @IsOptional()
  @IsString({ message: 'Màu nguồn vốn phải là chuỗi ký tự' })
  fundingColor?: string;
}

/** Ghi nhận một lần giải ngân của hạng mục */
export class CreateEntryDto {
  @IsString({ message: 'Ngày giải ngân phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập ngày giải ngân' })
  date: string;

  @IsString({ message: 'Nội dung giải ngân phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung giải ngân' })
  content: string;

  /** Số tiền dạng chuỗi hiển thị, ví dụ "1,25 tỷ" — service tự quy đổi sang số */
  @IsString({ message: 'Số tiền phải là chuỗi ký tự, ví dụ "1,25 tỷ"' })
  @IsNotEmpty({ message: 'Vui lòng nhập số tiền giải ngân' })
  amount: string;

  @IsOptional()
  @IsString({ message: 'Nhà thầu/đơn vị thụ hưởng phải là chuỗi ký tự' })
  vendor?: string;

  @IsOptional()
  @IsString({ message: 'Số chứng từ phải là chuỗi ký tự' })
  voucherNo?: string;
}

/** Thêm bình luận trao đổi trong hạng mục */
export class CreateCommentDto {
  @IsString({ message: 'Nội dung bình luận phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung bình luận' })
  content: string;
}

/** Thêm vướng mắc cần tháo gỡ */
export class CreateObstacleDto {
  @IsString({ message: 'Nội dung vướng mắc phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung vướng mắc' })
  content: string;

  @IsOptional()
  @IsString({ message: 'Đơn vị chịu trách nhiệm phải là chuỗi ký tự' })
  owner?: string;

  @IsOptional()
  @IsString({ message: 'Hạn tháo gỡ phải là chuỗi ký tự' })
  deadline?: string;
}

/** Đề nghị giải ngân gửi lãnh đạo duyệt */
export class CreateDisbursementRequestDto {
  /** Số tiền đề nghị dạng chuỗi, ví dụ "0,8 tỷ" */
  @IsString({ message: 'Số tiền đề nghị phải là chuỗi ký tự, ví dụ "0,8 tỷ"' })
  @IsNotEmpty({ message: 'Vui lòng nhập số tiền đề nghị' })
  amount: string;

  @IsString({ message: 'Nội dung đề nghị phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung đề nghị' })
  content: string;

  @IsOptional()
  @IsString({ message: 'Nhà thầu/đơn vị thụ hưởng phải là chuỗi ký tự' })
  vendor?: string;
}

/** Lọc danh sách đề nghị giải ngân toàn xã theo trạng thái và năm */
export class ListRequestQueryDto {
  @IsOptional()
  @IsIn(DISBURSEMENT_REQUEST_STATUSES, {
    message: `Trạng thái đề nghị phải là một trong: ${DISBURSEMENT_REQUEST_STATUSES.join(', ')}`,
  })
  status?: DisbursementRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm ngân sách phải là số nguyên' })
  @Min(MIN_BUDGET_YEAR, { message: `Năm ngân sách phải từ ${MIN_BUDGET_YEAR} trở lên` })
  @Max(MAX_BUDGET_YEAR, { message: `Năm ngân sách không vượt quá ${MAX_BUDGET_YEAR}` })
  year?: number;
}

/** Từ chối đề nghị giải ngân — bắt buộc nêu lý do để người gửi biết phải sửa gì */
export class RejectRequestDto {
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối đề nghị' })
  reason: string;
}

/**
 * Ghi nhận đề nghị đã chi thật.
 *
 * Đây là bước DUY NHẤT cộng tiền vào luỹ kế `actual`, nên số chứng từ bắt buộc:
 * không có chứng từ thì không đối chiếu được với sổ kế toán khi quyết toán.
 */
export class DisburseRequestDto {
  @IsString({ message: 'Số chứng từ phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập số chứng từ của lần chi' })
  voucherNo: string;

  /** Ngày chi dạng dd/MM/yyyy; bỏ trống thì service lấy ngày hôm nay */
  @IsOptional()
  @IsString({ message: 'Ngày chi phải là chuỗi ký tự' })
  date?: string;
}

/**
 * Xoá mềm hạng mục ngân sách — lý do tuỳ chọn, lưu lại để truy vết.
 * Trường `reason` (kèm giới hạn độ dài) kế thừa từ `SoftDeleteBodyDto` dùng chung.
 */
export class DeleteBudgetItemDto extends SoftDeleteBodyDto {}
