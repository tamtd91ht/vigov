import type { VideoItem } from "@/types";

/** Chủ đề video tuyên truyền — dùng cho chip lọc (nguồn thật: CMS API). */
export const videoTopics: string[] = [
  "Cải cách hành chính",
  "An toàn giao thông",
  "Phòng chống thiên tai",
  "Chuyển đổi số",
  "Nông thôn mới",
];

/**
 * Video tuyên truyền mẫu cấp xã — Phase 1 mock (WBS #18),
 * port từ app Flutter (lib/mocks/video_mock.dart).
 */
export const mockVideos: VideoItem[] = [
  {
    id: "v1",
    title: "Hướng dẫn nộp hồ sơ trực tuyến trên Cổng dịch vụ công",
    topic: "Cải cách hành chính",
    duration: "05:24",
    views: 3241,
    publishedAt: "24/08/2026",
    coverColor: "var(--blue)",
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    description:
      "Hướng dẫn từng bước đăng ký tài khoản, nộp hồ sơ và theo dõi kết quả trên Cổng dịch vụ công quốc gia. " +
      "Người dân có thể thực hiện toàn bộ thủ tục tại nhà mà không cần đến trụ sở UBND xã. " +
      "Video do Trung tâm Phục vụ hành chính công xã Đại Thắng thực hiện.",
  },
  {
    id: "v2",
    title: "Kỹ năng phòng tránh lũ quét mùa mưa bão",
    topic: "Phòng chống thiên tai",
    duration: "06:12",
    views: 2874,
    publishedAt: "22/08/2026",
    coverColor: "var(--teal)",
    source: "youtube",
    youtubeUrl: "https://youtu.be/ScMzIvxBSi4",
    description:
      "Nhận biết dấu hiệu lũ quét, sạt lở đất và các bước sơ tán an toàn cho hộ dân ven sông, ven suối. " +
      "Video hướng dẫn chuẩn bị túi đồ khẩn cấp và số điện thoại cứu hộ cần ghi nhớ. " +
      "Ban Chỉ huy PCTT&TKCN xã phối hợp Đài truyền thanh thực hiện.",
  },
  {
    id: "v3",
    title: "Đội mũ bảo hiểm đạt chuẩn — bảo vệ con em khi đến trường",
    topic: "An toàn giao thông",
    duration: "03:45",
    views: 1520,
    publishedAt: "20/08/2026",
    coverColor: "var(--orange)",
    source: "hosted",
    videoFileId: "",
    description:
      "Cách chọn mũ bảo hiểm đạt chuẩn và đội đúng cách cho trẻ em khi ngồi xe máy, xe đạp điện. " +
      "Thống kê tai nạn liên quan học sinh trên địa bàn và lời nhắc từ Công an xã trước năm học mới.",
  },
  {
    id: "v4",
    title: "Cài đặt và định danh điện tử VNeID mức 2 tại nhà",
    topic: "Chuyển đổi số",
    duration: "07:30",
    views: 4102,
    publishedAt: "18/08/2026",
    coverColor: "var(--purple)",
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/shorts/ScMzIvxBSi4",
    description:
      "Hướng dẫn cài đặt ứng dụng VNeID, kích hoạt tài khoản định danh điện tử mức 2 và tích hợp giấy tờ. " +
      "Tổ công nghệ số cộng đồng thôn sẵn sàng hỗ trợ người cao tuổi thực hiện. " +
      "Video thuộc chuỗi tuyên truyền Đề án 06 của xã.",
  },
  {
    id: "v5",
    title: "Tiêu chí xây dựng thôn nông thôn mới kiểu mẫu năm 2026",
    topic: "Nông thôn mới",
    duration: "04:50",
    views: 968,
    publishedAt: "16/08/2026",
    coverColor: "var(--green)",
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    description:
      "Giới thiệu 10 tiêu chí thôn nông thôn mới kiểu mẫu và lộ trình phấn đấu của các thôn trong xã. " +
      "Người dân cùng tham gia hiến đất mở đường, trồng hoa ven đường và phân loại rác tại nguồn.",
  },
  {
    id: "v6",
    title: "Trả kết quả thủ tục hành chính qua bưu điện — tiết kiệm thời gian",
    topic: "Cải cách hành chính",
    duration: "02:58",
    views: 743,
    publishedAt: "14/08/2026",
    coverColor: "var(--pink)",
    source: "hosted",
    videoFileId: "",
    description:
      "Dịch vụ tiếp nhận và trả kết quả thủ tục hành chính qua bưu chính công ích ngay tại nhà. " +
      "Mức phí, thời gian nhận kết quả và cách đăng ký khi nộp hồ sơ tại bộ phận một cửa.",
  },
  {
    id: "v7",
    title: "Diễn tập sơ tán dân vùng ven sông khi có báo động lũ",
    topic: "Phòng chống thiên tai",
    duration: "05:05",
    views: 1189,
    publishedAt: "12/08/2026",
    coverColor: "var(--navy)",
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    description:
      "Ghi nhận buổi diễn tập sơ tán 120 hộ dân Thôn Đông khi có báo động lũ cấp 3 trên sông Nhuệ. " +
      "Phương án di dời, điểm tập kết và vai trò của lực lượng xung kích phòng chống thiên tai cấp thôn.",
  },
  {
    id: "v8",
    title: "Đã uống rượu bia — không lái xe",
    topic: "An toàn giao thông",
    duration: "04:18",
    views: 2356,
    publishedAt: "10/08/2026",
    coverColor: "var(--red)",
    source: "youtube",
    youtubeUrl: "https://www.youtube.com/shorts/ScMzIvxBSi4",
    description:
      'Mức xử phạt vi phạm nồng độ cồn theo quy định mới và các vụ tai nạn điển hình trên địa bàn huyện. ' +
      'Thông điệp "Đã uống rượu bia — không lái xe" gửi đến người dân dịp lễ Quốc khánh 2/9.',
  },
];
