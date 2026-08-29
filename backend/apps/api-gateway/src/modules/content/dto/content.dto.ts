import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Phân trang mặc định cho danh sách CMS */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Giá trị hợp lệ dùng chung */
const ARTICLE_TYPES = ['news', 'event', 'notice'] as const;
const CONTENT_STATUSES = ['draft', 'published'] as const;
const VIDEO_SOURCES = ['youtube', 'hosted'] as const;

/** Tham số phân trang dùng lại cho mọi danh sách nội dung */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải từ 1 trở lên' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi mỗi trang phải từ 1 trở lên' })
  @Max(MAX_PAGE_SIZE, { message: `Số bản ghi mỗi trang không vượt quá ${MAX_PAGE_SIZE}` })
  limit?: number;
}

/** Bộ lọc danh sách bài viết trong Web Quản trị */
export class ListArticleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ARTICLE_TYPES, { message: 'Loại bài viết phải là news, event hoặc notice' })
  type?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;

  /** Từ khoá tìm trong tiêu đề/tóm tắt */
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi ký tự' })
  q?: string;
}

/** Bộ lọc danh sách bài viết công khai cho app công dân */
export class PublicArticleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ARTICLE_TYPES, { message: 'Loại bài viết phải là news, event hoặc notice' })
  type?: string;
}

/** Tạo bài viết mới */
export class CreateArticleDto {
  @IsEnum(ARTICLE_TYPES, { message: 'Loại bài viết phải là news, event hoặc notice' })
  type: string;

  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề bài viết' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'Tóm tắt phải là chuỗi ký tự' })
  excerpt?: string;

  @IsOptional()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự' })
  content?: string;

  @IsOptional()
  @IsString({ message: 'Màu ảnh bìa phải là chuỗi ký tự' })
  coverColor?: string;

  @IsOptional()
  @IsString({ message: 'Mã tệp ảnh bìa phải là chuỗi ký tự' })
  coverFileId?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;
}

/** Cập nhật bài viết — mọi trường đều tuỳ chọn */
export class UpdateArticleDto {
  @IsOptional()
  @IsEnum(ARTICLE_TYPES, { message: 'Loại bài viết phải là news, event hoặc notice' })
  type?: string;

  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'Tóm tắt phải là chuỗi ký tự' })
  excerpt?: string;

  @IsOptional()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự' })
  content?: string;

  @IsOptional()
  @IsString({ message: 'Màu ảnh bìa phải là chuỗi ký tự' })
  coverColor?: string;

  @IsOptional()
  @IsString({ message: 'Mã tệp ảnh bìa phải là chuỗi ký tự' })
  coverFileId?: string;
}

/** Đổi trạng thái phát hành bài viết */
export class PublishArticleDto {
  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;
}

/** Bộ lọc danh sách video */
export class ListVideoQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  topic?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;

  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi ký tự' })
  q?: string;
}

/** Tạo video tuyên truyền */
export class CreateVideoDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề video' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  topic?: string;

  @IsOptional()
  @IsString({ message: 'Thời lượng phải là chuỗi ký tự, ví dụ "05:12"' })
  duration?: string;

  @IsEnum(VIDEO_SOURCES, { message: 'Nguồn video phải là youtube hoặc hosted' })
  source: string;

  @IsOptional()
  @IsString({ message: 'Mã tệp video phải là chuỗi ký tự' })
  videoFileId?: string;

  @IsOptional()
  @IsString({ message: 'Đường dẫn YouTube phải là chuỗi ký tự' })
  youtubeUrl?: string;

  @IsOptional()
  @IsString({ message: 'Màu ảnh bìa phải là chuỗi ký tự' })
  coverColor?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;
}

/** Cập nhật video */
export class UpdateVideoDto {
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  topic?: string;

  @IsOptional()
  @IsString({ message: 'Thời lượng phải là chuỗi ký tự, ví dụ "05:12"' })
  duration?: string;

  @IsOptional()
  @IsEnum(VIDEO_SOURCES, { message: 'Nguồn video phải là youtube hoặc hosted' })
  source?: string;

  @IsOptional()
  @IsString({ message: 'Mã tệp video phải là chuỗi ký tự' })
  videoFileId?: string;

  @IsOptional()
  @IsString({ message: 'Đường dẫn YouTube phải là chuỗi ký tự' })
  youtubeUrl?: string;

  @IsOptional()
  @IsString({ message: 'Màu ảnh bìa phải là chuỗi ký tự' })
  coverColor?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;
}

/** Bộ lọc danh sách bản tin truyền thanh */
export class ListRadioQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  category?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;

  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi ký tự' })
  q?: string;
}

/** Tạo bản tin truyền thanh */
export class CreateRadioDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề bản tin' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'Ngày phát phải là chuỗi ký tự, ví dụ "27/08/2026"' })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thời lượng (giây) phải là số nguyên' })
  @Min(0, { message: 'Thời lượng không được âm' })
  durationSeconds?: number;

  @IsOptional()
  @IsString({ message: 'Mã tệp audio phải là chuỗi ký tự' })
  audioFileId?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;
}

/** Cập nhật bản tin truyền thanh */
export class UpdateRadioDto {
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Chuyên mục phải là chuỗi ký tự' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'Ngày phát phải là chuỗi ký tự, ví dụ "27/08/2026"' })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thời lượng (giây) phải là số nguyên' })
  @Min(0, { message: 'Thời lượng không được âm' })
  durationSeconds?: number;

  @IsOptional()
  @IsString({ message: 'Mã tệp audio phải là chuỗi ký tự' })
  audioFileId?: string;

  @IsOptional()
  @IsEnum(CONTENT_STATUSES, { message: 'Trạng thái phải là draft hoặc published' })
  status?: string;
}
