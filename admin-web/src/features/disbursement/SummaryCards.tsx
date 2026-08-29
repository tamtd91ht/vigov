import { KpiCard } from "@/components/ui/KpiCard";
import { formatBillion, progressColor } from "@/lib/format";
import { appConfig } from "@/config/app.config";
import type { BudgetItem } from "@/types";
import type { DisbursementSummary } from "@/services/disbursement.service";

interface SummaryCardsProps {
  /** Số liệu tổng hợp do server tính — KHÔNG cộng lại ở trình duyệt */
  summary: DisbursementSummary;
  items: BudgetItem[];
  year: number;
}

/** 4 thẻ tóm tắt tình hình giải ngân toàn xã */
export function SummaryCards({ summary, items, year }: SummaryCardsProps) {
  const fundingSourceCount = new Set(items.map((it) => it.fundingSource)).size;
  const delayedNames = items
    .filter((it) => it.delayed)
    .map((it) => it.name)
    .join(" · ");

  return (
    <div className="grid4" style={{ marginBottom: 20 }}>
      <KpiCard
        value={formatBillion(summary.totalPlanned)}
        label={`Tổng kế hoạch vốn năm ${year}`}
        sub={`${String(items.length).padStart(2, "0")} hạng mục · ${String(fundingSourceCount).padStart(2, "0")} nguồn vốn`}
        color="var(--blue)"
        tint="rgba(59,130,196,.07)"
        icon="wallet"
      />
      <KpiCard
        value={formatBillion(summary.totalActual)}
        label="Đã giải ngân"
        sub={`Trên tổng kế hoạch ${formatBillion(summary.totalPlanned)}`}
        color="var(--green)"
        tint="rgba(39,174,96,.07)"
        icon="arrowUp"
      />
      <KpiCard
        value={`${summary.percent.toLocaleString(appConfig.locale, { maximumFractionDigits: 1 })}%`}
        label="Tỷ lệ giải ngân"
        sub="So với kế hoạch vốn giao"
        color={progressColor(summary.percent)}
        tint="rgba(59,130,196,.07)"
        icon="chart"
      />
      <KpiCard
        value={String(summary.delayedCount)}
        label="Hạng mục chậm tiến độ"
        sub={delayedNames || "Không có hạng mục chậm"}
        color="var(--red)"
        tint="rgba(231,76,60,.07)"
        icon="alert"
      />
    </div>
  );
}
