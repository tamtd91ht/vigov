import type { IconName } from "@/components/Icon";

/**
 * Danh mục phản ánh + SLA cam kết (WBS #13 — 12 danh mục),
 * đồng bộ với app Flutter và cấu hình SLA của Web Quản trị.
 */
export interface FeedbackCategory {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  /** Số ngày làm việc tiếp nhận, phân loại */
  intakeDays: number;
  /** Số ngày làm việc xử lý xong */
  resolveDays: number;
}

export const feedbackCategories: FeedbackCategory[] = [
  { key: "rac-thai", label: "Rác thải", icon: "trash", color: "var(--orange)", intakeDays: 4, resolveDays: 3 },
  { key: "giao-thong", label: "Giao thông", icon: "car", color: "var(--blue)", intakeDays: 4, resolveDays: 5 },
  { key: "ve-sinh-moi-truong", label: "Vệ sinh môi trường", icon: "leaf", color: "var(--green)", intakeDays: 4, resolveDays: 3 },
  { key: "trat-tu-do-thi", label: "Trật tự đô thị", icon: "store", color: "var(--purple)", intakeDays: 6, resolveDays: 5 },
  { key: "an-ninh", label: "An ninh", icon: "shield", color: "var(--red)", intakeDays: 2, resolveDays: 2 },
  { key: "xay-dung", label: "Xây dựng", icon: "build", color: "var(--teal)", intakeDays: 8, resolveDays: 7 },
  { key: "can-bo", label: "Cán bộ", icon: "badge", color: "var(--pink)", intakeDays: 4, resolveDays: 5 },
  { key: "dien-chieu-sang", label: "Điện chiếu sáng", icon: "bulb", color: "var(--orange)", intakeDays: 4, resolveDays: 5 },
  { key: "cap-thoat-nuoc", label: "Cấp thoát nước", icon: "water", color: "var(--blue)", intakeDays: 4, resolveDays: 5 },
  { key: "dat-dai", label: "Đất đai", icon: "map", color: "var(--slate)", intakeDays: 8, resolveDays: 7 },
  { key: "y-te-giao-duc", label: "Y tế – Giáo dục", icon: "health", color: "var(--green)", intakeDays: 4, resolveDays: 5 },
  { key: "khac", label: "Khác", icon: "more", color: "var(--mut)", intakeDays: 8, resolveDays: 7 },
];

export function categoryOf(keyOrLabel: string): FeedbackCategory {
  return (
    feedbackCategories.find((c) => c.key === keyOrLabel || c.label === keyOrLabel) ??
    feedbackCategories[feedbackCategories.length - 1]
  );
}

/** Câu cam kết SLA hiển thị cho công dân */
export function slaText(c: FeedbackCategory): string {
  return `Tiếp nhận trong ${c.intakeDays} ngày · xử lý trong ${c.resolveDays} ngày làm việc`;
}
