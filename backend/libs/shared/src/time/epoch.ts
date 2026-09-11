import type { FilterQuery } from 'mongoose';

/**
 * Mốc thời gian dùng chung cho toàn hệ thống — nâng cấp v2.
 *
 * ## Một kiểu duy nhất: số milli-giây từ mốc Unix
 *
 * Trước v2, cùng một khái niệm "thời điểm" được lưu ba kiểu khác nhau: `Date`
 * (`createdAt`, `slaDueAt`), chuỗi `dd/MM/yyyy` (`deadline` của nhiệm vụ và văn
 * bản), và chuỗi `HH:mm dd/MM/yyyy` (thời điểm bình luận, nhật ký xử lý). Hệ
 * quả: hai nguồn sự thật cho cùng một cái hạn, và không truy vấn được "ai làm
 * gì trong tháng" vì thời điểm nằm trong một chuỗi đã ghép sẵn để hiển thị.
 *
 * v2 lưu MỌI mốc thời gian bằng `number` = milli-giây UTC. So sánh, sắp xếp,
 * lập index và lọc khoảng đều làm trực tiếp trên trường số.
 *
 * ## Giờ Việt Nam chỉ được quy đổi ở ĐÂY
 *
 * Nghiệp vụ hành chính Việt Nam luôn tính theo ngày giờ Việt Nam, nhưng
 * container gần như luôn chạy UTC. Nếu mỗi service tự cộng 7 giờ thì sớm muộn
 * có chỗ cộng hai lần hoặc quên cộng — và sai lệch kiểu đó không làm vỡ gì cả,
 * nó chỉ âm thầm đẩy vài bản ghi ra khỏi báo cáo. Nên toàn bộ phép quy đổi nằm
 * trong tệp này; nơi khác chỉ gọi hàm, không tự tính giờ.
 */

/** Milli-giây từ mốc Unix (UTC). Kiểu của mọi trường thời gian trong CSDL v2. */
export type EpochMs = number;

/**
 * Lệch giờ Việt Nam so với UTC.
 *
 * Cố định +7, KHÔNG đọc giờ máy chủ: Việt Nam không dùng giờ mùa hè, nên một
 * hằng số là đúng và đọc được; còn phụ thuộc giờ máy chủ thì cùng một bản ghi
 * sẽ rơi vào hai ngày khác nhau tuỳ container.
 */
const VN_OFFSET_MS = 7 * 60 * 60_000;

const DAY_MS = 24 * 60 * 60_000;

/** `dd/MM/yyyy` — định dạng ngày người dùng nhập và đọc */
const VN_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Thời điểm hiện tại. Gom về một hàm để test thay thế được. */
export function nowMs(): EpochMs {
  return Date.now();
}

/**
 * Quy về `EpochMs` từ những kiểu có thể gặp khi đọc dữ liệu cũ hoặc dữ liệu vào.
 *
 * Trả `undefined` khi KHÔNG chắc chắn hiểu đúng giá trị. Cố ý không đoán: một
 * mốc thời gian đoán sai trên hồ sơ hành chính tệ hơn một trường để trống, vì
 * trống thì nhìn ra ngay còn đoán sai thì không ai phát hiện.
 */
export function toEpochMs(value: unknown): EpochMs | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? undefined : ms;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Chuỗi toàn số = epoch gửi qua query string (`?from=1789036200000`)
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * `dd/MM/yyyy` → mốc **hết ngày** đó theo giờ Việt Nam (23:59:59.999).
 *
 * Hạn xử lý trong hành chính tính đến hết ngày: hạn 11/09 thì 11/09 lúc 17 giờ
 * vẫn còn hạn. Lấy 00:00 làm mốc là coi cả ngày cuối là quá hạn.
 *
 * Khác bản v1 (`parseVnDate` ở `tasks.service.ts`): bản cũ dựng
 * `new Date(y, m-1, d, 23, 59, 59, 999)` theo giờ **máy chủ**, nên trên
 * container UTC nó ra 23:59:59 UTC = 06:59 sáng hôm sau giờ Việt Nam — hạn bị
 * nới thêm 7 giờ. v2 neo thẳng vào giờ Việt Nam.
 *
 * Trả `undefined` cho ngày không tồn tại (31/02/2026) thay vì để `Date` tự cuộn
 * sang tháng sau.
 */
export function parseVnDateMs(value?: string | null): EpochMs | undefined {
  if (!value) return undefined;
  const matched = VN_DATE_RE.exec(value.trim());
  if (!matched) return undefined;

  const day = Number(matched[1]);
  const month = Number(matched[2]);
  const year = Number(matched[3]);

  // Đọc lại để loại ngày không tồn tại: Date.UTC(2026, 1, 31) tự thành 03/03
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return undefined;
  }

  return Date.UTC(year, month - 1, day, 23, 59, 59, 999) - VN_OFFSET_MS;
}

/**
 * `yyyy-MM-dd` → mốc **00:00 giờ Việt Nam** của ngày đó.
 * Dùng cho bộ lọc khoảng thời gian, nơi tham số vào theo chuẩn ISO.
 */
export function vnStartOfDayMs(isoDate: string): EpochMs {
  const [y, m, d] = isoDate.split('-').map((part) => Number.parseInt(part, 10));
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0) - VN_OFFSET_MS;
}

