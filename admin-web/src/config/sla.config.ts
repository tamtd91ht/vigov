/**
 * Danh mục lĩnh vực phản ánh + SLA mặc định theo lĩnh vực.
 * Trang Cấu hình cho phép sửa các giá trị này (persist qua API khi có backend).
 */

export interface FeedbackCategory {
  key: string;
  label: string;
  /** Màu nhận diện lĩnh vực (chip, cover ảnh, ghim bản đồ) */
  color: string;
}

export const feedbackCategories: FeedbackCategory[] = [
  { key: "rac-thai", label: "Rác thải", color: "var(--orange)" },
  { key: "giao-thong", label: "Giao thông", color: "var(--blue)" },
  { key: "ve-sinh-moi-truong", label: "Vệ sinh môi trường", color: "var(--green)" },
  { key: "trat-tu-do-thi", label: "Trật tự đô thị", color: "var(--purple)" },
  { key: "an-ninh", label: "An ninh", color: "var(--red)" },
  { key: "xay-dung", label: "Xây dựng", color: "var(--teal)" },
  { key: "can-bo", label: "Cán bộ", color: "var(--pink)" },
  { key: "khac", label: "Khác", color: "var(--mut)" },
];

export interface SlaRule {
  /** key lĩnh vực (feedbackCategories) */
  categoryKey: string;
  /** Số ngày làm việc để tiếp nhận, phân loại */
  intakeDays: number;
  /** Số ngày làm việc để xử lý xong */
  resolveDays: number;
  unit: string;
  /** Mốc cảnh báo trước hạn */
  warnBefore: string;
}

export const defaultSlaRules: SlaRule[] = [
  { categoryKey: "rac-thai", intakeDays: 4, resolveDays: 3, unit: "ngày làm việc", warnBefore: "Trước hạn 8 giờ" },
  { categoryKey: "giao-thong", intakeDays: 4, resolveDays: 5, unit: "ngày làm việc", warnBefore: "Trước hạn 12 giờ" },
  { categoryKey: "ve-sinh-moi-truong", intakeDays: 4, resolveDays: 3, unit: "ngày làm việc", warnBefore: "Trước hạn 8 giờ" },
  { categoryKey: "trat-tu-do-thi", intakeDays: 6, resolveDays: 5, unit: "ngày làm việc", warnBefore: "Trước hạn 12 giờ" },
  { categoryKey: "an-ninh", intakeDays: 2, resolveDays: 2, unit: "ngày làm việc", warnBefore: "Trước hạn 4 giờ" },
  { categoryKey: "xay-dung", intakeDays: 8, resolveDays: 7, unit: "ngày làm việc", warnBefore: "Trước hạn 24 giờ" },
  { categoryKey: "can-bo", intakeDays: 4, resolveDays: 5, unit: "ngày làm việc", warnBefore: "Trước hạn 12 giờ" },
  { categoryKey: "khac", intakeDays: 8, resolveDays: 7, unit: "ngày làm việc", warnBefore: "Trước hạn 24 giờ" },
];

export function findCategory(labelOrKey: string): FeedbackCategory {
  return (
    feedbackCategories.find((c) => c.key === labelOrKey || c.label === labelOrKey) ?? {
      key: "khac",
      label: labelOrKey,
      color: "var(--mut)",
    }
  );
}
