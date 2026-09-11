/**
 * Khoảng thời gian dùng cho bộ lọc danh sách.
 *
 * Đặt ở `config/` vì đây là quy ước hiển thị dùng chung cho mọi phân hệ: đổi
 * cách gọi kỳ ("Quý" ↔ "Kỳ") hay thêm một mốc chọn nhanh thì sửa một tệp.
 *
 * MỌI PHÉP TÍNH DÙNG NGÀY THEO GIỜ VIỆT NAM. Không dùng `toISOString()` để lấy
 * ngày: hàm đó đổi sang UTC nên ngày 01/03 lúc 00:00 giờ Việt Nam thành 28/02 —
 * lệch một ngày ở đúng hai đầu kỳ, chỗ số liệu báo cáo hay bị hỏi lại nhất.
 */

export interface DateRange {
  /** `yyyy-MM-dd`; rỗng = không chặn đầu này */
  from: string;
  to: string;
}

export type DatePresetKind = "week" | "month" | "quarter" | "year";

export const DATE_PRESET_GROUPS: { kind: DatePresetKind; label: string }[] = [
  { kind: "week", label: "Tuần" },
  { kind: "month", label: "Tháng" },
  { kind: "quarter", label: "Quý" },
  { kind: "year", label: "Năm" },
];

/** `yyyy-MM-dd` theo lịch địa phương, KHÔNG qua UTC */
export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `dd/MM/yyyy` — định dạng ngày của văn bản hành chính Việt Nam */
export function toVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Thứ Hai của tuần ISO thứ `week` trong năm */
function isoWeekStart(year: number, week: number): Date {
  // 04/01 luôn thuộc tuần ISO thứ 1 của năm — mốc chuẩn để suy các tuần khác
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7; // 0 = thứ Hai
  const week1Monday = new Date(year, 0, 4 - jan4Dow);
  return new Date(year, 0, week1Monday.getDate() + (week - 1) * 7, 0, 0, 0, 0);
}

/** Số tuần ISO của một năm: 52, hoặc 53 với năm nhuận tuần */
export function isoWeeksOfYear(year: number): number {
  const dec28 = new Date(year, 11, 28);
  const start = isoWeekStart(year, 1);
  const diffDays = Math.round((dec28.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Khoảng ngày của một kỳ.
 * @param index tháng 1..12, quý 1..4, tuần 1..53. Bỏ qua với `year`.
 */
export function presetRange(kind: DatePresetKind, year: number, index = 1): DateRange {
  if (kind === "year") {
    return { from: toIsoDate(new Date(year, 0, 1)), to: toIsoDate(new Date(year, 11, 31)) };
  }
  if (kind === "quarter") {
    const firstMonth = (index - 1) * 3;
    // Ngày 0 của tháng kế tiếp = ngày cuối tháng này, không phải tự đếm 28/30/31
    return {
      from: toIsoDate(new Date(year, firstMonth, 1)),
      to: toIsoDate(new Date(year, firstMonth + 3, 0)),
    };
  }
  if (kind === "month") {
    return {
      from: toIsoDate(new Date(year, index - 1, 1)),
      to: toIsoDate(new Date(year, index, 0)),
    };
  }
  const monday = isoWeekStart(year, index);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: toIsoDate(monday), to: toIsoDate(sunday) };
}

/** Nhãn hiển thị trên nút lọc */
export function formatRangeLabel(range: DateRange): string {
  if (range.from && range.to) return `${toVnDate(range.from)} – ${toVnDate(range.to)}`;
  if (range.from) return `Từ ${toVnDate(range.from)}`;
  if (range.to) return `Đến ${toVnDate(range.to)}`;
  return "";
}
