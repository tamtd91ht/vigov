import type { BroadcastLog, CmsArticle, CmsVideo } from "@/types";

/* ============================================================
   Cấu hình hiển thị cục bộ phân hệ CMS — nhãn & màu chip.
   Màu dùng token CSS var của design system, không hard-code hex.
   ============================================================ */

export interface ChipStyle {
  label: string;
  color: string;
  tint: string;
}

/** Loại bài viết */
export const ARTICLE_TYPES: Record<CmsArticle["type"], ChipStyle> = {
  news: { label: "Tin tức", color: "var(--blue)", tint: "rgba(59,130,196,.12)" },
  event: { label: "Sự kiện", color: "var(--purple)", tint: "rgba(142,68,173,.12)" },
  notice: { label: "Thông báo", color: "var(--orange)", tint: "rgba(230,126,34,.13)" },
};

/** Trạng thái nội dung (bài viết / video / bản tin) */
export const CONTENT_STATUS: Record<CmsArticle["status"], ChipStyle> = {
  draft: { label: "Nháp", color: "var(--mut)", tint: "rgba(136,150,166,.14)" },
  published: { label: "Đã đăng", color: "var(--green)", tint: "rgba(39,174,96,.12)" },
};

/** Kênh gửi broadcast */
export const BROADCAST_CHANNELS: Record<BroadcastLog["channel"], ChipStyle> = {
  zns: { label: "Zalo ZNS", color: "var(--blue)", tint: "rgba(59,130,196,.12)" },
  push: { label: "Push Mini App", color: "var(--pink)", tint: "rgba(233,30,140,.10)" },
};

/** Trạng thái lượt gửi broadcast */
export const BROADCAST_STATUS: Record<BroadcastLog["status"], ChipStyle> = {
  sent: { label: "Đã gửi", color: "var(--green)", tint: "rgba(39,174,96,.12)" },
  sending: { label: "Đang gửi", color: "var(--orange)", tint: "rgba(230,126,34,.13)" },
  failed: { label: "Lỗi", color: "var(--red)", tint: "rgba(231,76,60,.12)" },
};

/** Nguồn video */
export const VIDEO_SOURCES: Record<CmsVideo["source"], ChipStyle> = {
  youtube: { label: "YouTube", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
  hosted: { label: "Tự host", color: "var(--teal)", tint: "rgba(23,162,162,.12)" },
};

/** Dải gradient thumbnail video theo chủ đề (fallback: navy) */
export const TOPIC_GRADIENTS: Record<string, string> = {
  "Cải cách hành chính": "linear-gradient(135deg, var(--blue), var(--navy))",
  "An toàn giao thông": "linear-gradient(135deg, var(--orange), var(--red))",
  "Phòng chống thiên tai": "linear-gradient(135deg, var(--teal), var(--navy))",
  "Chuyển đổi số": "linear-gradient(135deg, var(--purple), var(--navy))",
  "Y tế – Sức khoẻ": "linear-gradient(135deg, var(--green), var(--teal))",
};

export const TOPIC_GRADIENT_FALLBACK = "linear-gradient(135deg, var(--navy), var(--blue))";

/** Định dạng "HH:mm · dd/MM/yyyy" cho bản ghi tạo mới trên UI */
export function nowStamp(): string {
  const d = new Date();
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} · ${date}`;
}

/** Định dạng "dd/MM/yyyy" cho ngày đăng bài tạo mới */
export function todayStamp(): string {
  return new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
