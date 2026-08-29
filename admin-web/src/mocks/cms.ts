import type { BroadcastLog, CmsArticle, CmsVideo, RadioBulletin } from "@/types";

/* ============================================================
   Mock CMS nội dung Mobile — UBND xã Đại Thắng (demo 7-8/2026)
   Nguồn thật: API CMS (P2). Danh mục dưới đây sẽ lấy từ API
   cấu hình — đặt tập trung để không rải chuỗi trong component.
   ============================================================ */

/** Chuyên mục bài viết (tin tức / sự kiện / thông báo) */
export const articleCategories: string[] = [
  "Hoạt động chính quyền",
  "An ninh trật tự",
  "Kinh tế – Nông nghiệp",
  "Văn hoá – Xã hội",
  "Hạ tầng – Điện nước",
  "Chuyển đổi số",
];

/** Chủ đề video tuyên truyền */
export const videoTopics: string[] = [
  "Cải cách hành chính",
  "An toàn giao thông",
  "Phòng chống thiên tai",
  "Chuyển đổi số",
  "Y tế – Sức khoẻ",
];

/** Chuyên mục bản tin truyền thanh */
export const radioCategories: string[] = ["Thời sự xã", "Nông vụ", "Chính sách mới"];

/** Bài viết CMS — tác giả lấy từ danh bạ cán bộ (staffDirectory) */
export const cmsArticles: CmsArticle[] = [
  {
    id: "ART-2608",
    type: "news",
    title: "Xã Đại Thắng ra mắt mô hình camera an ninh thôn xóm",
    category: "An ninh trật tự",
    excerpt: "42 mắt camera phủ kín 5 trục đường liên thôn, kết nối trực tiếp về Công an xã, kinh phí xã hội hoá 100%.",
    content:
      "Sáng 05/8, UBND xã Đại Thắng phối hợp Công an xã tổ chức lễ ra mắt mô hình “Camera an ninh thôn xóm”. Giai đoạn 1 lắp đặt 42 mắt camera tại 5 trục đường liên thôn và các điểm giáp ranh, hình ảnh truyền trực tiếp về trung tâm giám sát đặt tại trụ sở Công an xã. Toàn bộ kinh phí gần 180 triệu đồng do nhân dân và doanh nghiệp trên địa bàn đóng góp.",
    coverColor: "var(--teal)",
    status: "published",
    publishedAt: "05/08/2026",
    author: "Hoàng Văn Sơn",
    views: 1842,
  },
  {
    id: "ART-2607",
    type: "event",
    title: "Hội nghị đối thoại Chủ tịch UBND xã với nhân dân năm 2026",
    category: "Hoạt động chính quyền",
    excerpt: "Diễn ra 8h00 ngày 22/8 tại hội trường UBND xã, tiếp nhận và giải đáp trực tiếp kiến nghị của công dân.",
    content:
      "Thực hiện quy chế dân chủ ở cơ sở, UBND xã Đại Thắng tổ chức Hội nghị đối thoại giữa Chủ tịch UBND xã với nhân dân năm 2026. Hội nghị tập trung các nhóm vấn đề: đất đai, môi trường, hạ tầng giao thông nông thôn và thủ tục hành chính. Kính mời bà con sắp xếp thời gian tham dự và gửi câu hỏi trước qua Mini App.",
    coverColor: "var(--purple)",
    status: "published",
    publishedAt: "12/08/2026",
    author: "Trần Thị Hạnh",
    views: 1265,
  },
  {
    id: "ART-2606",
    type: "notice",
    title: "Lịch cắt điện bảo trì trạm biến áp Thôn Đông ngày 28/8",
    category: "Hạ tầng – Điện nước",
    excerpt: "Tạm ngừng cấp điện khu vực Thôn Đông và một phần Thôn Nam từ 7h30 đến 11h30 để bảo trì định kỳ.",
    content:
      "Theo thông báo của Điện lực khu vực, trạm biến áp Thôn Đông sẽ được bảo trì định kỳ vào ngày 28/8/2026. Thời gian tạm ngừng cấp điện dự kiến từ 7h30 đến 11h30. Phạm vi ảnh hưởng: toàn bộ Thôn Đông và các hộ dọc tuyến kênh N2 thuộc Thôn Nam. Đề nghị bà con chủ động phương án sản xuất, sinh hoạt phù hợp.",
    coverColor: "var(--orange)",
    status: "published",
    publishedAt: "24/08/2026",
    author: "Vũ Đức Anh",
    views: 2310,
  },
  {
    id: "ART-2605",
    type: "news",
    title: "Hơn 300 hồ sơ được xử lý trực tuyến toàn trình trong tháng 7",
    category: "Chuyển đổi số",
    excerpt: "Tỷ lệ hồ sơ nộp qua cổng dịch vụ công và Mini App đạt 68%, tăng 21 điểm phần trăm so với cùng kỳ.",
    content:
      "Trong tháng 7/2026, Trung tâm Phục vụ hành chính công xã tiếp nhận 447 hồ sơ, trong đó 304 hồ sơ nộp và trả kết quả hoàn toàn trực tuyến. Các thủ tục được nộp trực tuyến nhiều nhất gồm: xác nhận cư trú, chứng thực bản sao điện tử và đăng ký khai sinh. Xã phấn đấu đạt tỷ lệ 75% hồ sơ trực tuyến toàn trình vào cuối quý III.",
    coverColor: "var(--blue)",
    status: "published",
    publishedAt: "31/07/2026",
    author: "Ngô Thị Lan",
    views: 986,
  },
  {
    id: "ART-2604",
    type: "news",
    title: "Trao 42 suất quà cho gia đình chính sách dịp 27/7",
    category: "Văn hoá – Xã hội",
    excerpt: "Lãnh đạo xã thăm hỏi, tặng quà các gia đình thương binh, liệt sĩ và người có công nhân ngày 27/7.",
    content:
      "Nhân kỷ niệm Ngày Thương binh - Liệt sĩ 27/7, lãnh đạo Đảng uỷ, HĐND, UBND xã Đại Thắng đã đến thăm hỏi và trao 42 suất quà cho các gia đình chính sách trên địa bàn, tổng trị giá 33,6 triệu đồng từ nguồn quỹ Đền ơn đáp nghĩa của xã.",
    coverColor: "var(--pink)",
    status: "published",
    publishedAt: "27/07/2026",
    author: "Vũ Đức Anh",
    views: 754,
  },
  {
    id: "ART-2603",
    type: "notice",
    title: "Thông báo tiêm phòng dại cho đàn chó, mèo đợt 2/2026",
    category: "Kinh tế – Nông nghiệp",
    excerpt: "Tiêm tập trung tại nhà văn hoá các thôn từ 18/7 đến 20/7, lệ phí theo quy định của Chi cục Thú y.",
    content:
      "UBND xã thông báo kế hoạch tiêm phòng dại cho đàn chó, mèo đợt 2 năm 2026. Thời gian: từ ngày 18/7 đến 20/7, buổi sáng 7h30-10h30 tại nhà văn hoá các thôn. Đề nghị các hộ nuôi chó, mèo đưa vật nuôi đến tiêm đầy đủ; hộ không chấp hành sẽ bị xử lý theo Nghị định 90/2017/NĐ-CP.",
    coverColor: "var(--green)",
    status: "published",
    publishedAt: "15/07/2026",
    author: "Lê Minh Tuấn",
    views: 1128,
  },
  {
    id: "ART-2602",
    type: "event",
    title: "Lễ phát động chiến dịch làm sạch kênh mương nội đồng",
    category: "Kinh tế – Nông nghiệp",
    excerpt: "Dự kiến 6h30 ngày 06/9 tại kênh N2, huy động lực lượng đoàn viên và bà con 4 thôn tham gia.",
    content:
      "Chuẩn bị cho vụ mùa 2026, UBND xã phối hợp Đoàn Thanh niên xã tổ chức lễ phát động chiến dịch nạo vét, làm sạch hệ thống kênh mương nội đồng. Nội dung bài đang chờ chốt danh sách khối lượng từng thôn trước khi đăng.",
    coverColor: "var(--green)",
    status: "draft",
    publishedAt: "20/08/2026",
    author: "Vũ Đức Anh",
    views: 0,
  },
  {
    id: "ART-2601",
    type: "event",
    title: "Đêm hội trăng rằm cho thiếu nhi xã Đại Thắng 2026",
    category: "Văn hoá – Xã hội",
    excerpt: "Dự kiến tổ chức tối 24/9 tại sân vận động xã với chương trình văn nghệ, rước đèn và phá cỗ.",
    content:
      "Kế hoạch tổ chức Tết Trung thu cho thiếu nhi toàn xã: chương trình văn nghệ do các trường học biểu diễn, rước đèn quanh trục đường trung tâm và trao quà cho 60 em có hoàn cảnh khó khăn. Bài viết chờ duyệt kinh phí trước khi công bố.",
    coverColor: "var(--purple)",
    status: "draft",
    publishedAt: "18/08/2026",
    author: "Trần Thị Hạnh",
    views: 0,
  },
];

