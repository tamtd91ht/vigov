import type { FeedbackTicket } from "@/types";

/**
 * Ảnh mẫu cho phiếu demo — SVG nội tuyến, KHÔNG gọi mạng.
 *
 * Phải là ảnh dùng được thật chứ không phải chuỗi giả: bản demo offline chạy cả
 * ở webview Zalo lúc xét duyệt, mà một ô ảnh vỡ ở đó trông như lỗi sản phẩm.
 */
function demoImage(label: string, fill: string): string {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
        `<rect width="320" height="320" fill="${fill}"/>` +
        `<circle cx="112" cy="108" r="34" fill="#ffffff" opacity=".8"/>` +
        `<path d="M0 320 L112 168 L200 264 L256 212 L320 276 L320 320Z" fill="#1B3A5C" opacity=".5"/>` +
        `<text x="160" y="300" font-family="Arial" font-size="22" fill="#ffffff" text-anchor="middle">${label}</text>` +
        `</svg>`,
    )
  );
}

/**
 * Phiếu phản ánh mẫu của công dân đang đăng nhập.
 * Nguồn thật: API P3.
 */
export const initialTickets: FeedbackTicket[] = [
  {
    code: "#PA-2026-0141",
    categoryKey: "giao-thong",
    title: "Ổ gà lớn đường liên thôn Đoài – Trung",
    description:
      "Đoạn đường dài khoảng 60m xuất hiện nhiều ổ gà sâu, nước đọng, đã có 2 vụ ngã xe máy. Đề nghị xã cho sửa chữa sớm.",
    location: "Thôn Đoài, Xã Đại Thắng",
    sentAt: "21/08/2026 16:05",
    status: "processing",
    slaHoursLeft: 6,
    imageUrls: [demoImage("Ổ gà 1", "#3B82C4"), demoImage("Ổ gà 2", "#64748B"), demoImage("Ổ gà 3", "#0F766E")],
    resultImageUrls: [],
    timeline: [
      { title: "Gửi phản ánh kèm 3 ảnh hiện trường", meta: "21/08/2026 16:05" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận", meta: "21/08/2026 16:30" },
      { title: "Chuyển Địa chính – Xây dựng xử lý", meta: "22/08/2026 08:00" },
      { title: "Đang khảo sát, chuẩn bị vật liệu vá đường", meta: "Từ 22/08/2026", current: true },
    ],
    rating: 0,
  },
  {
    code: "#PA-2026-0128",
    categoryKey: "rac-thai",
    title: "Bãi rác tự phát đầu cầu Thôn Đông",
    description: "Khu đất trống đầu cầu bị đổ rác thải sinh hoạt, bốc mùi hôi thối, ruồi muỗi nhiều.",
    location: "Thôn Đông, Xã Đại Thắng",
    sentAt: "18/08/2026 07:42",
    status: "processing",
    slaHoursLeft: -24,
    imageUrls: [demoImage("Hiện trường 1", "#EA8C2A"), demoImage("Hiện trường 2", "#D14343")],
    resultImageUrls: [],
    timeline: [
      { title: "Gửi phản ánh qua Zalo Mini App ViGov", meta: "18/08/2026 07:42" },
      { title: "Tiếp nhận, phân loại", meta: "18/08/2026 08:10" },
      { title: "Chuyển Văn hoá – Xã hội xử lý", meta: "18/08/2026 09:05" },
      { title: "Đang tổ chức thu gom, cắm biển cấm đổ rác", meta: "Từ 21/08/2026", current: true },
    ],
    rating: 0,
  },
  {
    code: "#PA-2026-0096",
    categoryKey: "dien-chieu-sang",
    title: "Đèn chiếu sáng hỏng đoạn Tổ dân phố số 3",
    description: "18 bộ đèn chiếu sáng công cộng không sáng gần một tháng, đi lại buổi tối không an toàn.",
    location: "Tổ dân phố số 3, Xã Đại Thắng",
    sentAt: "02/08/2026 19:30",
    status: "resolved",
    slaHoursLeft: 0,
    imageUrls: [demoImage("Hiện trường", "#7C5CBF")],
    resultImageUrls: [demoImage("Sau xử lý", "#16A34A")],
    timeline: [
      { title: "Gửi phản ánh qua Zalo Mini App ViGov", meta: "02/08/2026 19:30" },
      { title: "Tiếp nhận, chuyển Địa chính – Xây dựng", meta: "03/08/2026 09:40" },
      { title: "Thi công thay thế 18 bộ đèn, bổ sung 6 bộ mới", meta: "06/08/2026" },
      { title: "Hoàn thành — đã đánh giá 5 sao", meta: "08/08/2026 17:10" },
    ],
    rating: 5,
    ratingComment: "Cán bộ xã xử lý rất nhanh, chỉ sau 5 ngày đã thay xong toàn bộ đèn.",
  },
];
