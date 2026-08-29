import type { IconName } from "@/lib/icons";

/** Một mục điều hướng ở sidebar */
export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  /** Khoá badge số đếm — giá trị lấy từ API thống kê (mock: navBadges) */
  badgeKey?: "tasks" | "documents" | "feedback";
  /** Phân hệ dùng để kiểm tra quyền truy cập (roles.config) */
  moduleKey: string;
}

export interface NavSection {
  caption?: string;
  items: NavItem[];
}

/** Menu sidebar — thứ tự và nhóm hiển thị */
export const navSections: NavSection[] = [
  {
    caption: "Điều hành",
    items: [
      { id: "overview", label: "Tổng quan", icon: "grid", href: "/", moduleKey: "overview" },
      { id: "tasks", label: "Nhiệm vụ", icon: "check", href: "/tasks", badgeKey: "tasks", moduleKey: "tasks" },
      { id: "documents", label: "Văn bản & Đơn thư", icon: "file", href: "/documents", badgeKey: "documents", moduleKey: "documents" },
      { id: "disbursement", label: "Giải ngân", icon: "wallet", href: "/disbursement", moduleKey: "disbursement" },
      { id: "feedback", label: "Phản ánh người dân", icon: "msg", href: "/feedback", badgeKey: "feedback", moduleKey: "feedback" },
      { id: "map", label: "Bản đồ kinh tế số", icon: "map", href: "/map", moduleKey: "map" },
      { id: "reports", label: "Báo cáo", icon: "chart", href: "/reports", moduleKey: "reports" },
    ],
  },
  {
    caption: "Quản trị",
    items: [
      { id: "cms", label: "Nội dung Mobile", icon: "book", href: "/cms", moduleKey: "cms" },
      { id: "users", label: "Người dùng Mini App", icon: "users", href: "/users", moduleKey: "users" },
      { id: "settings", label: "Cấu hình", icon: "gear", href: "/settings", moduleKey: "settings" },
    ],
  },
];
