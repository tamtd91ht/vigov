import type { CitizenFeedback } from "@/types";
import type { IconName } from "@/lib/icons";

/** ===== Mock phân hệ Phản ánh người dân — nguồn thật: API phản ánh ===== */

/** Nhãn khi phiếu chưa được phân công cán bộ / bộ phận */
export const UNASSIGNED = "Chưa phân công";

/** Thẻ thống kê đầu trang */
export interface FeedbackStat {
  value: string;
  label: string;
  sub: string;
  color: string;
  tint: string;
  icon: IconName;
}

export const feedbackStats: FeedbackStat[] = [
  {
    value: "312",
    label: "Tiếp nhận trong tháng",
    sub: "Tăng 24 lượt so với tháng trước",
    color: "var(--blue)",
    tint: "rgba(59,130,196,.07)",
    icon: "msg",
  },
  {
    value: "271",
    label: "Đã xử lý xong",
    sub: "41 lượt đang trong hạn xử lý",
    color: "var(--green)",
    tint: "rgba(39,174,96,.07)",
    icon: "check",
  },
  {
    value: "87%",
    label: "Tỷ lệ đúng hạn",
    sub: "Chỉ tiêu giao năm 2026: 85%",
    color: "var(--orange)",
    tint: "rgba(230,126,34,.07)",
    icon: "clock",
  },
  {
    value: "4,6",
    label: "Điểm hài lòng",
    sub: "Thang điểm 5 · 1.204 lượt đánh giá",
    color: "var(--teal)",
    tint: "rgba(23,162,162,.07)",
    icon: "smile",
  },
];

