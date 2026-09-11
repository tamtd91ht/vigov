import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional } from 'class-validator';
import type { FilterQuery } from 'mongoose';

/**
 * DTO và tiện ích dùng chung cho bộ lọc danh sách: chọn nhiều giá trị và lọc
 * theo khoảng thời gian.
 *
 * Mọi phân hệ có bảng danh sách đều dùng chung hai thứ này thay vì mỗi nơi tự
 * tách chuỗi một kiểu — bốn phân hệ tự làm là bốn hành vi khác nhau ở cùng một
 * API, và chỗ lệch sẽ lộ ra ở báo cáo.
 */

/**
 * Tham số truy vấn cho phép chọn nhiều giá trị.
 *
 * Giao diện gửi tham số LẶP LẠI (`?status=moi&status=dang-lam`) nên
 * class-transformer nhận chuỗi khi có một giá trị và mảng khi có nhiều. Hàm này
 * luôn quy về mảng để service chỉ viết một nhánh `$in`.
 *
 * Cũng nhận dạng phân tách bằng dấu phẩy để gọi API bằng tay cho tiện, nhưng
 * đường chính là tham số lặp: tên cán bộ có thể chứa dấu phẩy, tách theo dấu
 * phẩy sẽ cắt sai tên.
 */
export function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((v) => (typeof v === 'string' && v.includes(',') ? v.split(',') : [v]))
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  return list.length > 0 ? list : undefined;
}

/** Dùng làm `@Transform(({ value }) => toStringArray(value))` cho gọn */
export const TransformStringArray = () => Transform(({ value }) => toStringArray(value));

/**
 * Bộ lọc khoảng thời gian, dạng `yyyy-MM-dd`.
 *
 * Nhận NGÀY chứ không nhận dấu thời gian đầy đủ: cán bộ chọn "từ 01/03 đến
 * 31/03" và mong cả hai ngày đó được tính. Chuyển sang mốc thời gian là việc
 * của `buildDateRangeFilter` — làm một chỗ để không nơi nào quên cộng nốt ngày
 * cuối, lỗi làm mất toàn bộ bản ghi của ngày cuối kỳ.
 */
export class DateRangeQueryDto {
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Mốc "từ ngày" phải theo định dạng yyyy-MM-dd' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'Mốc "đến ngày" phải theo định dạng yyyy-MM-dd' })
  to?: string;
}

/**
 * Lệch múi giờ giữa giờ Việt Nam (UTC+7) và UTC, tính bằng phút.
 *
 * VÌ SAO PHẢI CỐ ĐỊNH, KHÔNG DÙNG GIỜ MÁY CHỦ: container thường chạy UTC. Nếu
 * suy mốc ngày theo giờ máy chủ thì "ngày 01/03" thành 01/03 07:00 giờ Việt
 * Nam — bản ghi tạo lúc 2 giờ sáng bị loại khỏi báo cáo. Nghiệp vụ hành chính
 * Việt Nam luôn tính theo ngày giờ Việt Nam.
 */
const VN_OFFSET_MINUTES = 7 * 60;

/** Mốc UTC ứng với 00:00 giờ Việt Nam của ngày `yyyy-MM-dd` */
function vnStartOfDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0) - VN_OFFSET_MINUTES * 60_000);
}

/**
 * Điều kiện Mongo cho một khoảng ngày trên trường `field`.
 *
 * Mốc cuối là 00:00 của NGÀY KẾ TIẾP với toán tử `$lt` — không dùng 23:59:59
 * của ngày cuối, vì bản ghi tạo lúc 23:59:59.500 sẽ bị loại và không ai hiểu
 * vì sao báo cáo thiếu một phiếu.
 *
 * Trả `undefined` khi không có mốc nào, để nơi gọi không gán một điều kiện rỗng.
 */
export function buildDateRangeFilter(
  field: string,
  from?: string,
  to?: string,
): FilterQuery<Record<string, unknown>> | undefined {
  const range: { $gte?: Date; $lt?: Date } = {};
  if (from) range.$gte = vnStartOfDay(from);
  if (to) {
    const start = vnStartOfDay(to);
    range.$lt = new Date(start.getTime() + 24 * 60 * 60_000);
  }
  if (range.$gte === undefined && range.$lt === undefined) return undefined;
  return { [field]: range };
}

/** Nhãn khoảng thời gian in trên tệp xuất — `dd/MM/yyyy`, nêu rõ hai mốc */
export function dateRangeLabel(from?: string, to?: string): string {
  const vn = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  if (from && to) return `từ ${vn(from)} đến ${vn(to)}`;
  if (from) return `từ ${vn(from)}`;
  if (to) return `đến ${vn(to)}`;
  return 'toàn bộ thời gian';
}
