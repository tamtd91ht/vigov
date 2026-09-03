import type { IconName } from "@/components/Icon";

/** Một mục ở thanh điều hướng dưới */
export interface NavTab {
  key: string;
  label: string;
  icon: IconName;
  path: string;
}

/** Bottom nav 4 mục + nút "Gửi phản ánh" nổi ở giữa (chèn giữa index 1 và 2) */
export const navTabs: NavTab[] = [
  { key: "home", label: "Trang chủ", icon: "home", path: "/" },
  { key: "my-feedback", label: "Phản ánh", icon: "chat", path: "/my-feedback" },
  { key: "news", label: "Tin tức", icon: "news", path: "/news" },
  { key: "profile", label: "Cá nhân", icon: "user", path: "/profile" },
];

/** 6 ô truy cập nhanh ở Trang chủ */
export interface QuickAction {
  label: string;
  icon: IconName;
  color: string;
  path: string;
}

export const homeQuickActions: QuickAction[] = [
  { label: "Gửi phản ánh", icon: "megaphone", color: "var(--pink)", path: "/send-feedback" },
  { label: "Tra cứu hồ sơ", icon: "search", color: "var(--blue)", path: "/lookup" },
  { label: "Truyền thanh", icon: "radio", color: "var(--orange)", path: "/radio" },
  { label: "Video", icon: "play", color: "var(--purple)", path: "/video" },
  { label: "Danh bạ", icon: "phone", color: "var(--teal)", path: "/directory" },
  /* Chỗ này trước là "Tin tức" — bỏ vì đã có sẵn một tab ở thanh dưới, giữ
     lưới 3 cột đủ 6 ô không bị lẻ hàng. */
  { label: "Bản đồ kinh tế", icon: "map", color: "var(--green)", path: "/map" },
];
