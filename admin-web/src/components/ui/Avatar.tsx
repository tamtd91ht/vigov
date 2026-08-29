"use client";

import { nameInitials } from "@/lib/format";
import { findStaffIn } from "@/services/catalogs.service";
import { useStaffDirectory } from "@/services/staff-directory";

/** Màu dùng khi tên không có trong danh bạ, hoặc danh bạ chưa tải xong */
const FALLBACK_COLOR = "#8896A6";

/**
 * Chữ cái đại diện của một cán bộ.
 *
 * Màu và chữ viết tắt lấy từ danh bạ tải qua API (kho dùng chung, một lượt gọi
 * cho cả phiên). Chưa tải xong thì tự tính chữ viết tắt từ tên và dùng màu
 * trung tính — không có trạng thái tải, tránh nhấp nháy trên các bảng dài.
 */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const directory = useStaffDirectory();
  const staff = findStaffIn(directory, name);
  const initials = staff?.initials ?? nameInitials(name);
  return (
    <span
      className={large ? "av lg" : "av"}
      style={{ background: staff?.color ?? FALLBACK_COLOR }}
      title={name}
    >
      {initials}
    </span>
  );
}
