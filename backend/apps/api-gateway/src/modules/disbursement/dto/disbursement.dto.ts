import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  IsEpochMs,
  BENEFICIARY_TYPES,
  BUDGET_APPROVAL_STATUSES,
  DISBURSEMENT_ENTRY_TYPES,
  DISBURSEMENT_REQUEST_STATUSES,
  DISBURSEMENT_STATES,
  MAX_VND,
  SCHEDULE_STATES,
  SoftDeleteBodyDto,
  SoftDeleteQueryDto,
  TransformStringArray,
  type BudgetApprovalStatus,
  type DisbursementEntryType,
  type DisbursementRequestStatus,
} from '@vigov/shared';

/** Khoảng năm ngân sách hợp lệ — chặn dữ liệu rác từ query string */
const MIN_BUDGET_YEAR = 2000;
const MAX_BUDGET_YEAR = 2100;

/** dd/MM/yyyy — định dạng ngày của văn bản hành chính Việt Nam */

/** Số tệp tối đa gắn một lần */
const MAX_FILES = 10;

/* ────────────────────────────── Bộ lọc danh sách ────────────────────────────── */

/**
 * Bộ lọc danh sách hạng mục ngân sách.
 *
 * `scheduleState`, `disbursementState`, `minPercent`, `maxPercent`, `dueSoon`
 * được lọc ở TẦNG ỨNG DỤNG vì chúng được tính lại mỗi lần đọc chứ không lưu
 * trong CSDL — xem chú thích `list()` trong service.
 */
export class ListBudgetQueryDto extends SoftDeleteQueryDto {
  /** Năm ngân sách; bỏ trống thì service lấy năm hiện tại */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm ngân sách phải là số nguyên' })
  @Min(MIN_BUDGET_YEAR, { message: `Năm ngân sách phải từ ${MIN_BUDGET_YEAR} trở lên` })
  @Max(MAX_BUDGET_YEAR, { message: `Năm ngân sách không vượt quá ${MAX_BUDGET_YEAR}` })
  year?: number;

  @IsOptional()
  @IsString({ message: 'Đơn vị thực hiện phải là chuỗi ký tự' })
  owner?: string;

  @IsOptional()
  @IsString({ message: 'Loại chi phải là chuỗi ký tự' })
  expenseType?: string;

  @IsOptional()
  @IsString({ message: 'Nguồn vốn phải là chuỗi ký tự' })
  fundingSource?: string;

  @IsOptional()
  @IsString({ message: 'Dự án / chương trình phải là chuỗi ký tự' })
  program?: string;

  /** Chọn nhiều trạng thái hồ sơ */
  @IsOptional()
  @TransformStringArray()
  @IsIn(BUDGET_APPROVAL_STATUSES, { each: true, message: 'Trạng thái hồ sơ không hợp lệ' })
  approvalStatus?: BudgetApprovalStatus[];

  /** Chọn nhiều tình trạng tiến độ */
  @IsOptional()
  @TransformStringArray()
  @IsIn(SCHEDULE_STATES, { each: true, message: 'Tình trạng tiến độ không hợp lệ' })
  scheduleState?: string[];

  /** Chọn nhiều mức giải ngân */
  @IsOptional()
  @TransformStringArray()
  @IsIn(DISBURSEMENT_STATES, { each: true, message: 'Mức giải ngân không hợp lệ' })
  disbursementState?: string[];

  /** Khoảng tỷ lệ giải ngân, đơn vị % */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỷ lệ giải ngân tối thiểu phải là số' })
  @Min(0)
  @Max(100)
  minPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỷ lệ giải ngân tối đa phải là số' })
  @Min(0)
  @Max(100)
  maxPercent?: number;

  /** Chỉ hạng mục sắp hết hạn (ngưỡng ngày đọc từ cấu hình) */
  @IsOptional()
  @Type(() => Boolean)
  dueSoon?: boolean;

  /** Từ khoá tìm theo mã / tên / mục đích / chương trình / đối tượng */
  @IsOptional()
  @IsString()
  q?: string;
}

/* ────────────────────────────── Hạng mục ────────────────────────────── */

