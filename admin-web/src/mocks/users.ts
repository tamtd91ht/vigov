/**
 * Dữ liệu mẫu phân hệ Người dùng Mini App & Bảo mật — ngữ cảnh xã Đại Thắng.
 *
 * API thật (P3):
 *   GET /users/citizens · GET /security/sessions · GET /security/blacklist
 * sẽ trả về đúng cấu trúc này; khi nối backend chỉ cần thay nguồn dữ liệu
 * trong services/api.
 */

import type { BlacklistRecord, CitizenUser, LoginSession } from "@/types";
import type { IconName } from "@/lib/icons";

/** ===== Danh mục thôn / tổ dân phố xã Đại Thắng ===== */
export const citizenAreas: string[] = [
  "Thôn Đông",
  "Thôn Đoài",
  "Thôn Trung",
  "Tổ dân phố số 1",
  "Tổ dân phố số 2",
  "Tổ dân phố số 3",
  "Tổ dân phố số 4",
  "Tổ dân phố số 5",
];

/** ===== 3 thẻ thống kê đầu trang (mock — nguồn thật: API thống kê) ===== */
export interface UserStat {
  id: string;
  value: number;
  label: string;
  sub: string;
  color: string;
  tint: string;
  icon: IconName;
}

export const userStats: UserStat[] = [
  {
    id: "total",
    value: 2847,
    label: "Tổng công dân đã đăng ký",
    sub: "Qua Zalo Mini App xã Đại Thắng",
    color: "var(--blue)",
    tint: "rgba(59,130,196,.07)",
    icon: "users",
  },
  {
    id: "active30",
    value: 1926,
    label: "Hoạt động 30 ngày qua",
    sub: "Chiếm 67,6% tổng số đăng ký",
    color: "var(--green)",
    tint: "rgba(39,174,96,.07)",
    icon: "ok",
  },
  {
    id: "locked",
    value: 2,
    label: "Tài khoản bị khoá",
    sub: "Do vi phạm quy định gửi phản ánh",
    color: "var(--red)",
    tint: "rgba(231,76,60,.07)",
    icon: "lock",
  },
];

/** ===== Công dân dùng Mini App (trang hiện tại của danh sách phân trang) ===== */
export const citizenUsers: CitizenUser[] = [
  { id: "CD-001", zaloName: "Thắng Nguyễn", phoneMasked: "098•••432", area: "Thôn Đông", feedbackCount: 9, registeredAt: "05/01/2026", status: "active" },
  { id: "CD-002", zaloName: "Mến Trần", phoneMasked: "097•••215", area: "Thôn Đoài", feedbackCount: 4, registeredAt: "12/01/2026", status: "active" },
  { id: "CD-003", zaloName: "Hoa Phạm", phoneMasked: "091•••808", area: "Thôn Trung", feedbackCount: 6, registeredAt: "28/01/2026", status: "active" },
  { id: "CD-004", zaloName: "Tùng Lê", phoneMasked: "090•••334", area: "Tổ dân phố số 1", feedbackCount: 2, registeredAt: "09/02/2026", status: "active" },
  {
    id: "CD-005",
    zaloName: "Cường Đỗ",
    phoneMasked: "094•••671",
    area: "Tổ dân phố số 2",
    feedbackCount: 11,
    registeredAt: "17/02/2026",
    status: "locked",
    lockReason: "Gửi phản ánh sai sự thật nhiều lần",
  },
  { id: "CD-006", zaloName: "Nhung Vũ", phoneMasked: "096•••529", area: "Tổ dân phố số 3", feedbackCount: 3, registeredAt: "02/03/2026", status: "active" },
  { id: "CD-007", zaloName: "Hải Bùi", phoneMasked: "093•••118", area: "Thôn Đông", feedbackCount: 7, registeredAt: "15/03/2026", status: "active" },
  { id: "CD-008", zaloName: "Lan Ngô", phoneMasked: "098•••960", area: "Tổ dân phố số 4", feedbackCount: 1, registeredAt: "27/03/2026", status: "active" },
  { id: "CD-009", zaloName: "Quân Hoàng", phoneMasked: "092•••245", area: "Tổ dân phố số 5", feedbackCount: 5, registeredAt: "08/04/2026", status: "active" },
  { id: "CD-010", zaloName: "Thuỷ Đinh", phoneMasked: "097•••773", area: "Thôn Đoài", feedbackCount: 0, registeredAt: "21/05/2026", status: "active" },
  {
    id: "CD-011",
    zaloName: "Phúc Trịnh",
    phoneMasked: "090•••486",
    area: "Tổ dân phố số 2",
    feedbackCount: 8,
    registeredAt: "30/06/2026",
    status: "locked",
    lockReason: "Dùng lời lẽ xúc phạm cán bộ tiếp nhận trong nội dung phản ánh",
  },
  { id: "CD-012", zaloName: "Duyên Mai", phoneMasked: "094•••052", area: "Thôn Trung", feedbackCount: 2, registeredAt: "14/07/2026", status: "active" },
];

