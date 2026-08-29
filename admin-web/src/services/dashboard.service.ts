import { apiClient, buildQuery } from "./api";
import { appConfig } from "@/config/app.config";

/** 6 chỉ số KPI của trang Tổng quan điều hành */
export interface DashboardKpis {
  /** Nhiệm vụ chưa hoàn thành */
  activeTasks: number;
  overdueTasks: number;
  /** Văn bản chưa xử lý xong */
  pendingDocuments: number;
  /** Trong đó số văn bản đến hạn trong 7 ngày tới */
  dueDocuments: number;
  /** % giải ngân trên kế hoạch năm (0 khi chưa giao kế hoạch) */
  disbursementPercent: number;
  /** Kế hoạch giao (tỷ đồng) */
  disbursementPlanned: number;
  /** Đã giải ngân (tỷ đồng) */
  disbursementActual: number;
  /** % phản ánh xử lý đúng hạn SLA */
  feedbackOnTimeRate: number;
  feedbackResolved: number;
  feedbackTotal: number;
  /** Điểm hài lòng trung bình, thang điểm 5 */
  satisfactionScore: number;
  /** Số lượt đánh giá đã chấm điểm */
  ratedCount: number;
}

/** Một cột của biểu đồ "Nhiệm vụ hoàn thành theo tháng" */
export interface MonthlyTaskPoint {
  /** Nhãn tháng: "T1"…"T12" */
  label: string;
  assigned: number;
  done: number;
}

/** Luỹ kế giải ngân theo tháng (tỷ đồng); null = tháng chưa phát sinh số liệu */
export interface DashboardDisbursement {
  months: string[];
  planned: (number | null)[];
  actual: (number | null)[];
}

/** Một dòng của bảng "Cần xử lý ngay" */
export interface UrgentTask {
  code: string;
  title: string;
  department: string;
  /** Hạn xử lý dạng dd/MM/yyyy */
  deadline: string;
  /** Số ngày còn lại; âm là đã quá hạn */
  daysLeft: number;
  /** Khoá mức ưu tiên — tra nhãn/màu qua taskPriorities (status.config) */
  priority: string;
}

/** Phản hồi của GET /reports/dashboard */
export interface DashboardOverview {
  kpis: DashboardKpis;
  monthlyTasks: MonthlyTaskPoint[];
  disbursementCumulative: DashboardDisbursement;
  urgent: UrgentTask[];
}

/**
 * Số liệu trang Tổng quan trong một năm ngân sách.
 * Bật `NEXT_PUBLIC_USE_MOCKS` thì lấy dữ liệu mẫu thay vì gọi backend.
 */
export async function fetchDashboard(year: number): Promise<DashboardOverview> {
  if (appConfig.api.useMocks) {
    const { dashboardOverviewMock } = await import("@/mocks/dashboard");
    await new Promise((resolve) => setTimeout(resolve, appConfig.api.mockDelayMs));
    return dashboardOverviewMock;
  }
  return apiClient.get<DashboardOverview>(`/reports/dashboard${buildQuery({ year })}`);
}