/** Kế hoạch giải ngân một quý */
export class QuarterPlanDto {
  @Type(() => Number)
  @IsInt({ message: 'Quý phải là số nguyên từ 1 đến 4' })
  @Min(1, { message: 'Quý nhỏ nhất là 1' })
  @Max(4, { message: 'Quý lớn nhất là 4' })
  quarter: number;

  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Kế hoạch quý phải là số nguyên, đơn vị đồng' },
  )
  @Min(0, { message: 'Kế hoạch quý không được âm' })
  @Max(MAX_VND)
  amountDong: number;
}

/** Mục lục ngân sách — mọi cấp đều tuỳ chọn, xem chú thích ở schema */
export class BudgetLineDto {
  @IsOptional() @IsString() @MaxLength(20) chapter?: string;
  @IsOptional() @IsString() @MaxLength(20) category?: string;
  @IsOptional() @IsString() @MaxLength(20) subCategory?: string;
  @IsOptional() @IsString() @MaxLength(20) item?: string;
  @IsOptional() @IsString() @MaxLength(20) subItem?: string;
}

/** Lập hạng mục ngân sách mới. Hạng mục mới luôn ở trạng thái Nháp */
export class CreateBudgetItemDto {
  @IsString({ message: 'Tên hạng mục phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên hạng mục' })
  @MaxLength(500, { message: 'Tên hạng mục tối đa 500 ký tự' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nội dung, mục đích chi tối đa 2000 ký tự' })
  purpose?: string;

  @IsOptional()
  @IsString({ message: 'Loại chi phải là chuỗi ký tự' })
  expenseType?: string;

  @IsOptional()
  @IsString({ message: 'Cấp ngân sách phải là chuỗi ký tự' })
  budgetLevel?: string;

  @IsString({ message: 'Nguồn vốn phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nguồn vốn' })
  fundingSource: string;

  @IsOptional()
  @IsString({ message: 'Màu nguồn vốn phải là chuỗi ký tự' })
  fundingColor?: string;

  @IsOptional()
  @IsString({ message: 'Dự án / chương trình phải là chuỗi ký tự' })
  program?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetLineDto)
  budgetLine?: BudgetLineDto;

  @IsString({ message: 'Đơn vị thực hiện phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị thực hiện' })
  owner: string;

  @IsOptional()
  @IsString({ message: 'Đối tượng thụ hưởng phải là chuỗi ký tự' })
  beneficiary?: string;

  @IsOptional()
  @IsIn(BENEFICIARY_TYPES, { message: 'Loại đối tượng thụ hưởng không hợp lệ' })
  beneficiaryType?: string;

  /**
   * Mã số thuế của đối tượng thụ hưởng — dành cho TỔ CHỨC.
   *
   * KHÔNG nhận số căn cước ở đây. Mã định danh cá nhân là dữ liệu cá nhân theo
   * NĐ 13/2023, cần cơ sở pháp lý và cơ chế che riêng — xem chú thích dữ liệu
   * cá nhân ở đầu `budget.schema.ts`.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9-]{0,20}$/, {
    message: 'Mã số thuế chỉ gồm chữ số và dấu gạch ngang',
  })
  beneficiaryTaxCode?: string;

  @Type(() => Number)
  @IsInt({ message: 'Năm ngân sách phải là số nguyên' })
  @Min(MIN_BUDGET_YEAR, { message: `Năm ngân sách phải từ ${MIN_BUDGET_YEAR} trở lên` })
  @Max(MAX_BUDGET_YEAR, { message: `Năm ngân sách không vượt quá ${MAX_BUDGET_YEAR}` })
  year: number;

  /** Năm được chuyển nguồn sang, 0 nghĩa là không phải vốn chuyển nguồn */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm chuyển nguồn phải là số nguyên' })
  @Min(0)
  @Max(MAX_BUDGET_YEAR)
  carryOverFromYear?: number;

  @IsOptional()
  @IsEpochMs('Ngày bắt đầu kế hoạch')
  startDate?: number;

  @IsOptional()
  @IsEpochMs('Ngày kết thúc kế hoạch')
  endDate?: number;

  /** Dự toán giao đầu năm — đồng, số nguyên. Đổi sau này phải qua điều chỉnh dự toán */
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Dự toán giao đầu năm phải là số nguyên, đơn vị đồng (ví dụ 850000000)' },
  )
  @Min(0, { message: 'Dự toán giao đầu năm không được âm' })
  @Max(MAX_VND, { message: 'Dự toán vượt ngưỡng cho phép — kiểm tra lại số chữ số' })
  initialPlannedDong: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4, { message: 'Kế hoạch giải ngân chỉ có tối đa 4 quý' })
  @ValidateNested({ each: true })
  @Type(() => QuarterPlanDto)
  quarterPlans?: QuarterPlanDto[];
}

