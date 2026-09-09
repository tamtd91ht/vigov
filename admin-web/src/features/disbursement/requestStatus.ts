import type { DisbursementRequestStatus } from "@/types";

/**
 * Từ điển trạng thái đề nghị giải ngân — nhãn và màu dùng chung cho
 * màn hình quản lý đề nghị lẫn tab Đề nghị trong ngăn chi tiết hạng mục.
 * Đặt riêng một tệp để hai nơi không tự chế nhãn lệch nhau.
 */
export interface RequestStatusMeta {
  key: DisbursementRequestStatus;
  label: string;
  color: string;
  tint: string;
}

/** Thứ tự khai báo cũng là thứ tự hiển thị trên thanh lọc */
export const requestStatuses: RequestStatusMeta[] = [
  { key: "pending", label: "Chờ duyệt", color: "var(--orange)", tint: "rgba(230,126,34,.10)" },
  { key: "approved", label: "Đã duyệt", color: "var(--blue)", tint: "rgba(59,130,196,.10)" },
  { key: "disbursed", label: "Đã giải ngân", color: "var(--green)", tint: "rgba(39,174,96,.10)" },
  { key: "rejected", label: "Từ chối", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
];

/** Tra nhãn/màu theo khoá; khoá lạ trả về chip xám mang đúng khoá đó */
export function findRequestStatus(key: string): RequestStatusMeta {
  return (
    requestStatuses.find((s) => s.key === key) ?? {
      key: key as DisbursementRequestStatus,
      label: key,
      color: "var(--mut)",
      tint: "rgba(136,150,166,.12)",
    }
  );
}
