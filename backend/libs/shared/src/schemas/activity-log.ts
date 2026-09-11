import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { nowMs, type EpochMs } from '../time/epoch';

/**
 * Nhật ký xử lý dùng chung cho MỌI phân hệ — nâng cấp v2.
 *
 * Thay `TimelineStep` của v1, khuôn cũ nhốt ba thông tin vào hai chuỗi đã ghép
 * sẵn để hiển thị:
 *
 * ```
 * { title: 'Chuyển trạng thái: Hoàn thành',
 *   meta:  '14:30 11/09/2026 · Nguyễn Văn Bình',
 *   state: 'cur' }
 * ```
 *
 * Khuôn đó có ba hệ quả, đều đã gặp thật:
 *
 * 1. **Không truy vấn được.** Câu hỏi "cán bộ nào xử lý bao nhiêu việc tháng
 *    này" phải bóc chuỗi `meta` để lấy tên và thời điểm — nên báo cáo đó chưa
 *    làm được.
 * 2. **Nhãn tiếng Việt nằm trong cơ sở dữ liệu.** Đổi cách gọi một trạng thái
 *    là phải chạy script sửa dữ liệu lịch sử, trong khi nhãn hiển thị lẽ ra
 *    thuộc tầng cấu hình (`rules/critical/khong-hardcode.md`).
 * 3. **Người thực hiện lưu bằng tên.** Hai cán bộ trùng họ tên là không phân
 *    biệt được, và cán bộ đổi tên thì nhật ký cũ nói tên cũ.
 *
 * v2 tách ra: thời điểm là số, người thực hiện là id, hành động là khoá ổn
 * định, phần biến nằm riêng. Nhãn tiếng Việt do client tra từ bảng cấu hình
 * (`admin-web/src/config/activity.config.ts`).
 */

/** Giá trị hợp lệ của `ActivityEntry.state` — nguồn chuẩn cho cả enum Mongoose lẫn kiểu TS */
export const ACTIVITY_STATES = ['ok', 'cur'] as const;
export type ActivityState = (typeof ACTIVITY_STATES)[number];

/**
 * Dạng hợp lệ của khoá hành động: `<phân hệ>.<hành động>`, chữ thường, cho phép
 * gạch nối. Ví dụ: `task.assign`, `task.status`, `document.transfer`,
 * `disbursement.approve`.
 *
 * ## Vì sao là biểu thức chính quy, không phải danh sách đóng
 *
 * Một `enum` đóng buộc mọi phân hệ phải khai hành động của mình vào tệp dùng
 * chung này — thêm một hành động ở phân hệ Giải ngân lại phải sửa `libs/shared`.
 * Ngược lại, để `string` trần thì sớm muộn có người ghi thẳng nhãn tiếng Việt
 * vào đây và khuôn v2 mất ý nghĩa. Ràng buộc dạng chuỗi chặn đúng việc đó: nhãn
 * tiếng Việt không khớp biểu thức nên bị Mongoose từ chối ngay khi ghi.
 */
export const ACTION_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/;

/** Một mốc trong nhật ký xử lý của bản ghi nghiệp vụ */
@Schema({ _id: false })
export class ActivityEntry {
  /** Thời điểm xảy ra, milli-giây UTC */
  @Prop({ type: Number, required: true })
  at: number;

  /**
   * `staff_users._id` của cán bộ thực hiện.
   *
   * Rỗng nghĩa là **hệ thống** làm (cron nhắc hạn, consumer hàng đợi, di trú) —
   * dùng chuỗi rỗng chứ không phải `undefined` để mọi bản ghi có cùng bộ trường,
   * đọc ra không phải kiểm tồn tại ở từng chỗ hiển thị.
   */
  @Prop({ default: '' })
  actorId: string;

  /**
   * Khoá hành động, ví dụ `task.status`. KHÔNG phải nhãn tiếng Việt.
   *
   * Ràng buộc dạng chuỗi là thứ duy nhất chặn nhãn hiển thị lọt lại vào cơ sở
   * dữ liệu — xem chú thích ở `ACTION_PATTERN`.
   */
  @Prop({
    required: true,
    match: [ACTION_PATTERN, 'Khoá hành động phải theo dạng <phân hệ>.<hành động>, chữ thường'],
  })
  action: string;

  /**
   * Phần biến của hành động: khoá trạng thái mới, mã bản ghi liên quan, số
   * lượng tệp… Client ghép với nhãn để dựng câu hiển thị.
   *
   * Không đặt câu tiếng Việt hoàn chỉnh vào đây — câu là việc của tầng hiển thị.
   */
  @Prop({ default: '' })
  detail: string;

  /**
   * `ok` = mốc đã qua · `cur` = bản ghi đang ở bước này.
   *
   * Khai UNION chứ không phải `string` là có chủ ý, giữ nguyên bài học TB-19 của
   * v1: khi để `string`, TypeScript không chặn được `state: 'done'` — giá trị
   * ngoài enum của Mongoose — và nó lọt tới lúc chạy thành `ValidationError` ở
   * `save()`. Vì đó không phải `HttpException`, cả lời gọi trả 500. Cùng một lỗi
   * đã làm vỡ "đính kèm phụ lục văn bản" rồi vỡ tiếp "xoá mềm văn bản".
   */
  @Prop({ enum: ACTIVITY_STATES, default: 'ok' })
  state: ActivityState;
}

export const ActivityEntrySchema = SchemaFactory.createForClass(ActivityEntry);

/**
 * Dựng một mốc nhật ký. Dùng hàm này thay vì tự tạo đối tượng, để mọi phân hệ
 * ghi cùng một bộ trường và không phân hệ nào quên `at`.
 *
 * @param action khoá hành động dạng `<phân hệ>.<hành động>`
 */
export function activity(
  action: string,
  options: {
    /** `staff_users._id`; bỏ trống = hệ thống thực hiện */
    actorId?: string;
    detail?: string;
    state?: ActivityState;
    /** Ghi đè thời điểm — chỉ dùng cho script di trú dữ liệu lịch sử */
    at?: EpochMs;
  } = {},
): ActivityEntry {
  return {
    at: options.at ?? nowMs(),
    actorId: options.actorId ?? '',
    action,
    detail: options.detail ?? '',
    state: options.state ?? 'ok',
  };
}
