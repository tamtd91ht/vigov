"use client";

import { useSyncExternalStore } from "react";
import type { Staff } from "@/types";
import { fetchStaffDirectory } from "@/services/catalogs.service";

/**
 * Kho danh bạ cán bộ dùng chung cho toàn ứng dụng.
 *
 * Vì sao cần kho riêng thay vì gọi `useCatalog` như các danh mục khác:
 * `<Avatar>` là component lá, một màn hình danh sách có thể render vài chục cái.
 * Nếu mỗi cái tự gọi API thì mở một trang là bắn hàng chục lượt gọi giống hệt
 * nhau. Kho này tải đúng MỘT lần cho cả phiên làm việc, mọi Avatar đọc chung.
 *
 * Danh bạ chỉ dùng để tô màu và lấy chữ viết tắt, nên khi chưa tải xong hoặc
 * gọi lỗi thì Avatar tự tính từ tên — không có trạng thái tải, không có màn
 * hình lỗi, giao diện không giật.
 */

let directory: Staff[] = [];
let loading = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Tải danh bạ lần đầu; các lượt gọi sau dùng lại kết quả đã có */
function ensureLoaded() {
  if (loaded || loading) return;
  loading = true;
  fetchStaffDirectory()
    .then((items) => {
      directory = items;
      loaded = true;
      emit();
    })
    .catch(() => {
      // Nuốt lỗi có chủ ý: thiếu danh bạ chỉ làm Avatar mất màu riêng,
      // không đáng để dựng màn hình lỗi hay ghi log ồn ào.
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

function getSnapshot(): Staff[] {
  return directory;
}

/** Trên máy chủ luôn trả danh bạ rỗng để HTML dựng sẵn khớp với lần render đầu */
function getServerSnapshot(): Staff[] {
  return [];
}

/** Danh bạ cán bộ đã tải; rỗng khi chưa xong hoặc gọi lỗi */
export function useStaffDirectory(): Staff[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Buộc tải lại ở lần dùng tiếp theo — gọi sau khi thêm/sửa tài khoản cán bộ */
export function invalidateStaffDirectory(): void {
  loaded = false;
  directory = [];
  emit();
}
