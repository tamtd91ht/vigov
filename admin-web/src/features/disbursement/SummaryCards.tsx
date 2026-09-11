import { KpiCard } from "@/components/ui/KpiCard";
import { progressColor } from "@/lib/format";
import { formatVnd, formatVndShort } from "@/lib/money";
import type { BudgetItem } from "@/types";
import type { DisbursementSummary } from "@/services/disbursement.service";

interface SummaryCardsProps {
  /** Số liệu tổng hợp do server tính — KHÔNG cộng lại ở trình duyệt */
  summary: DisbursementSummary;
  items: BudgetItem[];
  year: number;
}

/**
 * Bốn thẻ tóm tắt tình hình giải ngân toàn xã.
 *
 * Thẻ tỷ lệ: `percent === null` nghĩa là CHƯA CÓ kế hoạch vốn nào — hiện "—"
 * chứ không hiện 0%. Hai thứ đó khác nhau và người đọc báo cáo phải phân biệt
 * được, nếu không cấp trên sẽ hỏi vì sao xã giải ngân 0%.
 */
export function SummaryCards({ summary, items, year }: SummaryCardsProps) {
  const fundingSourceCount = new Set(items.map((it) => it.fundingSource)).size;
  const lateNames = items
    .filter((it) => it.scheduleState === "cham")
    .map((it) => it.name)
    .join(" · ");

  const percentText = summary.percent === null ? "—" : `${summary.percent}%`;

  return (
    <div className="grid4" style={{ marginBottom: 20 }}>
      <KpiCard
        value={formatVndShort(summary.totalPlannedDong)}
        label={`Tổng kế hoạch vốn năm ${year}`}
        sub={`${formatVnd(summary.totalPlannedDong)} · ${summary.totalItems} hạng mục · ${fundingSourceCount} nguồn vốn`}
        color="var(--blue)"
        tint="rgba(59,130,196,.07)"
        icon="wallet"
      />
      <KpiCard
        value={formatVndShort(summary.totalActualDong)}
        label="Đã giải ngân"
        sub={`${formatVnd(summary.totalActualDong)} · còn lại ${formatVndShort(summary.totalRemainingDong)}`}
        color="var(--green)"
        tint="rgba(39,174,96,.07)"
        icon="arrowUp"
      />
      <KpiCard
        value={percentText}
        label="Tỷ lệ giải ngân"
        sub={
          summary.committedDong > 0
            ? `Đã cam kết chưa chi: ${formatVndShort(summary.committedDong)}`
            : "So với kế hoạch vốn giao"
        }
        color={progressColor(summary.percent ?? 0)}
        tint="rgba(59,130,196,.07)"
        icon="chart"
      />
      <KpiCard
        value={String(summary.schedule.late)}
        label="Hạng mục chậm tiến độ"
        sub={
          lateNames ||
          `${summary.schedule.atRisk} có nguy cơ chậm · ${summary.schedule.done} đã hoàn thành`
        }
        color={summary.schedule.late > 0 ? "var(--red)" : "var(--green)"}
        tint="rgba(231,76,60,.07)"
        icon="alert"
      />
    </div>
  );
}
