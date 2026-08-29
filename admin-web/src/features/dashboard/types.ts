/** ===== Kiểu dữ liệu riêng của phân hệ Tổng quan (Dashboard) ===== */

import type { IconName } from "@/lib/icons";

/** Phần trình bày cố định của một thẻ KPI — giá trị và phụ đề lấy từ API */
export interface KpiCardMeta {
  id: string;
  label: string;
  /** Màu chữ/icon — luôn dùng CSS var, ví dụ "var(--blue)" */
  color: string;
  /** Nền nhạt của thẻ */
  tint: string;
  icon: IconName;
  /** Route đích khi bấm thẻ */
  href: string;
}

/** Thẻ KPI trên trang Tổng quan */
export interface DashboardKpi extends KpiCardMeta {
  value: string;
  sub: string;
}

/** Thống kê nhiệm vụ theo tháng (biểu đồ cột đôi) */
export interface MonthlyTaskStat {
  /** Nhãn tháng: "T1"…"T12" */
  month: string;
  /** Số việc đã hoàn thành */
  done: number;
  /** Số việc được giao */
  assigned: number;
}

/** Chuỗi luỹ kế giải ngân (biểu đồ đường) */
export interface DisbursementSeries {
  months: string[];
  /** Luỹ kế kế hoạch (tỷ đồng); null = tháng chưa có số liệu */
  plan: (number | null)[];
  /** Luỹ kế thực tế (tỷ đồng); null = tháng chưa có số liệu */
  actual: (number | null)[];
}

/** Một dòng trong danh sách "Cần xử lý ngay" */
export interface UrgentItem {
  /** Mã nhiệm vụ — dùng làm khoá danh sách */
  code?: string;
  /** Khoá mức ưu tiên — tra nhãn/màu qua taskPriorities (status.config) */
  priority: string;
  title: string;
  department: string;
  /** Nhãn hạn hiển thị, sinh từ daysLeft bằng deadlineLabel */
  deadline: string;
  late: boolean;
}

/** Kỳ báo cáo của bộ chọn kỳ */
export interface DashboardPeriod {
  key: string;
  /** Nhãn nút trong SegmentControl */
  label: string;
  /** Cụm từ chèn vào phụ đề: "Kỳ báo cáo: …" */
  reportLabel: string;
}
