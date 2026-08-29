"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import { authService } from "@/services/auth";
import {
  downloadReportExcel,
  fetchReportSummary,
  requestReportExport,
  type ReportPeriod,
  type ReportSummary,
} from "@/services/reports.service";
import { DeptTaskChart } from "./DeptTaskChart";
import { OnTimeLineChart, OnTimeLegend } from "./OnTimeLineChart";
import { CategoryChart } from "./CategoryChart";
import { FundingChart, FundingLegend } from "./FundingChart";
import { RankingTable } from "./RankingTable";

/* ---- Cấu hình cục bộ (hằng số đầu file) ---- */

/** Chữ số La Mã của quý I…IV */
const QUARTER_NUMERALS = ["I", "II", "III", "IV"] as const;

/** Năm báo cáo — Phase 1 chỉ tổng hợp năm hiện hành */
const REPORT_YEAR = new Date().getFullYear();

/** Kỳ báo cáo gửi lên API (`period`); nhãn dựng theo thời điểm hiện tại */
function buildPeriodOptions(now: Date): { key: ReportPeriod; label: string }[] {
  return [
    { key: "month", label: `Tháng ${now.getMonth() + 1}/${now.getFullYear()}` },
    { key: "quarter", label: `Quý ${QUARTER_NUMERALS[Math.floor(now.getMonth() / 3)]}/${now.getFullYear()}` },
    { key: "half", label: now.getMonth() < 6 ? "6 tháng đầu năm" : "6 tháng cuối năm" },
    { key: "year", label: `Năm ${now.getFullYear()}` },
  ];
}

const PERIOD_OPTIONS = buildPeriodOptions(new Date());

/** Định dạng kết xuất — PDF/PPT backend Phase 1 trả 501 (câu hỏi mở #11) */
const EXPORT_FORMATS = ["PDF", "Excel", "PPT"] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Thông báo khi backend chưa hỗ trợ định dạng kết xuất */
const NOT_IMPLEMENTED_MESSAGE = "Kết xuất PDF/PPT sẽ bổ sung ở giai đoạn tích hợp";

const COMPARE_OPTIONS = [
  { key: "off", label: "Kỳ hiện tại" },
  { key: "on", label: `So sánh cùng kỳ ${REPORT_YEAR - 1}` },
];

/** Dữ liệu một lần tải: kỳ đang xem và cùng kỳ năm trước (khi bật so sánh) */
interface ReportData {
  current: ReportSummary;
  previous: ReportSummary | null;
}

async function loadReport(period: ReportPeriod, compare: boolean): Promise<ReportData> {
  // Cùng kỳ năm trước gọi riêng để lấy chuỗi theo tháng cho biểu đồ đúng hạn;
  // tham số compare giúp backend trả kèm số liệu tổng của kỳ trước.
  const [current, previous] = await Promise.all([
    fetchReportSummary(period, REPORT_YEAR, compare),
    compare ? fetchReportSummary(period, REPORT_YEAR - 1, false) : Promise.resolve(null),
  ]);
  return { current, previous };
}

