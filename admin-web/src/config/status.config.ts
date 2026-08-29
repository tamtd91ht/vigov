/**
 * Từ điển trạng thái / mức ưu tiên dùng chung toàn hệ thống.
 * Màu tham chiếu CSS variable trong globals.css — đổi theme chỉ sửa một chỗ.
 */

export interface StatusMeta {
  key: string;
  label: string;
  /** CSS color (var(--x) hoặc mã màu) */
  color: string;
  /** Màu nền nhạt cho chip */
  tint: string;
}

/** Trạng thái nhiệm vụ — 5 cột Kanban theo đúng thứ tự hiển thị */
export const taskStatuses: StatusMeta[] = [
  { key: "moi", label: "Mới giao", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
  { key: "dang", label: "Đang thực hiện", color: "var(--blue)", tint: "rgba(59,130,196,.10)" },
  { key: "cho", label: "Chờ duyệt", color: "var(--orange)", tint: "rgba(230,126,34,.10)" },
  { key: "qua", label: "Quá hạn", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
  { key: "xong", label: "Hoàn thành", color: "var(--green)", tint: "rgba(39,174,96,.10)" },
];

/** Mức ưu tiên nhiệm vụ */
export const taskPriorities: StatusMeta[] = [
  { key: "cao", label: "Cao", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
  { key: "tb", label: "Trung bình", color: "var(--orange)", tint: "rgba(230,126,34,.10)" },
  { key: "thap", label: "Thấp", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
];

/** Nguồn phát sinh nhiệm vụ (liên kết xuyên phân hệ) */
export const taskSources: StatusMeta[] = [
  { key: "vb", label: "Văn bản", color: "var(--purple)", tint: "rgba(142,68,173,.10)" },
  { key: "pa", label: "Phản ánh", color: "var(--pink)", tint: "rgba(233,30,140,.10)" },
  { key: "hop", label: "Kết luận họp", color: "var(--teal)", tint: "rgba(23,162,162,.10)" },
];

/** Trạng thái xử lý văn bản / đơn thư */
export const documentStatuses: StatusMeta[] = [
  { key: "moi", label: "Mới tiếp nhận", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
  { key: "dangxl", label: "Đang xử lý", color: "var(--blue)", tint: "rgba(59,130,196,.10)" },
  { key: "choduyet", label: "Chờ duyệt", color: "var(--orange)", tint: "rgba(230,126,34,.10)" },
  { key: "xong", label: "Đã hoàn thành", color: "var(--green)", tint: "rgba(39,174,96,.10)" },
];

/** Nhãn độ khẩn của văn bản */
export const urgencyLevels: StatusMeta[] = [
  { key: "Thường", label: "Thường", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
  { key: "Khẩn", label: "Khẩn", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
  { key: "Hoả tốc", label: "Hoả tốc", color: "#B03A2E", tint: "rgba(176,58,46,.12)" },
];

/** Nhãn độ mật của văn bản */
export const confidentialityLevels: StatusMeta[] = [
  { key: "Thường", label: "Thường", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
  { key: "Mật", label: "Mật", color: "var(--purple)", tint: "rgba(142,68,173,.10)" },
  { key: "Tối mật", label: "Tối mật", color: "#6C3483", tint: "rgba(108,52,131,.12)" },
];

/** Trạng thái phiếu phản ánh */
export const feedbackStatuses: StatusMeta[] = [
  { key: "Mới tiếp nhận", label: "Mới tiếp nhận", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
  { key: "Đang xử lý", label: "Đang xử lý", color: "var(--blue)", tint: "rgba(59,130,196,.10)" },
  { key: "Đã xử lý", label: "Đã xử lý", color: "var(--green)", tint: "rgba(39,174,96,.10)" },
];

export function findStatus(list: StatusMeta[], key: string): StatusMeta {
  return list.find((s) => s.key === key) ?? { key, label: key, color: "var(--mut)", tint: "rgba(136,150,166,.12)" };
}

/**
 * Nhãn hiển thị khi phiếu phản ánh / nhiệm vụ chưa được phân công.
 * Backend trả đúng chuỗi này ở trường `assignee`, nên đây là hằng số giao ước
 * giữa hai bên chứ không phải dữ liệu — không lấy qua API.
 */
export const UNASSIGNED = "Chưa phân công";