/** Video tuyên truyền */
export const cmsVideos: CmsVideo[] = [
  {
    id: "VID-06",
    title: "Hướng dẫn nộp hồ sơ trực tuyến trên Mini App ViGov",
    topic: "Cải cách hành chính",
    duration: "04:35",
    views: 2431,
    source: "youtube",
    publishedAt: "08/08/2026",
    status: "published",
  },
  {
    id: "VID-05",
    title: "Kỹ năng ứng phó bão và ngập úng cho hộ dân ven sông",
    topic: "Phòng chống thiên tai",
    duration: "06:48",
    views: 1876,
    source: "youtube",
    publishedAt: "20/08/2026",
    status: "published",
  },
  {
    id: "VID-04",
    title: "Đội mũ bảo hiểm đúng cách khi đưa trẻ đến trường",
    topic: "An toàn giao thông",
    duration: "02:10",
    views: 1315,
    source: "hosted",
    publishedAt: "28/07/2026",
    status: "published",
  },
  {
    id: "VID-03",
    title: "Cài đặt định danh điện tử VNeID mức 2 tại nhà",
    topic: "Chuyển đổi số",
    duration: "05:22",
    views: 3050,
    source: "youtube",
    publishedAt: "15/07/2026",
    status: "published",
  },
  {
    id: "VID-02",
    title: "Phòng bệnh sốt xuất huyết trong mùa mưa",
    topic: "Y tế – Sức khoẻ",
    duration: "03:15",
    views: 927,
    source: "hosted",
    publishedAt: "22/07/2026",
    status: "published",
  },
  {
    id: "VID-01",
    title: "Quy trình phản ánh hiện trường qua Mini App công dân",
    topic: "Cải cách hành chính",
    duration: "04:02",
    views: 0,
    source: "hosted",
    publishedAt: "25/08/2026",
    status: "draft",
  },
];