/**
 * Sửa hạng mục — mọi trường tuỳ chọn.
 * KHÔNG có `initialPlannedDong`: đổi dự toán phải đi qua điều chỉnh dự toán để
 * có số quyết định làm căn cứ.
 */
export class UpdateBudgetItemDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) purpose?: string;
  @IsOptional() @IsString() expenseType?: string;
  @IsOptional() @IsString() budgetLevel?: string;
  @IsOptional() @IsString() @IsNotEmpty() fundingSource?: string;
  @IsOptional() @IsString() fundingColor?: string;
  @IsOptional() @IsString() program?: string;
  @IsOptional() @IsString() @IsNotEmpty() owner?: string;
  @IsOptional() @IsString() beneficiary?: string;

  @IsOptional()
  @IsIn(BENEFICIARY_TYPES, { message: 'Loại đối tượng thụ hưởng không hợp lệ' })
  beneficiaryType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9-]{0,20}$/, { message: 'Mã số thuế chỉ gồm chữ số và dấu gạch ngang' })
  beneficiaryTaxCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BUDGET_YEAR)
  carryOverFromYear?: number;

  @IsOptional()
  @IsEpochMs('Ngày bắt đầu kế hoạch')
  startDate?: number;

  @IsOptional()
  @IsEpochMs('Ngày kết thúc kế hoạch')
  endDate?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetLineDto)
  budgetLine?: BudgetLineDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuarterPlanDto)
  quarterPlans?: QuarterPlanDto[];

  /** Ghi chú vào lịch sử tiến độ để người sau biết vì sao sửa */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/* ────────────────────────────── Workflow ────────────────────────────── */

/** Đổi trạng thái hồ sơ hạng mục theo workflow */
export class ChangeBudgetStatusDto {
  @IsIn(BUDGET_APPROVAL_STATUSES, { message: 'Trạng thái hồ sơ không hợp lệ' })
  status: BudgetApprovalStatus;

  /** Bắt buộc khi từ chối / tạm dừng / huỷ — service kiểm */
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  note?: string;

  /** Lý do chậm tiến độ, ghi vào lịch sử để tổng hợp nguyên nhân cuối kỳ */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lateReason?: string;
}

/* ────────────────────────────── Điều chỉnh dự toán ────────────────────────────── */

/**
 * Một lần điều chỉnh dự toán.
 *
 * `deltaDong` là trường tiền DUY NHẤT được phép âm (giảm dự toán), nên nó không
 * dùng `MONEY_RULES` — nhưng vẫn phải là số nguyên.
 */
export class CreateAdjustmentDto {
  @IsString({ message: 'Số quyết định phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập số quyết định điều chỉnh — đây là căn cứ bắt buộc' })
  @MaxLength(100)
  decisionNo: string;

  @IsString()
  @IsEpochMs('Ngày quyết định')
  decidedAt: number;

  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Mức điều chỉnh phải là số nguyên, đơn vị đồng (số âm là giảm dự toán)' },
  )
  @Min(-MAX_VND)
  @Max(MAX_VND)
  deltaDong: number;

  @IsString({ message: 'Lý do điều chỉnh phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do điều chỉnh dự toán' })
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILES)
  @IsString({ each: true })
  fileIds?: string[];
}

/* ────────────────────────────── Giao dịch ────────────────────────────── */

/** Ghi nhận một giao dịch chi trả hoặc hoàn trả đã phát sinh */
export class CreateEntryDto {
  @IsString()
  @IsEpochMs('Ngày giao dịch')
  date: number;