/** ===== Lịch sử phản ánh rút gọn của công dân (mock — API: GET /users/citizens/{id}/feedback) ===== */
export interface CitizenFeedbackBrief {
  code: string;
  title: string;
  date: string;
  status: "Mới tiếp nhận" | "Đang xử lý" | "Đã xử lý";
}

export const citizenFeedbackHistory: Record<string, CitizenFeedbackBrief[]> = {
  "CD-001": [
    { code: "PA-2026-0812", title: "Đèn chiếu sáng ngõ 12 Thôn Đông hỏng 3 hôm", date: "19/08/2026", status: "Đang xử lý" },
    { code: "PA-2026-0731", title: "Rác ùn ứ tại điểm tập kết đầu thôn", date: "02/08/2026", status: "Đã xử lý" },
    { code: "PA-2026-0644", title: "Ổ gà trên đường liên thôn Đông – Đoài", date: "11/07/2026", status: "Đã xử lý" },
  ],
  "CD-003": [
    { code: "PA-2026-0797", title: "Loa truyền thanh Thôn Trung phát quá giờ", date: "14/08/2026", status: "Đã xử lý" },
    { code: "PA-2026-0705", title: "Mương thoát nước sau chợ bị tắc", date: "25/07/2026", status: "Đã xử lý" },
  ],
  "CD-005": [
    { code: "PA-2026-0771", title: "Phản ánh thi công đường không đúng thiết kế", date: "09/08/2026", status: "Đã xử lý" },
    { code: "PA-2026-0748", title: "Tố cáo thu phí vệ sinh sai quy định", date: "04/08/2026", status: "Đã xử lý" },
  ],
  "CD-007": [
    { code: "PA-2026-0820", title: "Cây xanh gãy cành chắn lối đi sau bão", date: "21/08/2026", status: "Mới tiếp nhận" },
  ],
  "CD-011": [
    { code: "PA-2026-0689", title: "Phản ánh về thái độ tiếp nhận hồ sơ", date: "18/07/2026", status: "Đã xử lý" },
  ],
};

