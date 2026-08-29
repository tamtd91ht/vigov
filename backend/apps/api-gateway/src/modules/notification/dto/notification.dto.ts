import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { NotificationChannel } from '@vigov/shared';

/** Các kênh gửi hợp lệ — khớp NotificationChannel trong @vigov/shared */
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['zns', 'push', 'inapp'];

/** Nhóm đối tượng nhận thông báo hàng loạt */
export const BROADCAST_AUDIENCES = ['citizen', 'internal'] as const;

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 2000;

/** Truy vấn hộp thông báo in-app */
export class ListNotificationQueryDto {
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

/** Lịch sử các lượt gửi hàng loạt — lọc theo nhóm đối tượng, có phân trang */
export class ListBroadcastQueryDto extends ListNotificationQueryDto {
  @IsOptional()
  @IsIn(BROADCAST_AUDIENCES, { message: 'Đối tượng nhận chỉ nhận citizen hoặc internal' })
  audience?: 'citizen' | 'internal';
}

/** Gửi thông báo hàng loạt (quyền 'cms' / 'edit') */
export class BroadcastNotificationDto {
  @IsArray({ message: 'Danh sách kênh gửi không hợp lệ' })
  @ArrayNotEmpty({ message: 'Vui lòng chọn ít nhất một kênh gửi' })
  @IsIn(NOTIFICATION_CHANNELS, { each: true, message: 'Kênh gửi chỉ nhận zns, push hoặc inapp' })
  channels: NotificationChannel[];

  @IsIn(BROADCAST_AUDIENCES, { message: 'Đối tượng nhận chỉ nhận citizen hoặc internal' })
  audience: 'citizen' | 'internal';

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề thông báo' })
  @MaxLength(MAX_TITLE_LENGTH, { message: `Tiêu đề không vượt quá ${MAX_TITLE_LENGTH} ký tự` })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung thông báo' })
  @MaxLength(MAX_BODY_LENGTH, { message: `Nội dung không vượt quá ${MAX_BODY_LENGTH} ký tự` })
  body: string;

  @IsOptional()
  @IsObject({ message: 'Dữ liệu kèm theo phải là đối tượng khoá - giá trị' })
  data?: Record<string, string>;
}
