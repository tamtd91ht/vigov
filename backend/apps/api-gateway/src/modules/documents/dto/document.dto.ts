import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Định dạng ngày FE đang dùng: dd/MM/yyyy */
export const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

export const DOCUMENT_KINDS = ['incoming', 'petition'] as const;
export const DOCUMENT_STATUSES = ['moi', 'dangxl', 'choduyet', 'xong'] as const;

/** Tiếp nhận văn bản đến / đơn thư — vào sổ văn bản (WBS #4) */
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số ký hiệu văn bản' })
  refNo: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'Ngày văn bản phải theo định dạng dd/MM/yyyy' })
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập cơ quan / người gửi' })
  sender: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập trích yếu nội dung' })
  summary: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Loại văn bản không được để trống' })
  docType?: string;

  @IsOptional()
  @IsIn(DOCUMENT_KINDS, { message: 'Phân loại chỉ nhận giá trị incoming hoặc petition' })
  kind?: (typeof DOCUMENT_KINDS)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Bộ phận chủ trì không được để trống' })
  department?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Hạn xử lý phải theo định dạng dd/MM/yyyy' })
  deadline?: string;

  @IsOptional()
  @IsString()
  confidentiality?: string;

  @IsOptional()
  @IsString()
  urgency?: string;

  @IsOptional()
  @IsString()
  signer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  pageCount?: number;

  @IsOptional()
  @IsString()
  scanFileId?: string;
}

/** Cập nhật thông tin văn bản; đổi bộ phận / trạng thái sẽ ghi thêm timeline */
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Số ký hiệu không được để trống' })
  refNo?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Ngày văn bản phải theo định dạng dd/MM/yyyy' })
  date?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Cơ quan / người gửi không được để trống' })
  sender?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Trích yếu không được để trống' })
  summary?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Loại văn bản không được để trống' })
  docType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Bộ phận chủ trì không được để trống' })
  department?: string;

  @IsOptional()
  @IsIn(DOCUMENT_STATUSES, {
    message: 'Trạng thái chỉ nhận: moi, dangxl, choduyet, xong',
  })
  status?: (typeof DOCUMENT_STATUSES)[number];

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Hạn xử lý phải theo định dạng dd/MM/yyyy' })
  deadline?: string;

  @IsOptional()
  @IsString()
  confidentiality?: string;

  @IsOptional()
  @IsString()
  urgency?: string;

  @IsOptional()
  @IsString()
  signer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  pageCount?: number;

  @IsOptional()
  @IsString()
  scanFileId?: string;

  @IsOptional()
  @IsString()
  linkedTaskCode?: string;
}

/** Bộ lọc danh sách văn bản đến / đơn thư */
export class QueryDocumentsDto {
  @IsOptional()
  @IsIn(DOCUMENT_KINDS, { message: 'Phân loại chỉ nhận giá trị incoming hoặc petition' })
  kind?: (typeof DOCUMENT_KINDS)[number];

  @IsOptional()
  @IsIn(DOCUMENT_STATUSES, {
    message: 'Trạng thái chỉ nhận: moi, dangxl, choduyet, xong',
  })
  status?: (typeof DOCUMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  docType?: string;

  /** Từ khoá tìm kiếm toàn văn (trích yếu / số ký hiệu / nơi gửi) */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang danh sách phải là số nguyên' })
  @Min(1, { message: 'Số trang danh sách nhỏ nhất là 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi mỗi trang nhỏ nhất là 1' })
  @Max(200, { message: 'Số bản ghi mỗi trang tối đa là 200' })
  limit?: number;
}

/** Cán bộ xác nhận một trường OCR, có thể sửa lại giá trị máy đọc sai */
export class ConfirmOcrFieldDto {
  @IsOptional()
  @IsString({ message: 'Giá trị trường OCR phải là chuỗi ký tự' })
  value?: string;
}
