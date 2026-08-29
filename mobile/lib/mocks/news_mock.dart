import '../config/theme.dart';
import '../models/models.dart';

/// Bài viết mẫu — đồng bộ cấu trúc CmsArticle của Web Quản trị (nguồn thật: CMS API).
final List<Article> mockArticles = [
  Article(
    id: 'a1',
    type: ArticleType.news,
    title: 'Xã Đại Thắng ra mắt mô hình camera an ninh thôn xóm',
    category: 'An ninh trật tự',
    excerpt: '32 mắt camera được lắp đặt tại các trục đường chính, kết nối về Công an xã.',
    content:
        'Sáng 24/8, UBND xã Đại Thắng phối hợp Công an xã tổ chức ra mắt mô hình "Camera an ninh thôn xóm" với 32 mắt camera lắp đặt tại các trục đường chính, khu vực chợ và cổng trường học.\n\nHệ thống được kết nối trực tiếp về trực ban Công an xã, hỗ trợ giám sát an ninh trật tự và xử lý vi phạm giao thông. Kinh phí thực hiện từ nguồn xã hội hoá do nhân dân và doanh nghiệp trên địa bàn đóng góp.\n\nTrong thời gian tới, xã tiếp tục vận động mở rộng thêm 18 mắt camera tại các thôn còn lại.',
    coverColor: AppColors.blue,
    publishedAt: '24/08/2026',
    views: 1284,
  ),
  Article(
    id: 'a2',
    type: ArticleType.event,
    title: 'Hội nghị đối thoại giữa Chủ tịch UBND xã với nhân dân năm 2026',
    category: 'Chính quyền',
    excerpt: 'Diễn ra ngày 05/9 tại Hội trường UBND xã, đăng ký ý kiến trước qua ứng dụng ViGov.',
    content:
        'UBND xã Đại Thắng tổ chức Hội nghị đối thoại trực tiếp giữa Chủ tịch UBND xã với nhân dân vào 8h00 ngày 05/9/2026 tại Hội trường UBND xã.\n\nNội dung đối thoại tập trung vào: tiến độ các công trình đầu tư công, công tác quản lý đất đai, vệ sinh môi trường và cải cách thủ tục hành chính.\n\nNgười dân có thể đăng ký ý kiến trước qua ứng dụng ViGov hoặc trực tiếp tại Trung tâm Phục vụ hành chính công.',
    coverColor: AppColors.pink,
    publishedAt: '23/08/2026',
    views: 862,
  ),
  Article(
    id: 'a3',
    type: ArticleType.notice,
    title: 'Lịch cắt điện bảo trì trạm biến áp Thôn Trung ngày 29/8',
    category: 'Thông báo',
    excerpt: 'Cắt điện từ 7h30 đến 11h30 khu vực Thôn Trung và một phần Tổ dân phố số 2.',
    content:
        'Điện lực Phú Xuyên thông báo cắt điện bảo trì trạm biến áp Thôn Trung từ 7h30 đến 11h30 ngày 29/8/2026.\n\nKhu vực ảnh hưởng: toàn bộ Thôn Trung và một phần Tổ dân phố số 2. Đề nghị nhân dân chủ động phương án sinh hoạt, sản xuất phù hợp.',
    coverColor: AppColors.orange,
    publishedAt: '22/08/2026',
    views: 2107,
  ),
  Article(
    id: 'a4',
    type: ArticleType.news,
    title: 'Hoàn thành thay thế 228 bộ đèn LED chiếu sáng đường thôn',
    category: 'Hạ tầng',
    excerpt: '12 tuyến đường thôn đã sáng đèn LED tiết kiệm điện, hoàn thành trước kế hoạch.',
    content:
        'Đến ngày 20/8, xã Đại Thắng đã hoàn thành lắp đặt 228/240 bộ đèn LED chiếu sáng công cộng trên 12 tuyến đường thôn, vượt tiến độ kế hoạch 10 ngày.\n\n12 bộ đèn còn lại thuộc tuyến Đông – Trung sẽ lắp đặt sau khi hoàn tất giải phóng mặt bằng, dự kiến hoàn thành trước 30/9/2026.',
    coverColor: AppColors.green,
    publishedAt: '20/08/2026',
    views: 946,
  ),
  Article(
    id: 'a5',
    type: ArticleType.event,
    title: 'Ngày hội hiến máu tình nguyện "Giọt hồng Đại Thắng"',
    category: 'Y tế – Cộng đồng',
    excerpt: 'Tổ chức sáng 12/9 tại Nhà văn hoá Thôn Đông, chỉ tiêu 150 đơn vị máu.',
    content:
        'Hội Chữ thập đỏ xã phối hợp Trạm Y tế tổ chức Ngày hội hiến máu tình nguyện "Giọt hồng Đại Thắng" từ 7h30 ngày 12/9/2026 tại Nhà văn hoá Thôn Đông.\n\nNgười đăng ký hiến máu được khám sức khoẻ, xét nghiệm miễn phí và nhận quà lưu niệm của chương trình.',
    coverColor: AppColors.red,
    publishedAt: '19/08/2026',
    views: 534,
  ),
  Article(
    id: 'a6',
    type: ArticleType.notice,
    title: 'Niêm yết công khai danh sách hộ nghèo, hộ cận nghèo Quý III',
    category: 'Chính sách',
    excerpt: 'Danh sách niêm yết 10 ngày tại nhà văn hoá các thôn từ 25/8 đến 04/9.',
    content:
        'UBND xã niêm yết công khai danh sách rà soát hộ nghèo, hộ cận nghèo Quý III/2026 tại nhà văn hoá 8 thôn, tổ dân phố từ ngày 25/8 đến 04/9/2026.\n\nNhân dân có ý kiến phản hồi gửi về bộ phận Văn hoá – Xã hội hoặc phản ánh qua ứng dụng ViGov, mục "Cán bộ".',
    coverColor: AppColors.purple,
    publishedAt: '18/08/2026',
    views: 1653,
  ),
  Article(
    id: 'a7',
    type: ArticleType.news,
    title: 'Kênh tiêu Thôn Đoài được nạo vét, khơi thông sau phản ánh của người dân',
    category: 'Môi trường',
    excerpt: 'Đoạn kênh 420m qua Thôn Đoài đã được nạo vét, xử lý nguồn xả thải vi phạm.',
    content:
        'Sau phản ánh của người dân qua ứng dụng ViGov, UBND xã đã kiểm tra, lập biên bản cơ sở chế biến xả thải vi phạm và tổ chức nạo vét 420m kênh tiêu qua Thôn Đoài.\n\nCơ sở vi phạm cam kết hoàn thành hệ thống xử lý nước thải trước 10/9/2026. Xã tiếp tục giám sát định kỳ hằng tuần.',
    coverColor: AppColors.teal,
    publishedAt: '16/08/2026',
    views: 1120,
  ),
  Article(
    id: 'a8',
    type: ArticleType.notice,
    title: 'Tuyển chọn công dân nhập ngũ năm 2027 — lịch khám sơ tuyển',
    category: 'Quân sự',
    excerpt: 'Khám sơ tuyển nghĩa vụ quân sự tại Trạm Y tế xã trong 2 ngày 15–16/9.',
    content:
        'Hội đồng Nghĩa vụ quân sự xã thông báo lịch khám sơ tuyển công dân trong độ tuổi nhập ngũ năm 2027 tại Trạm Y tế xã trong 2 ngày 15–16/9/2026.\n\nCông dân thuộc diện gọi khám có mặt đúng giờ theo giấy báo, mang theo căn cước công dân.',
    coverColor: AppColors.slate,
    publishedAt: '15/08/2026',
    views: 789,
  ),
];