/** Mốc → `dd/MM/yyyy` theo giờ Việt Nam */
export function formatVnDateMs(ms: EpochMs): string {
  const vn = new Date(ms + VN_OFFSET_MS);
  return `${pad2(vn.getUTCDate())}/${pad2(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}

/**
 * Mốc → `HH:mm dd/MM/yyyy` theo giờ Việt Nam (24 giờ, không AM/PM).
 *
 * Chỉ dùng cho tệp xuất và nhật ký máy chủ. Giao diện tự định dạng từ số —
 * backend v2 không trả chuỗi thời gian đã ghép sẵn nữa.
 */
export function formatVnDateTimeMs(ms: EpochMs): string {
  const vn = new Date(ms + VN_OFFSET_MS);
  return `${pad2(vn.getUTCHours())}:${pad2(vn.getUTCMinutes())} ${formatVnDateMs(ms)}`;
}

/**
 * Điều kiện Mongo cho một khoảng ngày trên trường thời gian dạng số.
 *
 * Thay `buildDateRangeFilter` của v1; giữ nguyên chữ ký và nguyên tắc: mốc cuối
 * là 00:00 của NGÀY KẾ TIẾP với `$lt`, không phải 23:59:59 của ngày cuối — bản
 * ghi tạo lúc 23:59:59.500 mà bị loại thì không ai hiểu vì sao báo cáo thiếu
 * một phiếu.
 *
 * Trả `undefined` khi không có mốc nào, để nơi gọi không gán điều kiện rỗng.
 */
export function buildEpochRangeFilter(
  field: string,
  from?: string,
  to?: string,
): FilterQuery<Record<string, unknown>> | undefined {
  const range: { $gte?: EpochMs; $lt?: EpochMs } = {};
  if (from) range.$gte = vnStartOfDayMs(from);
  if (to) range.$lt = vnStartOfDayMs(to) + DAY_MS;
  if (range.$gte === undefined && range.$lt === undefined) return undefined;
  return { [field]: range };
}

/**
 * Số ngày còn lại tới `deadline` (âm = đã quá hạn).
 *
 * Làm tròn LÊN: còn 2 giờ tới hạn vẫn là "còn 1 ngày", không phải "còn 0 ngày" —
 * cán bộ đọc "0 ngày" sẽ hiểu là hết hạn hôm nay trong khi thực tế vẫn còn giờ.
 */
export function daysLeftMs(deadline: EpochMs, from: EpochMs = nowMs()): number {
  return Math.ceil((deadline - from) / DAY_MS);
}

/**
 * Chuẩn hoá một mốc bất kỳ về **hết ngày** của chính ngày đó theo giờ Việt Nam.
 *
 * Hạn xử lý trong hành chính là một NGÀY, không phải một thời điểm: "hạn 11/09"
 * nghĩa là hết ngày 11/09. Client gửi lên mốc nào trong ngày cũng được — máy chủ
 * chuẩn hoá, nên luật "hạn tính hết ngày" nằm ở đúng một chỗ và không client nào
 * lách được bằng cách gửi 00:00.
 */
export function endOfVnDayMs(ms: EpochMs): EpochMs {
  const vn = new Date(ms + VN_OFFSET_MS);
  return (
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), 23, 59, 59, 999) -
    VN_OFFSET_MS
  );
}

/**
 * Số **ngày lịch** giữa hai mốc, tính theo ngày giờ Việt Nam (âm = đã qua).
 *
 * Khác `daysLeftMs`: hàm này so hai NGÀY, không so hai thời điểm. Hạn hôm nay
 * trả về `0`, hạn mai trả `1`, hạn hôm qua trả `-1` — bất kể trong ngày đang là
 * mấy giờ.
 *
 * Cần cả hai cách đếm vì hai phân hệ hiểu "còn mấy ngày" khác nhau: phiếu văn
 * bản hiện "còn 0 ngày" nghĩa là hết hôm nay, còn nhiệm vụ hiện "còn 1 ngày"
 * cho cùng tình huống. Gom về một hàm là đổi con số đang hiển thị cho cán bộ ở
 * một trong hai phân hệ, nên giữ đúng hai nghĩa và gọi tên rõ ràng.
 */
export function vnDaysBetween(target: EpochMs, from: EpochMs = nowMs()): number {
  const ngay = (ms: EpochMs) => {
    const vn = new Date(ms + VN_OFFSET_MS);
    return Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  };
  return Math.round((ngay(target) - ngay(from)) / DAY_MS);
}

/**
 * Khoảng của **tháng** chứa mốc đã cho, tính theo giờ Việt Nam.
 *
 * Trả `[from, to)` — mốc đầu tháng và mốc đầu tháng kế tiếp, dùng trực tiếp làm
 * `{ $gte: from, $lt: to }`.
 *
 * Bản v1 dựng biên tháng bằng `new Date(now.getFullYear(), now.getMonth(), 1)`,
 * tức theo giờ MÁY CHỦ. Trên container UTC, biên tháng lệch 7 giờ nên phiếu gửi
 * lúc 2 giờ sáng ngày 1 bị đếm vào tháng trước — thống kê "tiếp nhận trong
 * tháng" thiếu bản ghi mà không ai truy được vì sao.
 */
export function vnMonthRangeMs(ms: EpochMs = nowMs()): { from: EpochMs; to: EpochMs } {
  const vn = new Date(ms + VN_OFFSET_MS);
  const nam = vn.getUTCFullYear();
  const thang = vn.getUTCMonth();
  return {
    from: Date.UTC(nam, thang, 1) - VN_OFFSET_MS,
    to: Date.UTC(nam, thang + 1, 1) - VN_OFFSET_MS,
  };
}

/** Năm theo lịch Việt Nam của một mốc — dùng cho mã hồ sơ và số liệu theo năm */
export function vnYearOf(ms: EpochMs = nowMs()): number {
  return new Date(ms + VN_OFFSET_MS).getUTCFullYear();
}
