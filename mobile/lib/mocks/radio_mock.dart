import '../models/models.dart';

/// Chuyên mục truyền thanh — dùng cho hàng chip lọc (WBS #17).
const List<String> radioCategories = [
  'Thời sự xã',
  'Nông vụ',
  'Chính sách mới',
  'An ninh trật tự',
];

/// Bản tin truyền thanh mẫu — xã Đại Thắng, 3 ngày gần nhất (nguồn thật: hệ thống IP radio).
final List<RadioBulletin> mockRadioBulletins = [
  // ===== 26/08/2026 =====
  const RadioBulletin(
    id: 'r1',
    title: 'Bản tin sáng 26/8 — Tiến độ giải phóng mặt bằng tuyến Đông – Trung',
    category: 'Thời sự xã',
    date: '26/08/2026',
    durationSeconds: 512,
    plays: 486,
  ),
  const RadioBulletin(
    id: 'r2',
    title: 'Hướng dẫn phòng trừ sâu cuốn lá nhỏ hại lúa vụ mùa đợt cuối tháng 8',
    category: 'Nông vụ',
    date: '26/08/2026',
    durationSeconds: 438,
    plays: 352,
  ),
  const RadioBulletin(
    id: 'r3',
    title: 'Bản tin chiều 26/8 — Kết quả tuần cao điểm xử lý vi phạm nồng độ cồn',
    category: 'An ninh trật tự',
    date: '26/08/2026',
    durationSeconds: 366,
    plays: 291,
  ),
  // ===== 25/08/2026 =====
  const RadioBulletin(
    id: 'r4',
    title: 'Bản tin sáng 25/8 — Chuẩn bị khai giảng năm học mới tại các trường trên địa bàn',
    category: 'Thời sự xã',
    date: '25/08/2026',
    durationSeconds: 547,
    plays: 613,
  ),
  const RadioBulletin(
    id: 'r5',
    title: 'Phổ biến Nghị định mới về hỗ trợ bảo hiểm y tế cho hộ cận nghèo từ 01/9',
    category: 'Chính sách mới',
    date: '25/08/2026',
    durationSeconds: 594,
    plays: 448,
  ),
  const RadioBulletin(
    id: 'r6',
    title: 'Khuyến cáo bơm tiêu úng, chống ngập cho diện tích rau màu ven sông Nhuệ',
    category: 'Nông vụ',
    date: '25/08/2026',
    durationSeconds: 312,
    plays: 275,
  ),
  // ===== 24/08/2026 =====
  const RadioBulletin(
    id: 'r7',
    title: 'Bản tin sáng 24/8 — Ra mắt mô hình camera an ninh thôn xóm với 32 mắt camera',
    category: 'An ninh trật tự',
    date: '24/08/2026',
    durationSeconds: 421,
    plays: 529,
  ),
  const RadioBulletin(
    id: 'r8',
    title: 'Giải đáp chính sách miễn giảm học phí năm học 2026–2027 cho học sinh công lập',
    category: 'Chính sách mới',
    date: '24/08/2026',
    durationSeconds: 583,
    plays: 397,
  ),
];
