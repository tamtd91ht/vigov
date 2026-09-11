import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional } from 'class-validator';

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

/*
 * `vnStartOfDay` và `buildDateRangeFilter` đã chuyển sang `time/epoch.ts` dưới
 * dạng `vnStartOfDayMs` / `buildEpochRangeFilter` — nâng cấp v2 lưu mọi mốc
 * thời gian bằng số, nên điều kiện lọc khoảng cũng phải so trên số.
 *
 * Không giữ bản cũ song song: hai hàm cùng nghĩa mà khác kiểu trả về là chỗ để
 * người sau gọi nhầm, và lọc sai khoảng thời gian thì báo cáo thiếu bản ghi mà
 * không báo lỗi gì.
 */

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
