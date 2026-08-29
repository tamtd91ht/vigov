import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FILE_PURPOSES, MAX_SIGNED_URL_TTL_SECONDS } from '../files.service';

/** Chuyển giá trị chuỗi của form-data ('true'/'1') thành boolean */
const toBoolean = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1' || value === 1;

/** Thông tin kèm theo tệp tải lên (multipart/form-data) */
export class UploadFileDto {
  @IsOptional()
  @IsIn(FILE_PURPOSES as unknown as string[], {
    message: `Mục đích tệp phải thuộc: ${FILE_PURPOSES.join(', ')}`,
  })
  purpose?: string;

  /** Tệp riêng tư chỉ đọc được qua link ký sẵn */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPrivate?: boolean;
}

/** Tham số của link ký sẵn khi đọc tệp riêng tư */
export class FileAccessQueryDto {
  @IsOptional()
  @IsString()
  exp?: string;

  @IsOptional()
  @IsString()
  sig?: string;
}

/** Tham số cấp link ký sẵn */
export class SignedUrlQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Hiệu lực link phải là số giây nguyên' })
  @Min(1)
  @Max(MAX_SIGNED_URL_TTL_SECONDS, {
    message: `Hiệu lực link tối đa ${MAX_SIGNED_URL_TTL_SECONDS} giây`,
  })
  ttl?: number;
}
