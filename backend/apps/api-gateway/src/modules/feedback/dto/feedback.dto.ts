import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  MinLength,
} from 'class-validator';

/** Số ảnh hiện trường tối đa mỗi phiếu phản ánh (WBS #13) */
export const MAX_FEEDBACK_IMAGES = 3;

/** Trạng thái phiếu — khớp enum trong Feedback schema */
export const FEEDBACK_STATUSES = ['received', 'processing', 'resolved'] as const;

/** Kênh gửi phản ánh */
export const FEEDBACK_CHANNELS = ['app', 'zalo', 'web'] as const;

/** Trạng thái yêu cầu thu hồi — khớp enum WITHDRAW_STATUSES trong Feedback schema */
export const WITHDRAW_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;

const MAX_TITLE_LENGTH = 200;
const MIN_TITLE_LENGTH = 5;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 300;
const MAX_NOTE_LENGTH = 1000;
/** Số điện thoại di động Việt Nam — cùng mẫu với RequestOtpDto của phân hệ Xác thực */
export const PHONE_PATTERN = /^0\d{9}$/;

const MIN_RATING = 1;
const MAX_RATING = 5;

/** Bộ lọc danh sách phản ánh cho cán bộ */
export class ListFeedbackQueryDto {
  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsIn(FEEDBACK_STATUSES, { message: 'Trạng thái chỉ nhận received, processing hoặc resolved' })
  status?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  /** Lọc theo trạng thái yêu cầu thu hồi — Web Quản trị dùng để lọc "chờ duyệt" */
  @IsOptional()
  @IsIn(WITHDRAW_STATUSES, {
    message: 'Trạng thái thu hồi chỉ nhận none, pending, approved hoặc rejected',
  })
  withdrawStatus?: string;

  /**
   * `true` = xem các phiếu ĐÃ gỡ thay vì danh sách đang xử lý.
   *
   * Query string luôn là chuỗi nên phải `Transform` tay: `@Type(() => Boolean)`
   * biến mọi chuỗi khác rỗng thành `true`, kể cả `"false"`.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  deleted?: boolean;

  /** Từ khoá tìm trong mã phiếu / tiêu đề / nội dung */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên' })
  @Min(1, { message: 'Trang phải lớn hơn 0' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số dòng mỗi trang phải lớn hơn 0' })
  limit?: number;
}

/** Công dân gửi phản ánh mới từ Zalo Mini App */
export class CreateCitizenFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn lĩnh vực phản ánh' })
  categoryKey: string;

  @IsString()
  @MinLength(MIN_TITLE_LENGTH, { message: `Tiêu đề phải có ít nhất ${MIN_TITLE_LENGTH} ký tự` })
  @MaxLength(MAX_TITLE_LENGTH, { message: `Tiêu đề không vượt quá ${MAX_TITLE_LENGTH} ký tự` })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng mô tả nội dung phản ánh' })
  @MaxLength(MAX_DESCRIPTION_LENGTH, { message: `Nội dung không vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự` })
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH, { message: `Địa điểm không vượt quá ${MAX_LOCATION_LENGTH} ký tự` })
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Vĩ độ không hợp lệ' })
  @Min(-90, { message: 'Vĩ độ phải nằm trong khoảng -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải nằm trong khoảng -90 đến 90' })
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Kinh độ không hợp lệ' })
  @Min(-180, { message: 'Kinh độ phải nằm trong khoảng -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải nằm trong khoảng -180 đến 180' })
  lng?: number;

  /** Id ảnh đã upload qua module Files (WBS #24) */
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh không hợp lệ' })
  @IsString({ each: true, message: 'Mã ảnh không hợp lệ' })
  @ArrayMaxSize(MAX_FEEDBACK_IMAGES, { message: `Chỉ được đính kèm tối đa ${MAX_FEEDBACK_IMAGES} ảnh` })
  imageFileIds?: string[];

  @IsOptional()
  @IsIn(FEEDBACK_CHANNELS, { message: 'Kênh gửi chỉ nhận app, zalo hoặc web' })
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  citizenName?: string;
}

/**
 * Cán bộ lập phiếu hộ người dân đến trình bày TRỰC TIẾP tại xã (WBS #6).
 *
 * Khác `CreateCitizenFeedbackDto`: người gửi không phải người đang đăng nhập,
 * nên tên và số điện thoại người dân là dữ liệu NHẬP TAY và đều tuỳ chọn —
 * người dân đến trụ sở trình bày rồi về, không bắt buộc để lại số. Toạ độ
 * không có ở đây vì cán bộ nhập trên máy tính tại trụ sở, không phải tại
 * hiện trường.
 */
