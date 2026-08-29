"use client";

import { useSyncExternalStore } from "react";
import { feedbackCategories, type FeedbackCategory } from "@/config/sla.config";
import { fetchCategories } from "@/services/settings.service";

/**
 * Kho lĩnh vực phản ánh dùng chung cho toàn ứng dụng.
 *
 * Cùng lý do với `staff-directory`: nhãn và màu lĩnh vực được tra ở rất nhiều
 * chỗ (chip trong bảng phản ánh, ngăn chi tiết, biểu đồ báo cáo, bảng SLA), có
 * chỗ nằm trong vòng lặp render từng dòng. Tải một lượt cho cả phiên thay vì
 * để mỗi nơi tự gọi.
 *
 * Trước khi tải xong — và khi gọi lỗi — dùng bộ mặc định trong
 * `config/sla.config.ts`. Tám lĩnh vực đó cũng chính là bộ máy chủ tự nạp vào
 * database lần đầu, nên hai bên khớp nhau; chỉ lĩnh vực do cán bộ thêm về sau
 * mới cần tới lượt tải.
 */

let directory: FeedbackCategory[] = feedbackCategories;
let loading = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (loaded || loading) return;
  loading = true;
  fetchCategories()
    .then((items) => {
      if (items.length > 0) directory = items;
      loaded = true;
      emit();
    })
    .catch(() => {
      // Giữ bộ mặc định: mất nhãn lĩnh vực chỉ làm chip hiển thị thô,
      // không đáng dựng màn hình lỗi cho cả trang.
      loaded = true;
    })
    .finally(() => {
      loading = false;
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FeedbackCategory[] {
  return directory;
}

/** Trên máy chủ luôn trả bộ mặc định để HTML dựng sẵn khớp lần render đầu */
function getServerSnapshot(): FeedbackCategory[] {
  return feedbackCategories;
}

/** Danh mục lĩnh vực hiện hành; là bộ mặc định khi chưa tải xong */
export function useCategoryDirectory(): FeedbackCategory[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Tra lĩnh vực theo `key` hoặc theo nhãn hiển thị.
 *
 * Chấp nhận cả hai vì dữ liệu đến từ hai đường: API phản ánh trả `categoryKey`,
 * còn một số màn hình đã ánh xạ sẵn sang `categoryLabel`. Không tìm thấy thì
 * trả về chính chuỗi đầu vào làm nhãn — thà hiển thị thô còn hơn để trống.
 */
export function findCategoryIn(
  list: FeedbackCategory[],
  labelOrKey: string,
): FeedbackCategory {
  return (
    list.find((c) => c.key === labelOrKey || c.label === labelOrKey) ?? {
      key: "khac",
      label: labelOrKey,
      color: "var(--mut)",
    }
  );
}

/** Buộc tải lại ở lần dùng tiếp theo — gọi sau khi thêm/xoá lĩnh vực */
export function invalidateCategoryDirectory(): void {
  loaded = false;
  emit();
}
