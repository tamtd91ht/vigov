import type { BudgetItem } from "@/types";
import { progressColor } from "@/lib/format";

/** % giải ngân của một hạng mục (0–100, làm tròn) */
export function itemPercent(item: BudgetItem): number {
  if (item.planned <= 0) return 0;
  return Math.round((item.actual / item.planned) * 100);
}

/** Màu tiến độ của hạng mục — chậm tiến độ luôn hiển thị đỏ (CSS var) */
export function itemColor(item: BudgetItem): string {
  return item.delayed ? "var(--red)" : progressColor(itemPercent(item));
}
