"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataState } from "@/components/ui/DataState";
import { Icon } from "@/lib/icons";
import { deadlineLabel, formatNumber } from "@/lib/format";
import { useApiResource } from "@/hooks/useApiResource";
import { fetchDashboard, type DashboardKpis, type DashboardOverview } from "@/services/dashboard.service";
import type { DashboardPeriod, KpiCardMeta } from "./types";
import { MonthlyTasksChart } from "./MonthlyTasksChart";
import { DisbursementLineChart } from "./DisbursementLineChart";
import { UrgentList } from "./UrgentList";

/* ---- Cấu hình cục bộ (hằng số đầu file) ---- */

/** Route đích của nút "Xem báo cáo tổng hợp" */
const REPORT_ROUTE = "/reports";

/** Chữ số La Mã của quý I…IV */
const QUARTER_NUMERALS = ["I", "II", "III", "IV"] as const;

/**
 * Các kỳ của bộ chọn kỳ. Backend tổng hợp trang Tổng quan theo năm ngân sách
 * nên mỗi kỳ mang theo `year` gửi lên API; đổi kỳ khác năm sẽ tải lại số liệu.
 */
function buildPeriods(now: Date): (DashboardPeriod & { year: number })[] {
  const year = now.getFullYear();
  const quarter = QUARTER_NUMERALS[Math.floor(now.getMonth() / 3)];
  return [
    { key: "thang", label: "Tháng này", reportLabel: `tháng ${now.getMonth() + 1} năm ${year}`, year },
    { key: "quy", label: "Quý này", reportLabel: `quý ${quarter} năm ${year}`, year },
    { key: "nam", label: `Năm ${year}`, reportLabel: `năm ${year}`, year },
  ];
}

const PERIODS = buildPeriods(new Date());

/** Trình bày 6 thẻ KPI: màu, icon và route đích giữ nguyên theo thiết kế đã duyệt */
const KPI_CARDS: KpiCardMeta[] = [
  { id: "k1", label: "Nhiệm vụ đang thực hiện", color: "var(--blue)", tint: "rgba(59,130,196,.07)", icon: "check", href: "/tasks" },
  { id: "k2", label: "Nhiệm vụ quá hạn", color: "var(--red)", tint: "rgba(231,76,60,.07)", icon: "alert", href: "/tasks" },
  { id: "k3", label: "Văn bản chưa xử lý", color: "var(--purple)", tint: "rgba(142,68,173,.07)", icon: "file", href: "/documents" },
  { id: "k4", label: "Tỷ lệ giải ngân", color: "var(--orange)", tint: "rgba(230,126,34,.07)", icon: "wallet", href: "/disbursement" },
  { id: "k5", label: "Phản ánh đúng hạn", color: "var(--green)", tint: "rgba(39,174,96,.07)", icon: "msg", href: "/feedback" },
  { id: "k6", label: "Mức hài lòng người dân", color: "var(--teal)", tint: "rgba(23,162,162,.07)", icon: "smile", href: "/feedback" },
];

/** Số thập phân theo locale VN: 8.5 -> "8,5" */
function formatDecimal(value: number): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

/** Giá trị và phụ đề của từng thẻ KPI, dựng từ số liệu API (không chia cho 0 — backend đã quy 0) */
function buildKpiText(k: DashboardKpis): Record<string, { value: string; sub: string }> {
  return {
    k1: { value: formatNumber(k.activeTasks), sub: `Trong đó ${formatNumber(k.overdueTasks)} việc quá hạn` },
    k2: {
      value: formatNumber(k.overdueTasks),
      sub: k.overdueTasks > 0 ? "Cần đôn đốc trong ngày" : "Không còn việc quá hạn",
    },
    k3: { value: formatNumber(k.pendingDocuments), sub: `Trong đó ${formatNumber(k.dueDocuments)} văn bản đến hạn` },
    k4: {
      value: `${k.disbursementPercent}%`,
      sub: `${formatDecimal(k.disbursementActual)} / ${formatDecimal(k.disbursementPlanned)} tỷ đồng`,
    },
    k5: {
      value: `${k.feedbackOnTimeRate}%`,
      sub: `${formatNumber(k.feedbackResolved)} / ${formatNumber(k.feedbackTotal)} lượt đã xử lý`,
    },
    k6: { value: formatDecimal(k.satisfactionScore), sub: `Thang điểm 5 · ${formatNumber(k.ratedCount)} lượt đánh giá` },
  };
}

