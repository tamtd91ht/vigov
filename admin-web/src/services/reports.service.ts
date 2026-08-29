import { apiClient, buildQuery } from "./api";
import { appConfig } from "@/config/app.config";

/** Kỳ báo cáo backend hỗ trợ */
export type ReportPeriod = "month" | "quarter" | "half" | "year";

export interface DeptTaskStat {
  department: string;
  total: number;
}

export interface OnTimePoint {
  month: string;
  total: number;
  onTime: number;
  rate: number;
}

export interface CategoryStat {
  /** Khoá lĩnh vực — tra nhãn/màu qua findCategory (sla.config) */
  categoryKey: string;
  /** Nhãn do backend sinh; giao diện ưu tiên nhãn của sla.config */
  label?: string;
  total: number;
  resolved?: number;
  resolveRate?: number;
}

export interface FundingStat {
  fundingSource: string;
  /** Kế hoạch giao (tỷ đồng) */
  planned: number;
  /** Đã giải ngân (tỷ đồng) */
  actual: number;
  percent?: number;
}

export interface DeptRanking {
  /** Thứ hạng do backend xếp sẵn, bắt đầu từ 1 */
  rank: number;
  department: string;
  total: number;
  onTime: number;
  late: number;
  /** Tỷ lệ đúng hạn (%) */
  onTimeRate: number;
}

/** Số liệu tổng của một kỳ — dùng cả cho phần so sánh kỳ trước */
export interface ReportTotals {
  tasks: number;
  tasksOnTime: number;
  tasksLate: number;
  onTimeRate: number;
  feedbacks: number;
  feedbacksResolved: number;
  /** Tỷ đồng */
  planned: number;
  actual: number;
  disbursementPercent: number;
}

export interface ReportSummary {
  period: ReportPeriod;
  year: number;
  range: { from: string; to: string; label: string };
  tasksByDepartment: DeptTaskStat[];
  onTimeRateByMonth: OnTimePoint[];
  feedbackByCategory: CategoryStat[];
  disbursementByFunding: FundingStat[];
  departmentRanking: DeptRanking[];
  totals: ReportTotals;
  /** Chỉ có khi gọi với compare=true */
  comparison?: {
    previousLabel: string;
    previous: ReportTotals;
    delta: Partial<ReportTotals>;
  };
}

/** Số liệu tổng hợp cho trang Báo cáo và Dashboard */
export async function fetchReportSummary(period: ReportPeriod, year: number, compare = false): Promise<ReportSummary> {
  return apiClient.get<ReportSummary>(`/reports/summary${buildQuery({ period, year, compare })}`);
}

/**
 * Tải tệp Excel báo cáo. Dùng fetch trực tiếp vì phản hồi là nhị phân,
 * không phải JSON như apiClient xử lý.
 */
export async function downloadReportExcel(period: ReportPeriod, year: number, token: string | null): Promise<void> {
  const res = await fetch(`${appConfig.api.baseUrl}/reports/export/excel${buildQuery({ period, year })}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Không kết xuất được báo cáo (lỗi ${res.status})`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bao-cao-vigov-${period}-${year}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Các định dạng kết xuất khác Excel — backend Phase 1 trả 501 kèm thông báo */
export type PendingExportFormat = "pdf" | "pptx";

/**
 * Yêu cầu kết xuất PDF/PowerPoint. Backend chưa hỗ trợ ở Phase 1 nên lời gọi
 * ném ApiError 501; giao diện bắt lỗi và hiển thị thông báo của máy chủ.
 */
export async function requestReportExport(
  format: PendingExportFormat,
  period: ReportPeriod,
  year: number,
): Promise<void> {
  await apiClient.get<unknown>(`/reports/export/${format}${buildQuery({ period, year })}`);
}
