import '../config/theme.dart';
import '../models/models.dart';

/// Phiếu phản ánh mẫu của công dân đang đăng nhập (nguồn thật: API P3).
final List<FeedbackTicket> initialTickets = [
  FeedbackTicket(
    code: '#PA-2026-0141',
    categoryKey: 'giao-thong',
    title: 'Ổ gà lớn đường liên thôn Đoài – Trung',
    description:
        'Đoạn đường dài khoảng 60m xuất hiện nhiều ổ gà sâu, nước đọng, đã có 2 vụ ngã xe máy. Đề nghị xã cho sửa chữa sớm.',
    location: 'Thôn Đoài, Xã Đại Thắng',
    sentAt: '21/08/2026 16:05',
    status: TicketStatus.processing,
    slaHoursLeft: 6,
    imageColors: [AppColors.blue, AppColors.slate, AppColors.teal],
    timeline: [
      TimelineStep(title: 'Gửi phản ánh kèm 3 ảnh hiện trường', meta: '21/08/2026 16:05'),
      TimelineStep(title: 'Trung tâm Phục vụ hành chính công tiếp nhận', meta: '21/08/2026 16:30'),
      TimelineStep(title: 'Chuyển Địa chính – Xây dựng xử lý', meta: '22/08/2026 08:00'),
      TimelineStep(title: 'Đang khảo sát, chuẩn bị vật liệu vá đường', meta: 'Từ 22/08/2026', current: true),
    ],
  ),
  FeedbackTicket(
    code: '#PA-2026-0128',
    categoryKey: 'rac-thai',
    title: 'Bãi rác tự phát đầu cầu Thôn Đông',
    description: 'Khu đất trống đầu cầu bị đổ rác thải sinh hoạt, bốc mùi hôi thối, ruồi muỗi nhiều.',
    location: 'Thôn Đông, Xã Đại Thắng',
    sentAt: '18/08/2026 07:42',
    status: TicketStatus.processing,
    slaHoursLeft: -24,
    imageColors: [AppColors.orange, AppColors.red],
    timeline: [
      TimelineStep(title: 'Gửi phản ánh qua ứng dụng ViGov', meta: '18/08/2026 07:42'),
      TimelineStep(title: 'Tiếp nhận, phân loại', meta: '18/08/2026 08:10'),
      TimelineStep(title: 'Chuyển Văn hoá – Xã hội xử lý', meta: '18/08/2026 09:05'),
      TimelineStep(title: 'Đang tổ chức thu gom, cắm biển cấm đổ rác', meta: 'Từ 21/08/2026', current: true),
    ],
  ),
  FeedbackTicket(
    code: '#PA-2026-0096',
    categoryKey: 'dien-chieu-sang',
    title: 'Đèn chiếu sáng hỏng đoạn Tổ dân phố số 3',
    description: '18 bộ đèn chiếu sáng công cộng không sáng gần một tháng, đi lại buổi tối không an toàn.',
    location: 'Tổ dân phố số 3, Xã Đại Thắng',
    sentAt: '02/08/2026 19:30',
    status: TicketStatus.resolved,
    slaHoursLeft: 0,
    imageColors: [AppColors.purple],
    rating: 5,
    ratingComment: 'Cán bộ xã xử lý rất nhanh, chỉ sau 5 ngày đã thay xong toàn bộ đèn.',
    timeline: [
      TimelineStep(title: 'Gửi phản ánh qua ứng dụng ViGov', meta: '02/08/2026 19:30'),
      TimelineStep(title: 'Tiếp nhận, chuyển Địa chính – Xây dựng', meta: '03/08/2026 09:40'),
      TimelineStep(title: 'Thi công thay thế 18 bộ đèn, bổ sung 6 bộ mới', meta: '06/08/2026'),
      TimelineStep(title: 'Hoàn thành — đã đánh giá 5 sao', meta: '08/08/2026 17:10'),
    ],
  ),
];