  /** Bỏ trống thì hiểu là chi trả */
  @IsOptional()
  @IsIn(DISBURSEMENT_ENTRY_TYPES, { message: 'Loại giao dịch chỉ nhận: chi, hoan-tra' })
  type?: DisbursementEntryType;

  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Số tiền giao dịch phải là số nguyên, đơn vị đồng (ví dụ 850000000)' },
  )
  @Min(0, { message: 'Số tiền giao dịch không được âm — hoàn trả thì chọn loại "hoan-tra"' })
  @Max(MAX_VND)
  amountDong: number;

  @IsString({ message: 'Nội dung giao dịch phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung giao dịch' })
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString({ message: 'Số chứng từ phải là chuỗi ký tự' })
  @MaxLength(100)
  voucherNo?: string;

  @IsOptional()
  @IsString({ message: 'Đơn vị thụ hưởng phải là chuỗi ký tự' })
  vendor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9-]{0,20}$/, { message: 'Mã số thuế chỉ gồm chữ số và dấu gạch ngang' })
  vendorTaxCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILES)
  @IsString({ each: true })
  fileIds?: string[];
}

/* ────────────────────────────── Hồ sơ ────────────────────────────── */

/** Gắn một văn bản / hồ sơ vào hạng mục */
export class AddBudgetDocumentDto {
  @IsString({ message: 'Mã tệp phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng chọn tệp hồ sơ' })
  fileId: string;

  @IsOptional() @IsString() @MaxLength(100) refNo?: string;
  @IsOptional() @IsString() @MaxLength(100) docType?: string;

  @IsOptional()
  @IsString()
  @IsEpochMs('Ngày ban hành')
  issuedDate?: number;

  @IsOptional() @IsString() @MaxLength(300) issuer?: string;
  @IsOptional() @IsString() @MaxLength(1000) summary?: string;
}

/* ────────────────────────────── Trao đổi ────────────────────────────── */

/** Thêm bình luận trao đổi trong hạng mục */
export class CreateCommentDto {
  @IsString({ message: 'Nội dung bình luận phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung bình luận' })
  @MaxLength(2000)
  content: string;
}

/** Thêm vướng mắc cần tháo gỡ */
export class CreateObstacleDto {
  @IsString({ message: 'Nội dung vướng mắc phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung vướng mắc' })
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString({ message: 'Đơn vị chịu trách nhiệm phải là chuỗi ký tự' })
  owner?: string;

  @IsOptional()
  @IsEpochMs('Hạn tháo gỡ')
  deadline?: number;
}

/* ────────────────────────────── Đề nghị giải ngân ────────────────────────────── */

/** Đề nghị giải ngân gửi lãnh đạo duyệt */
export class CreateDisbursementRequestDto {
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Số tiền đề nghị phải là số nguyên, đơn vị đồng (ví dụ 850000000)' },
  )
  @Min(0, { message: 'Số tiền đề nghị không được âm' })
  @Max(MAX_VND)
  amountDong: number;

  @IsString({ message: 'Nội dung đề nghị phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung đề nghị' })
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString({ message: 'Đơn vị thụ hưởng phải là chuỗi ký tự' })
  vendor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9-]{0,20}$/, { message: 'Mã số thuế chỉ gồm chữ số và dấu gạch ngang' })
  vendorTaxCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILES)
  @IsString({ each: true })
  fileIds?: string[];
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
  @MaxLength(1000)
  reason: string;
}

/**
 * Ghi nhận đề nghị đã chi thật.
 *
 * Đây là bước DUY NHẤT cộng tiền của một đề nghị vào luỹ kế đã chi, nên số
 * chứng từ bắt buộc: không có chứng từ thì không đối chiếu được với sổ kế toán
 * khi quyết toán.
 */
export class DisburseRequestDto {
  @IsString({ message: 'Số chứng từ phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập số chứng từ của lần chi' })
  @MaxLength(100)
  voucherNo: string;

  /** Ngày chi thật; bỏ trống thì lấy ngày hôm nay */
  @IsOptional()
  @IsString()
  @IsEpochMs('Ngày chi')
  date?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILES)
  @IsString({ each: true })
  fileIds?: string[];
}

/** Xoá mềm hạng mục — lý do không bắt buộc */
export class DeleteBudgetItemDto extends SoftDeleteBodyDto {}
