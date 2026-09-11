import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Kiểm tra một mốc thời gian nhận từ client — nâng cấp v2.
 *
 * ## Vì sao phải chặn khoảng, không chỉ `@IsInt()`
 *
 * Cái bẫy hay gặp nhất khi API nhận epoch là **lẫn giây với milli-giây**. Một
 * client gửi `1789036200` (giây) thay vì `1789036200000` (milli-giây) thì giá
 * trị vẫn là số nguyên dương hợp lệ, `@IsInt()` cho qua, và bản ghi được lưu
 * với mốc **20/01/1970**. Không có lỗi nào, chỉ là hạn xử lý của một hồ sơ hành
 * chính thành quá hạn 56 năm — và cron nhắc hạn sẽ dội cảnh báo.
 *
 * Chặn khoảng làm lỗi đó lộ ngay tại biên, kèm thông báo tiếng Việt nói rõ đơn
 * vị phải dùng.
 */

/** 01/01/2000 — mốc dưới; giá trị nhỏ hơn gần như luôn là lẫn giây với milli-giây */
export const EPOCH_MS_MIN = Date.UTC(2000, 0, 1);

/** 01/01/2100 — mốc trên; giá trị lớn hơn gần như luôn là lẫn micro-giây */
export const EPOCH_MS_MAX = Date.UTC(2100, 0, 1);

const DON_VI =
  'Mốc thời gian phải là số milli-giây kể từ 01/01/1970 (không phải giây)';

/**
 * Mốc thời gian dạng số milli-giây, bắt buộc.
 *
 * @param nhan tên trường bằng tiếng Việt để đưa vào thông báo lỗi cho cán bộ
 */
export function IsEpochMs(nhan: string): PropertyDecorator {
  return applyDecorators(
    Type(() => Number),
    IsInt({ message: `${nhan} không hợp lệ. ${DON_VI}` }),
    Min(EPOCH_MS_MIN, { message: `${nhan} quá nhỏ. ${DON_VI}` }),
    Max(EPOCH_MS_MAX, { message: `${nhan} quá lớn. ${DON_VI}` }),
  );
}