/** Danh sách phiếu phản ánh (port từ prototype MOCK_DATA.phanAnh.danhSach) */
export const feedbackList: CitizenFeedback[] = [
  {
    code: "#PA-1042",
    categoryLabel: "Vệ sinh môi trường",
    title: "Bãi rác tự phát đầu cầu Thôn Đông",
    excerpt: "Người dân tự ý đổ rác thải sinh hoạt tại khu đất trống đầu cầu, bốc mùi hôi thối, ruồi muỗi nhiều.",
    location: "Thôn Đông",
    slaHoursLeft: -24,
    status: "Đang xử lý",
    rating: 0,
    senderName: "Ông Nguyễn Văn Thắng",
    senderPhone: "098•••432",
    sentAt: "18/08/2026 07:42",
    assignee: "Vũ Đức Anh",
    department: "Văn hoá – Xã hội",
    timeline: [
      { title: "Người dân gửi phản ánh qua ứng dụng ViGov", meta: "18/08/2026 07:42", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận, phân loại", meta: "18/08/2026 08:10 · Ngô Thị Lan", state: "ok" },
      { title: "Chuyển Văn hoá – Xã hội xử lý", meta: "18/08/2026 09:05 · Trần Thị Hạnh", state: "ok" },
      { title: "Kiểm tra hiện trường, lập biên bản", meta: "19/08/2026 14:20 · Vũ Đức Anh", state: "ok" },
      { title: "Đang tổ chức thu gom, cắm biển cấm đổ rác", meta: "Từ 21/08/2026 · Vũ Đức Anh", state: "cur" },
    ],
  },
  {
    code: "#PA-1041",
    categoryLabel: "Giao thông",
    title: "Ổ gà lớn đường liên thôn Đoài – Trung",
    excerpt: "Đoạn đường dài khoảng 60m xuất hiện nhiều ổ gà sâu, nước đọng, đã có 2 vụ ngã xe máy.",
    location: "Thôn Đoài",
    slaHoursLeft: 6,
    status: "Đang xử lý",
    rating: 0,
    senderName: "Bà Trần Thị Mến",
    senderPhone: "091•••118",
    sentAt: "21/08/2026 16:05",
    assignee: "Lê Minh Tuấn",
    department: "Địa chính – Xây dựng",
    timeline: [
      { title: "Người dân gửi phản ánh kèm 3 ảnh hiện trường", meta: "21/08/2026 16:05", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận", meta: "21/08/2026 16:30 · Ngô Thị Lan", state: "ok" },
      { title: "Chuyển Địa chính – Xây dựng xử lý", meta: "22/08/2026 08:00 · Trần Thị Hạnh", state: "ok" },
      { title: "Đang khảo sát, chuẩn bị vật liệu vá đường", meta: "Từ 22/08/2026 · Lê Minh Tuấn", state: "cur" },
    ],
  },
  {
    code: "#PA-1040",
    categoryLabel: "Vệ sinh môi trường",
    title: "Cống thoát nước tắc gây ngập Tổ dân phố số 4",
    excerpt: "Mỗi khi mưa lớn, nước dâng ngập vào sân nhà dân khoảng 30cm, thoát rất chậm.",
    location: "Tổ dân phố số 4",
    slaHoursLeft: -48,
    status: "Đang xử lý",
    rating: 0,
    senderName: "Tập thể Tổ dân phố số 4",
    senderPhone: "090•••765",
    sentAt: "17/08/2026 09:20",
    assignee: "Lê Minh Tuấn",
    department: "Địa chính – Xây dựng",
    timeline: [
      { title: "Người dân gửi phản ánh tập thể", meta: "17/08/2026 09:20", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận", meta: "17/08/2026 10:00 · Ngô Thị Lan", state: "ok" },
      { title: "Chuyển Địa chính – Xây dựng xử lý", meta: "17/08/2026 14:15 · Trần Thị Hạnh", state: "ok" },
      { title: "Đã nạo vét 2 hố ga, đang chờ bố trí kinh phí nâng cấp", meta: "Từ 20/08/2026 · Lê Minh Tuấn", state: "cur" },
    ],
  },
  {
    code: "#PA-1039",
    categoryLabel: "Trật tự đô thị",
    title: "Đèn chiếu sáng hỏng đoạn Tổ dân phố số 3",
    excerpt: "18 bộ đèn chiếu sáng công cộng không sáng gần một tháng, người dân đi lại buổi tối không an toàn.",
    location: "Tổ dân phố số 3",
    slaHoursLeft: 0,
    status: "Đã xử lý",
    rating: 5,
    ratingComment: "Cán bộ xã xử lý rất nhanh, chỉ sau 5 ngày đã thay xong toàn bộ đèn. Bà con trong tổ rất phấn khởi.",
    senderName: "Ông Vũ Ngọc Bảo",
    senderPhone: "097•••201",
    sentAt: "02/08/2026 19:30",
    assignee: "Lê Minh Tuấn",
    department: "Địa chính – Xây dựng",
    timeline: [
      { title: "Người dân gửi phản ánh qua ứng dụng ViGov", meta: "02/08/2026 19:30", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận", meta: "03/08/2026 08:05 · Ngô Thị Lan", state: "ok" },
      { title: "Chuyển Địa chính – Xây dựng, tạo nhiệm vụ NV-2611", meta: "03/08/2026 09:40 · Trần Thị Hạnh", state: "ok" },
      { title: "Thi công thay thế 18 bộ đèn, bổ sung 6 bộ mới", meta: "06/08/2026 · Lê Minh Tuấn", state: "ok" },
      { title: "Hoàn thành, người dân đánh giá 5 sao", meta: "08/08/2026 17:10 · Lê Minh Tuấn", state: "ok" },
    ],
  },
  {
    code: "#PA-1038",
    categoryLabel: "Rác thải",
    title: "Quán ăn xả nước thải ra kênh Thôn Đoài",
    excerpt: "Quán ăn ven đường xả trực tiếp nước thải chưa qua xử lý ra kênh tiêu, nước đen và có mùi.",
    location: "Thôn Đoài",
    slaHoursLeft: -12,
    status: "Đang xử lý",
    rating: 0,
    senderName: "Ông Lê Văn Hoà",
    senderPhone: "094•••887",
    sentAt: "19/08/2026 11:15",
    assignee: "Vũ Đức Anh",
    department: "Văn hoá – Xã hội",
    timeline: [
      { title: "Người dân gửi phản ánh kèm video", meta: "19/08/2026 11:15", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận", meta: "19/08/2026 13:40 · Ngô Thị Lan", state: "ok" },
      { title: "Chuyển Văn hoá – Xã hội phối hợp Công an xã", meta: "19/08/2026 15:00 · Trần Thị Hạnh", state: "ok" },
      { title: "Đã lập biên bản, yêu cầu cơ sở khắc phục trong 10 ngày", meta: "Từ 20/08/2026 · Vũ Đức Anh", state: "cur" },
    ],
  },
  {
    code: "#PA-1037",
    categoryLabel: "An ninh",
    title: "Tụ tập gây mất trật tự ban đêm khu chợ Đại Thắng",
    excerpt: "Một nhóm thanh niên thường xuyên tụ tập, nẹt pô sau 23 giờ gây ồn ào khu dân cư quanh chợ.",
    location: "Tổ dân phố số 1",
    slaHoursLeft: 18,
    status: "Đang xử lý",
    rating: 0,
    senderName: "Bà Phạm Thị Xuân",
    senderPhone: "096•••330",
    sentAt: "20/08/2026 22:40",
    assignee: "Hoàng Văn Sơn",
    department: "Công an xã",
    timeline: [
      { title: "Người dân gửi phản ánh qua tổng đài", meta: "20/08/2026 22:40", state: "ok" },
      { title: "Trực ban Công an xã tiếp nhận", meta: "20/08/2026 22:55 · Hoàng Văn Sơn", state: "ok" },
      { title: "Đang tăng cường tuần tra ban đêm khu vực chợ", meta: "Từ 21/08/2026 · Hoàng Văn Sơn", state: "cur" },
    ],
  },
  {
    code: "#PA-1036",
    categoryLabel: "Xây dựng",
    title: "Công trình xây dựng không che chắn Thôn Trung",
    excerpt: "Nhà dân đang xây không che chắn, vật liệu rơi vãi xuống đường gây nguy hiểm cho người qua lại.",
    location: "Thôn Trung",
    slaHoursLeft: 0,
    status: "Đã xử lý",
    rating: 4,
    ratingComment: "Xã có xuống kiểm tra và nhắc nhở chủ nhà. Xử lý được nhưng mong lần sau nhanh hơn một chút.",
    senderName: "Ông Đinh Văn Cường",
    senderPhone: "098•••512",
    sentAt: "10/08/2026 08:25",
    assignee: "Lê Minh Tuấn",
    department: "Địa chính – Xây dựng",
    timeline: [
      { title: "Người dân gửi phản ánh qua ứng dụng ViGov", meta: "10/08/2026 08:25", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công tiếp nhận", meta: "10/08/2026 09:10 · Ngô Thị Lan", state: "ok" },
      { title: "Chuyển Địa chính – Xây dựng kiểm tra", meta: "10/08/2026 10:30 · Trần Thị Hạnh", state: "ok" },
      { title: "Lập biên bản, yêu cầu chủ đầu tư che chắn", meta: "12/08/2026 · Lê Minh Tuấn", state: "ok" },
      { title: "Hoàn thành, người dân đánh giá 4 sao", meta: "14/08/2026 16:00 · Lê Minh Tuấn", state: "ok" },
    ],
  },
  {
    code: "#PA-1035",
    categoryLabel: "Cán bộ",
    title: "Thủ tục cấp bản sao hộ tịch chờ lâu",
    excerpt: "Người dân đến làm bản sao trích lục khai sinh phải chờ hơn 40 phút do máy in bị lỗi.",
    location: "Tổ dân phố số 2",
    slaHoursLeft: 0,
    status: "Đã xử lý",
    rating: 4,
    ratingComment: "Bộ phận một cửa đã xin lỗi và bố trí máy in dự phòng. Lần sau đi làm nhanh hơn hẳn.",
    senderName: "Bà Nguyễn Thị Hoà",
    senderPhone: "093•••604",
    sentAt: "08/08/2026 10:05",
    assignee: "Ngô Thị Lan",
    department: "Trung tâm Phục vụ hành chính công",
    timeline: [
      { title: "Người dân góp ý tại quầy tiếp nhận", meta: "08/08/2026 10:05", state: "ok" },
      { title: "Trung tâm Phục vụ hành chính công ghi nhận", meta: "08/08/2026 10:20 · Ngô Thị Lan", state: "ok" },
      { title: "Bố trí máy in dự phòng, rà soát quy trình", meta: "09/08/2026 · Ngô Thị Lan", state: "ok" },
      { title: "Hoàn thành, người dân đánh giá 4 sao", meta: "11/08/2026 09:00 · Ngô Thị Lan", state: "ok" },
    ],
  },
  {
    code: "#PA-1034",
    categoryLabel: "Giao thông",
    title: "Biển báo giao thông ngã ba Thôn Đông bị che khuất",
    excerpt: "Cây xanh mọc um tùm che khuất biển báo giao hạn chế tốc độ tại ngã ba vào Thôn Đông.",
    location: "Thôn Đông",
    slaHoursLeft: 30,
    status: "Mới tiếp nhận",
    rating: 0,
    senderName: "Ông Hoàng Minh Đức",
    senderPhone: "090•••977",
    sentAt: "22/08/2026 07:50",
    assignee: UNASSIGNED,
    department: UNASSIGNED,
    timeline: [
      { title: "Người dân gửi phản ánh qua ứng dụng ViGov", meta: "22/08/2026 07:50", state: "ok" },
      { title: "Chờ Trung tâm Phục vụ hành chính công phân loại", meta: "Từ 22/08/2026", state: "cur" },
    ],
  },
];

/** Toạ độ ghim bản đồ mini theo mã phiếu (% trong khung — provider thật dùng lat/lng) */
export const feedbackPins: Record<string, { x: number; y: number }> = {
  "#PA-1042": { x: 62, y: 40 },
  "#PA-1041": { x: 28, y: 52 },
  "#PA-1040": { x: 47, y: 66 },
  "#PA-1039": { x: 55, y: 34 },
  "#PA-1038": { x: 24, y: 46 },
  "#PA-1037": { x: 40, y: 60 },
  "#PA-1036": { x: 52, y: 48 },
  "#PA-1035": { x: 68, y: 58 },
  "#PA-1034": { x: 72, y: 38 },
};

/** Toạ độ mặc định khi chưa có ghim */
export const DEFAULT_PIN = { x: 50, y: 52 };