/** Giờ chốt số liệu hiển thị ở phụ đề: "08:15 ngày 23/08/2026" */
function formatUpdatedAt(at: Date): string {
  const time = at.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${time} ngày ${at.toLocaleDateString("vi-VN")}`;
}

/** Số liệu kèm thời điểm tải — thời điểm này hiển thị ở phụ đề trang */
interface DashboardSnapshot {
  overview: DashboardOverview;
  fetchedAt: number;
}

async function loadDashboard(year: number): Promise<DashboardSnapshot> {
  return { overview: await fetchDashboard(year), fetchedAt: Date.now() };
}

/**
 * Trang Tổng quan điều hành — số liệu lấy từ GET /reports/dashboard.
 * Đổi kỳ báo cáo sang năm khác thì gọi lại API với tham số `year`.
 */
export function DashboardPage() {
  const router = useRouter();
  const [periodKey, setPeriodKey] = useState(PERIODS[0].key);
  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];
  const year = period.year;

  const { data: snapshot, loading, error, reload } = useApiResource(() => loadDashboard(year), [year]);

  // Thời điểm chốt số liệu chỉ có sau khi tải xong ở client nên không gây lệch nội dung với máy chủ
  const data = snapshot?.overview ?? null;
  const updatedAt = snapshot ? formatUpdatedAt(new Date(snapshot.fetchedAt)) : "";
  const kpiText = data ? buildKpiText(data.kpis) : null;

  return (
    <div className="pg">
      <PageHead
        title="Tổng quan điều hành"
        sub={`${updatedAt ? `Số liệu cập nhật lúc ${updatedAt} · ` : ""}Kỳ báo cáo: ${period.reportLabel}`}
        actions={
          <>
            <SegmentControl
              options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
              value={periodKey}
              onChange={setPeriodKey}
            />
            <button type="button" className="btn pri" onClick={() => router.push(REPORT_ROUTE)}>
              <Icon name="chart" size={15} />
              Xem báo cáo tổng hợp
            </button>
          </>
        }
      />

      <DataState loading={loading} error={error} onRetry={reload}>
        {data && kpiText && (
          <>
            {/* 6 thẻ KPI — bấm thẻ điều hướng sang phân hệ tương ứng.
                kpis-6 cho phép trải thành 6 cột một hàng từ 1760px trở lên;
                lưới chung .kpis giữ 3 cột vì trang khác chỉ có 3 thẻ. */}
            <div className="kpis kpis-6">
              {KPI_CARDS.map((card) => (
                <KpiCard
                  key={card.id}
                  value={kpiText[card.id].value}
                  label={card.label}
                  sub={kpiText[card.id].sub}
                  color={card.color}
                  tint={card.tint}
                  icon={card.icon}
                  onClick={() => router.push(card.href)}
                />
              ))}
            </div>

            {/* Cột trái: 2 biểu đồ · Cột phải: danh sách cần xử lý */}
            <div className="split">
              <div>
                <MonthlyTasksChart
                  data={data.monthlyTasks.map((m) => ({ month: m.label, done: m.done, assigned: m.assigned }))}
                />
                <DisbursementLineChart
                  data={{
                    months: data.disbursementCumulative.months,
                    plan: data.disbursementCumulative.planned,
                    actual: data.disbursementCumulative.actual,
                  }}
                />
              </div>
              <UrgentList
                items={data.urgent.map((u) => {
                  const label = deadlineLabel(u.daysLeft);
                  return {
                    code: u.code,
                    priority: u.priority,
                    title: u.title,
                    department: u.department,
                    deadline: label.text,
                    late: label.late,
                  };
                })}
              />
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