export function ReportsPage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [compare, setCompare] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const { data, loading, error, reload } = useApiResource<ReportData>(() => loadReport(period, compare), [period, compare]);

  const summary = data?.current ?? null;
  const periodLabel = summary?.range.label ?? PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? "";

  /** Kết xuất báo cáo: Excel tải tệp thật, PDF/PPT hiện thông báo chưa hỗ trợ */
  const handleExport = async (format: ExportFormat) => {
    if (exporting) return;
    setExporting(format);
    try {
      if (format === "Excel") {
        await downloadReportExcel(period, REPORT_YEAR, authService.getAccessToken());
        showToast("Đã tải tệp báo cáo Excel");
      } else {
        await requestReportExport(format === "PDF" ? "pdf" : "pptx", period, REPORT_YEAR);
        showToast(`Đã kết xuất báo cáo ${format}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        showToast(err.message || NOT_IMPLEMENTED_MESSAGE);
      } else {
        showToast(err instanceof Error ? err.message : `Không kết xuất được báo cáo ${format}`);
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="pg">
      <PageHead
        title="Báo cáo tổng hợp"
        sub={`Số liệu điều hành kỳ ${periodLabel}${compare ? ` · có so sánh cùng kỳ năm ${REPORT_YEAR - 1}` : ""}`}
        actions={
          <>
            {EXPORT_FORMATS.map((format) => (
              <button
                key={format}
                className="btn"
                type="button"
                disabled={exporting !== null}
                onClick={() => void handleExport(format)}
              >
                <Icon name="down" size={15} />
                {exporting === format ? `Đang xuất ${format}…` : `Xuất ${format}`}
              </button>
            ))}
          </>
        }
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <select
          className="sel"
          value={period}
          onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
          aria-label="Chọn kỳ báo cáo"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <SegmentControl options={COMPARE_OPTIONS} value={compare ? "on" : "off"} onChange={(key) => setCompare(key === "on")} />
        <span className="tiny muted" style={{ marginLeft: "auto" }}>
          Kỳ báo cáo: {periodLabel}
        </span>
      </div>

      <DataState loading={loading} error={error} onRetry={reload}>
        {summary && (
          <>
            <div className="grid2">
              <Card>
                <CardHeader
                  title="Nhiệm vụ theo bộ phận"
                  extra={`Tổng ${formatNumber(summary.totals.tasks)} việc · ${summary.tasksByDepartment.length} bộ phận`}
                />
                <CardBody>
                  <DataState
                    loading={false}
                    error={null}
                    empty={summary.tasksByDepartment.length === 0}
                    emptyMessage="Kỳ này chưa có nhiệm vụ nào"
                  >
                    <DeptTaskChart data={summary.tasksByDepartment} />
                  </DataState>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Tỷ lệ xử lý đúng hạn theo tháng"
                  extra={<OnTimeLegend year={REPORT_YEAR} compareYear={compare ? REPORT_YEAR - 1 : null} />}
                />
                <CardBody>
                  <DataState
                    loading={false}
                    error={null}
                    empty={summary.onTimeRateByMonth.length === 0}
                    emptyMessage="Kỳ này chưa có số liệu đúng hạn"
                  >
                    <OnTimeLineChart
                      data={summary.onTimeRateByMonth}
                      previous={compare ? (data?.previous?.onTimeRateByMonth ?? null) : null}
                    />
                  </DataState>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Phản ánh theo lĩnh vực" extra={`${formatNumber(summary.totals.feedbacks)} lượt`} />
                <CardBody>
                  <DataState
                    loading={false}
                    error={null}
                    empty={summary.feedbackByCategory.length === 0}
                    emptyMessage="Kỳ này chưa có phản ánh"
                  >
                    <CategoryChart data={summary.feedbackByCategory} />
                  </DataState>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Giải ngân theo nguồn vốn" extra={<FundingLegend />} />
                <CardBody>
                  <DataState
                    loading={false}
                    error={null}
                    empty={summary.disbursementByFunding.length === 0}
                    emptyMessage="Năm nay chưa giao kế hoạch vốn"
                  >
                    <FundingChart data={summary.disbursementByFunding} />
                  </DataState>
                </CardBody>
              </Card>
            </div>

            <Card style={{ marginTop: 18 }}>
              <CardHeader title="Xếp hạng bộ phận theo tỷ lệ đúng hạn" extra={`Kỳ ${periodLabel}`} />
              <DataState
                loading={false}
                error={null}
                empty={summary.departmentRanking.length === 0}
                emptyMessage="Kỳ này chưa đủ dữ liệu xếp hạng"
              >
                <RankingTable data={summary.departmentRanking} />
              </DataState>
            </Card>
          </>
        )}
      </DataState>
    </div>
  );
}
