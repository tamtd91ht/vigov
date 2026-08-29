/**
 * Dữ liệu mẫu phân hệ Tổng quan — port nguyên trạng từ mockup đã duyệt
 * (vigov-prototype.html · MOCK_DATA.kpi / nhiemVuThang / giaiNganLuyKe / canXuLy).
 *
 * API thật (P3): GET /dashboard/overview?period=… sẽ trả về đúng cấu trúc này;
 * khi nối backend chỉ cần thay nguồn dữ liệu trong services/api.
 */

import type {
  DashboardKpi,
  DashboardPeriod,
  DisbursementSeries,
  MonthlyTaskStat,
  UrgentItem,
} from "@/features/dashboard/types";
import type { DashboardOverview } from "@/services/dashboard.service";

/** Thời điểm chốt số liệu — API thật trả kèm response */
export const dashboardUpdatedAt = "08:15 ngày 23/08/2026";

/** Các kỳ báo cáo của bộ chọn kỳ (mock giữ nguyên số liệu giữa các kỳ) */
export const dashboardPeriods: DashboardPeriod[] = [
  { key: "thang", label: "Tháng này", reportLabel: "tháng 8 năm 2026" },
  { key: "quy", label: "Quý này", reportLabel: "quý III năm 2026" },
  { key: "nam", label: "Năm 2026", reportLabel: "năm 2026" },
];

/** 6 thẻ KPI — màu dùng CSS var, href là route đích khi bấm thẻ */
export const dashboardKpis: DashboardKpi[] = [
  {
    id: "k1",
    value: "124",
    label: "Nhiệm vụ đang thực hiện",
    sub: "Tăng 12 việc so với tuần trước",
    color: "var(--blue)",
    tint: "rgba(59,130,196,.07)",
    icon: "check",
    href: "/tasks",
  },
  {
    id: "k2",
    value: "9",
    label: "Nhiệm vụ quá hạn",
    sub: "Cần đôn đốc trong ngày",
    color: "var(--red)",
    tint: "rgba(231,76,60,.07)",
    icon: "alert",
    href: "/tasks",
  },
  {
    id: "k3",
    value: "31",
    label: "Văn bản chưa xử lý",
    sub: "Trong đó 6 văn bản đến hạn",
    color: "var(--purple)",
    tint: "rgba(142,68,173,.07)",
    icon: "file",
    href: "/documents",
  },
  {
    id: "k4",
    value: "68%",
    label: "Tỷ lệ giải ngân",
    sub: "8,5 / 12,5 tỷ đồng",
    color: "var(--orange)",
    tint: "rgba(230,126,34,.07)",
    icon: "wallet",
    href: "/disbursement",
  },
  {
    id: "k5",
    value: "87%",
    label: "Phản ánh đúng hạn",
    sub: "271 / 312 lượt trong tháng",
    color: "var(--green)",
    tint: "rgba(39,174,96,.07)",
    icon: "msg",
    href: "/feedback",
  },
  {
    id: "k6",
    value: "4,6",
    label: "Mức hài lòng người dân",
    sub: "Thang điểm 5 · 1.204 lượt đánh giá",
    color: "var(--teal)",
    tint: "rgba(23,162,162,.07)",
    icon: "smile",
    href: "/feedback",
  },
];

/** Nhiệm vụ hoàn thành / được giao theo 12 tháng */
export const monthlyTaskStats: MonthlyTaskStat[] = [
  { month: "T1", done: 18, assigned: 24 },
  { month: "T2", done: 15, assigned: 19 },
  { month: "T3", done: 26, assigned: 31 },
  { month: "T4", done: 22, assigned: 28 },
  { month: "T5", done: 31, assigned: 36 },
  { month: "T6", done: 28, assigned: 33 },
  { month: "T7", done: 34, assigned: 39 },
  { month: "T8", done: 41, assigned: 47 },
  { month: "T9", done: 37, assigned: 44 },
  { month: "T10", done: 29, assigned: 38 },
  { month: "T11", done: 24, assigned: 30 },
  { month: "T12", done: 16, assigned: 22 },
];

/** Luỹ kế giải ngân — thực tế null từ T10 (chưa phát sinh số liệu) */
export const disbursementCumulative: DisbursementSeries = {
  months: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
  plan: [0.9, 1.9, 3.0, 4.1, 5.2, 6.3, 7.4, 8.6, 9.7, 10.8, 11.7, 12.5],
  actual: [0.6, 1.4, 2.2, 3.1, 4.0, 5.1, 6.2, 7.3, 8.5, null, null, null],
};

/** 6 dòng "Cần xử lý ngay" */
export const urgentItems: UrgentItem[] = [
  {
    priority: "cao",
    title: "Phúc đáp Công văn 214/UBND-VP về rà soát đất công ích",
    department: "Địa chính – Xây dựng",
    deadline: "Quá hạn 3 ngày",
    late: true,
  },
  {
    priority: "cao",
    title: "Xử lý ô nhiễm kênh tiêu Thôn Đoài",
    department: "Văn hoá – Xã hội",
    deadline: "Quá hạn 1 ngày",
    late: true,
  },
  {
    priority: "tb",
    title: "Chuẩn bị nội dung kỳ họp HĐND xã tháng 9",
    department: "Văn phòng UBND",
    deadline: "Còn 2 ngày",
    late: false,
  },
  {
    priority: "cao",
    title: "Giải trình chậm giải ngân hạng mục Nhà văn hoá xã",
    department: "Tài chính – Kế toán",
    deadline: "Quá hạn 2 ngày",
    late: true,
  },
  {
    priority: "tb",
    title: "Duyệt hồ sơ hộ nghèo Quý III đợt bổ sung",
    department: "Văn hoá – Xã hội",
    deadline: "Còn 1 ngày",
    late: false,
  },
  {
    priority: "thap",
    title: "Tổng hợp phản ánh lĩnh vực trật tự đô thị tuần 34",
    department: "Công an xã",
    deadline: "Còn 4 ngày",
    late: false,
  },
];

/**
 * Đường lui của `fetchDashboard` khi chạy chế độ mock — đúng cấu trúc
 * GET /reports/dashboard trả về, số liệu lấy lại từ các hằng ở trên.
 */
export const dashboardOverviewMock: DashboardOverview = {
  kpis: {
    activeTasks: 124,
    overdueTasks: 9,
    pendingDocuments: 31,
    dueDocuments: 6,
    disbursementPercent: 68,
    disbursementPlanned: 12.5,
    disbursementActual: 8.5,
    feedbackOnTimeRate: 87,
    feedbackResolved: 271,
    feedbackTotal: 312,
    satisfactionScore: 4.6,
    ratedCount: 1204,
  },
  monthlyTasks: monthlyTaskStats.map((m) => ({ label: m.month, assigned: m.assigned, done: m.done })),
  disbursementCumulative: {
    months: disbursementCumulative.months,
    planned: disbursementCumulative.plan,
    actual: disbursementCumulative.actual,
  },
  urgent: urgentItems.map((u, index) => ({
    code: `NV-${2601 + index}`,
    title: u.title,
    department: u.department,
    deadline: u.deadline,
    daysLeft: u.late ? -1 : 2,
    priority: u.priority,
  })),
};