export class CreateStaffFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn lĩnh vực phản ánh' })
  categoryKey: string;

  @IsString()
  @MinLength(MIN_TITLE_LENGTH, { message: `Tiêu đề phải có ít nhất ${MIN_TITLE_LENGTH} ký tự` })
  @MaxLength(MAX_TITLE_LENGTH, { message: `Tiêu đề không vượt quá ${MAX_TITLE_LENGTH} ký tự` })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng mô tả nội dung phản ánh' })
  @MaxLength(MAX_DESCRIPTION_LENGTH, { message: `Nội dung không vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự` })
  description: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa điểm xảy ra vụ việc' })
  @MaxLength(MAX_LOCATION_LENGTH, { message: `Địa điểm không vượt quá ${MAX_LOCATION_LENGTH} ký tự` })
  location: string;

  /** Thôn / tổ dân phố của người phản ánh */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH, { message: `Thôn/tổ dân phố không vượt quá ${MAX_LOCATION_LENGTH} ký tự` })
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCATION_LENGTH)
  citizenName?: string;

  /** Số điện thoại người dân để lại — cùng khuôn mẫu với RequestOtpDto */
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ' })
  citizenPhone?: string;

  /** Ảnh hiện trường cán bộ chụp/nhận từ người dân, đã tải qua module Files */
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh không hợp lệ' })
  @IsString({ each: true, message: 'Mã ảnh không hợp lệ' })
  @ArrayMaxSize(MAX_FEEDBACK_IMAGES, { message: `Chỉ được đính kèm tối đa ${MAX_FEEDBACK_IMAGES} ảnh` })
  imageFileIds?: string[];
}

/** Phân công cán bộ + bộ phận xử lý phản ánh */
export class AssignFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn cán bộ xử lý' })
  assignee: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn bộ phận chủ trì' })
  department: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH, { message: `Ghi chú không vượt quá ${MAX_NOTE_LENGTH} ký tự` })
  note?: string;
}

/** Xác nhận đã xử lý xong phản ánh */
export class ResolveFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập kết quả xử lý' })
  @MaxLength(MAX_NOTE_LENGTH, { message: `Kết quả xử lý không vượt quá ${MAX_NOTE_LENGTH} ký tự` })
  note: string;

  /** Ảnh minh chứng sau xử lý */
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh kết quả không hợp lệ' })
  @IsString({ each: true, message: 'Mã ảnh không hợp lệ' })
  @ArrayMaxSize(MAX_FEEDBACK_IMAGES, { message: `Chỉ được đính kèm tối đa ${MAX_FEEDBACK_IMAGES} ảnh` })
  resultImageFileIds?: string[];
}

/** Chuyển phản ánh sang bộ phận khác */
export class TransferFeedbackDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn bộ phận tiếp nhận' })
  department: string;

  /** Bàn giao luôn cho cán bộ mới; bỏ trống thì bộ phận tự phân công lại */
  @IsOptional()
  @IsString()
  assignee?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do chuyển bộ phận' })
  @MaxLength(MAX_NOTE_LENGTH, { message: `Lý do không vượt quá ${MAX_NOTE_LENGTH} ký tự` })
  reason: string;
}

/** Công dân đánh giá mức độ hài lòng sau khi phản ánh được xử lý */
export class RateFeedbackDto {
  @Type(() => Number)
  @IsInt({ message: 'Số sao đánh giá phải là số nguyên' })
  @Min(MIN_RATING, { message: `Vui lòng đánh giá từ ${MIN_RATING} đến ${MAX_RATING} sao` })
  @Max(MAX_RATING, { message: `Vui lòng đánh giá từ ${MIN_RATING} đến ${MAX_RATING} sao` })
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH, { message: `Nhận xét không vượt quá ${MAX_NOTE_LENGTH} ký tự` })
  ratingComment?: string;
}

/**
 * Công dân sửa phiếu của chính mình — CHỈ tiêu đề và nội dung.
 *
 * KHÔNG cho sửa lĩnh vực, địa điểm, toạ độ hay ảnh: những trường đó quyết định
 * SLA, bộ phận chủ trì và giá trị đối chứng của phiếu. Đổi chúng sau khi gửi là
 * đổi cả hạn xử lý lẫn căn cứ xác minh, mà phiếu thì đã vào sổ tiếp nhận.
 * Cần đổi thật thì thu hồi rồi gửi phiếu mới.
 *
 * Cả hai trường đều tuỳ chọn để người dân sửa riêng một thứ; service bỏ qua
 * lượt gọi không đổi gì.
 */
export class UpdateCitizenFeedbackDto {
  @IsOptional()
  @IsString()
  @MinLength(MIN_TITLE_LENGTH, { message: `Tiêu đề phải có ít nhất ${MIN_TITLE_LENGTH} ký tự` })
  @MaxLength(MAX_TITLE_LENGTH, { message: `Tiêu đề không vượt quá ${MAX_TITLE_LENGTH} ký tự` })
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng mô tả nội dung phản ánh' })
  @MaxLength(MAX_DESCRIPTION_LENGTH, { message: `Nội dung không vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự` })
  description?: string;
}

/** Công dân xin thu hồi phiếu của chính mình */
export class WithdrawFeedbackDto {
  /** Lý do thu hồi — không bắt buộc, người dân có quyền không nêu */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH, { message: `Lý do thu hồi không vượt quá ${MAX_NOTE_LENGTH} ký tự` })
  reason?: string;
}

/**
 * Cán bộ quyết định một yêu cầu thu hồi.
 *
 * `note` để tuỳ chọn ở đây vì đường ĐỒNG Ý không cần giải thích; đường TỪ CHỐI
 * bắt buộc phải có, và controller kiểm riêng — người dân phải đọc được vì sao
 * đơn của mình không được gỡ.
 */
export class DecideWithdrawDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH, { message: `Ghi chú không vượt quá ${MAX_NOTE_LENGTH} ký tự` })
  note?: string;
}