/** ===== Phiên đăng nhập đang hoạt động (web quản trị + Mini App) ===== */
export const loginSessions: LoginSession[] = [
  {
    id: "SS-001",
    userName: "Nguyễn Văn Bình",
    kind: "web",
    device: "Chrome 128 · Windows 11",
    ip: "113.190.32.41",
    startedAt: "27/08/2026 07:42",
    lastActiveAt: "27/08/2026 09:35",
    current: true,
  },
  { id: "SS-002", userName: "Trần Thị Hạnh", kind: "web", device: "Edge 128 · Windows 11", ip: "113.190.32.44", startedAt: "27/08/2026 08:05", lastActiveAt: "27/08/2026 09:20" },
  { id: "SS-003", userName: "Lê Minh Tuấn", kind: "web", device: "Chrome 128 · Windows 10", ip: "113.190.33.12", startedAt: "27/08/2026 07:58", lastActiveAt: "27/08/2026 08:47" },
  { id: "SS-004", userName: "Đỗ Thanh Hà", kind: "web", device: "Firefox 129 · Windows 11", ip: "113.190.33.27", startedAt: "27/08/2026 07:35", lastActiveAt: "27/08/2026 09:02" },
  { id: "SS-005", userName: "Ngô Thị Lan", kind: "web", device: "Chrome 128 · macOS 14", ip: "113.190.34.8", startedAt: "26/08/2026 16:44", lastActiveAt: "26/08/2026 17:31" },
  { id: "SS-006", userName: "Thắng Nguyễn", kind: "miniapp", device: "Zalo App · iPhone 13", ip: "113.190.45.60", startedAt: "27/08/2026 06:58", lastActiveAt: "27/08/2026 09:30" },
  { id: "SS-007", userName: "Mến Trần", kind: "miniapp", device: "Zalo App · Samsung Galaxy A54", ip: "113.190.45.77", startedAt: "27/08/2026 08:12", lastActiveAt: "27/08/2026 08:55" },
  { id: "SS-008", userName: "Hoa Phạm", kind: "miniapp", device: "Zalo App · iPhone 15 Pro", ip: "113.190.46.19", startedAt: "27/08/2026 07:20", lastActiveAt: "27/08/2026 09:14" },
  { id: "SS-009", userName: "Hải Bùi", kind: "miniapp", device: "Zalo App · Xiaomi Redmi Note 13", ip: "113.190.46.83", startedAt: "26/08/2026 20:41", lastActiveAt: "27/08/2026 06:32" },
  { id: "SS-010", userName: "Quân Hoàng", kind: "miniapp", device: "Zalo App · OPPO Reno11", ip: "113.190.47.5", startedAt: "27/08/2026 09:01", lastActiveAt: "27/08/2026 09:26" },
];

/** ===== Blacklist (công dân / thiết bị / IP) ===== */
export const blacklistRecords: BlacklistRecord[] = [
  {
    id: "BL-001",
    subject: "Cường Đỗ · 094•••671",
    kind: "citizen",
    reason: "Gửi phản ánh sai sự thật nhiều lần",
    by: "Nguyễn Văn Bình",
    at: "17/06/2026 10:24",
    active: true,
  },
  {
    id: "BL-002",
    subject: "Phúc Trịnh · 090•••486",
    kind: "citizen",
    reason: "Dùng lời lẽ xúc phạm cán bộ tiếp nhận trong nội dung phản ánh",
    by: "Trần Thị Hạnh",
    at: "30/06/2026 15:40",
    active: true,
  },
  {
    id: "BL-003",
    subject: "Thiết bị Android · ID a83f-77c1",
    kind: "device",
    reason: "Tạo nhiều tài khoản ảo để gửi phản ánh trùng lặp",
    by: "Hoàng Văn Sơn",
    at: "22/05/2026 09:15",
    active: true,
  },
  {
    id: "BL-004",
    subject: "113.190.52.109",
    kind: "ip",
    reason: "Gọi API gửi phản ánh vượt tần suất cho phép (nghi spam tự động)",
    by: "Nguyễn Văn Bình",
    at: "03/04/2026 21:07",
    active: true,
  },
  {
    id: "BL-005",
    subject: "113.190.61.230",
    kind: "ip",
    reason: "Quét dò đường dẫn trang quản trị ngoài giờ hành chính",
    by: "Hoàng Văn Sơn",
    at: "18/03/2026 02:44",
    active: false,
  },
  {
    id: "BL-006",
    subject: "Thiết bị iOS · ID 5c2e-90ab",
    kind: "device",
    reason: "Phát tán liên kết lừa đảo trong phần mô tả phản ánh",
    by: "Trần Thị Hạnh",
    at: "09/02/2026 14:52",
    active: false,
  },
];