/** Bản tin truyền thanh — ngày gần nhau để demo nhóm theo ngày */
export const radioBulletins: RadioBulletin[] = [
  { id: "RAD-11", title: "Bản tin thời sự xã sáng 26/8", category: "Thời sự xã", date: "26/08/2026", duration: "12:30", plays: 486, status: "published" },
  { id: "RAD-10", title: "Lịch gieo sạ vụ mùa và phòng trừ rầy nâu", category: "Nông vụ", date: "26/08/2026", duration: "08:45", plays: 352, status: "published" },
  { id: "RAD-09", title: "Bản tin thời sự xã sáng 25/8", category: "Thời sự xã", date: "25/08/2026", duration: "11:50", plays: 512, status: "published" },
  { id: "RAD-08", title: "Mức hỗ trợ mới cho hộ nghèo áp dụng từ 01/9/2026", category: "Chính sách mới", date: "25/08/2026", duration: "09:20", plays: 618, status: "published" },
  { id: "RAD-07", title: "Bản tin thời sự xã sáng 24/8", category: "Thời sự xã", date: "24/08/2026", duration: "12:05", plays: 465, status: "published" },
  { id: "RAD-06", title: "Khuyến cáo tưới tiết kiệm nước cuối vụ hè thu", category: "Nông vụ", date: "24/08/2026", duration: "07:40", plays: 0, status: "draft" },
];

/** Lịch sử gửi thông báo broadcast (ZNS / Push Mini App) */
export const broadcastLogs: BroadcastLog[] = [
  {
    id: "BC-07",
    channel: "push",
    audience: "citizen",
    title: "Cảnh báo mưa lớn, đề phòng ngập úng vùng trũng đêm 26/8",
    sentAt: "16:40 · 26/08/2026",
    sentBy: "Vũ Đức Anh",
    total: 1720,
    delivered: 1104,
    status: "sending",
  },
  {
    id: "BC-06",
    channel: "zns",
    audience: "citizen",
    title: "Lịch cắt điện bảo trì trạm biến áp Thôn Đông ngày 28/8",
    sentAt: "09:15 · 25/08/2026",
    sentBy: "Vũ Đức Anh",
    total: 1900,
    delivered: 1842,
    status: "sent",
  },
  {
    id: "BC-05",
    channel: "zns",
    audience: "internal",
    title: "Yêu cầu nộp báo cáo tuần trước 17h00 thứ Sáu",
    sentAt: "08:05 · 21/08/2026",
    sentBy: "Nguyễn Văn Bình",
    total: 48,
    delivered: 46,
    status: "sent",
  },
  {
    id: "BC-04",
    channel: "push",
    audience: "internal",
    title: "Họp giao ban trực tuyến 8h00 thứ Hai — phòng họp số",
    sentAt: "17:20 · 17/08/2026",
    sentBy: "Trần Thị Hạnh",
    total: 48,
    delivered: 48,
    status: "sent",
  },
  {
    id: "BC-03",
    channel: "push",
    audience: "citizen",
    title: "Mời tham dự Hội nghị đối thoại Chủ tịch UBND xã với nhân dân",
    sentAt: "10:30 · 12/08/2026",
    sentBy: "Trần Thị Hạnh",
    total: 1720,
    delivered: 1650,
    status: "sent",
  },
  {
    id: "BC-02",
    channel: "zns",
    audience: "citizen",
    title: "Kết quả xử lý phản ánh tuyến đường liên thôn Đông – Nam",
    sentAt: "14:05 · 03/08/2026",
    sentBy: "Ngô Thị Lan",
    total: 1900,
    delivered: 1795,
    status: "sent",
  },
  {
    id: "BC-01",
    channel: "zns",
    audience: "citizen",
    title: "Thông báo tiêm phòng dại cho đàn chó, mèo đợt 2/2026",
    sentAt: "07:50 · 15/07/2026",
    sentBy: "Lê Minh Tuấn",
    total: 1900,
    delivered: 0,
    status: "failed",
  },
];
