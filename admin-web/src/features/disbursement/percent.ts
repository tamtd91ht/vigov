import type { BudgetItem, ScheduleState } from "@/types";
import { progressColor } from "@/lib/format";

/**
 * Tỷ lệ và màu tiến độ của một hạng mục.
 *
 * Tỷ lệ do MÁY CHỦ tính và trả về trong `percent` — ở đây chỉ đọc lại. Tính lại
 * ở giao diện là sớm muộn lệch với tệp xuất và với báo cáo, và không ai biết con
 * số nào đúng.
 */

/** Tỷ lệ giải ngân (0–100). `null` = chưa có kế hoạch vốn, KHÁC "giải ngân 0%" */
export function itemPercent(item: BudgetItem): number | null {
  return item.percent ?? null;
}

/** Nhãn tỷ lệ để hiển thị; chưa có kế hoạch vốn thì hiện dấu gạch */
export function percentLabel(item: BudgetItem): string {
  const percent = itemPercent(item);
  return percent === null ? "—" : `${percent}%`;
}

/**
 * Màu theo TÌNH TRẠNG TIẾN ĐỘ, không theo tỷ lệ giải ngân.
 *
 * Bản cũ tô màu theo tỷ lệ nên hạng mục mới giao dự toán đầu năm (0%) hiện màu
 * đỏ như thể đang chậm. Tình trạng tiến độ là kết luận đã tính cả yếu tố thời
 * gian, nên nó mới là thứ đáng tô màu.
 */
const SCHEDULE_COLORS: Record<ScheduleState, string> = {
  "hoan-thanh": "var(--green)",
  "dung-tien-do": "var(--blue)",
  "nguy-co-cham": "var(--orange)",
  cham: "var(--red)",
  "chua-den-han": "var(--mut)",
};

export function itemColor(item: BudgetItem): string {
  const state = item.scheduleState;
  if (state && SCHEDULE_COLORS[state]) return SCHEDULE_COLORS[state];
  // Máy chủ chưa trả tình trạng (bản ghi cũ) thì lùi về màu theo tỷ lệ
  return progressColor(itemPercent(item) ?? 0);
}

/** Nền nhạt cùng tông với `itemColor`, dùng cho chip trạng thái */
export function itemTint(item: BudgetItem): string {
  const color = itemColor(item);
  return `color-mix(in srgb, ${color} 12%, transparent)`;
}
