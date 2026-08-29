import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../config/categories.dart';
import '../mocks/feedback_mock.dart';
import '../models/models.dart';
import '../services/api_client.dart';

/// Số phiếu tải về mỗi lần gọi danh sách "Phản ánh của tôi"
const int kMyFeedbackPageSize = 50;

/// Kênh gửi phản ánh từ app Flutter — backend chỉ nhận 'app' | 'zalo' | 'web'
const String kFeedbackChannel = 'app';

/// Kho phiếu phản ánh của công dân — dùng chung Trang chủ / Gửi PA / Phản ánh của tôi.
///
/// `AppConfig.useMocks = true` giữ nguyên dữ liệu mẫu trong bộ nhớ để demo offline;
/// ngược lại mọi thao tác đi qua `/feedback/citizen/**`.
class FeedbackStore extends ChangeNotifier {
  FeedbackStore({ApiClient? api}) : _api = api ?? ApiClient.instance;

  final ApiClient _api;

  List<FeedbackTicket> _tickets = AppConfig.useMocks ? List.of(initialTickets) : const [];
  bool _loading = false;
  String? _error;
  bool _loadedOnce = false;

  /// Số phiếu kế tiếp trong năm (chỉ dùng ở nhánh mock — bản thật do backend sinh mã)
  int _seq = 142;

  List<FeedbackTicket> get tickets => List.unmodifiable(_tickets);

  /// Đang tải danh sách phiếu
  bool get loading => _loading;

  /// Thông báo lỗi tiếng Việt của lần tải gần nhất; null = không có lỗi
  String? get error => _error;

  /// Đã tải danh sách ít nhất một lần (kể cả khi lỗi)
  bool get loadedOnce => _loadedOnce;

  /// Xoá dữ liệu khi phiên đóng (đăng xuất hoặc token hết hạn) — tránh để phiếu
  /// của công dân cũ hiện ra khi người khác định danh trên cùng thiết bị.
  void reset() {
    _tickets = AppConfig.useMocks ? List.of(initialTickets) : const [];
    _loading = false;
    _error = null;
    _loadedOnce = false;
    notifyListeners();
  }

  FeedbackTicket? byCode(String code) {
    for (final t in _tickets) {
      if (t.code == code) return t;
    }
    return null;
  }

  /// Tải danh sách lần đầu — gọi từ initState của Trang chủ / Phản ánh của tôi.
  Future<void> ensureLoaded() async {
    if (_loadedOnce || _loading) return;
    await load();
  }

  /// Tải (hoặc tải lại) danh sách phiếu của công dân đang đăng nhập.
  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      if (AppConfig.useMocks) {
        await Future<void>.delayed(AppConfig.mockDelay);
      } else {
        final res = await _api.getJson(
          '/feedback/citizen/mine',
          query: {'page': 1, 'limit': kMyFeedbackPageSize},
        );
        _tickets = asItems(res).map(FeedbackTicket.fromJson).toList();
      }
    } on ApiException catch (e) {
      _error = e.message;
    } finally {
      _loading = false;
      _loadedOnce = true;
      notifyListeners();
    }
  }

  /// Chi tiết một phiếu. Mã phiếu chứa '#' nên phải encode trước khi ghép vào URL.
  Future<FeedbackTicket> detail(String code) async {
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      final cached = byCode(code);
      if (cached == null) throw const ApiException('Không tìm thấy phiếu phản ánh');
      return cached;
    }

    final res = await _api.getJson('/feedback/citizen/mine/${Uri.encodeComponent(code)}');
    final ticket = FeedbackTicket.fromJson(res);
    _replace(ticket);
    return ticket;
  }

  /// Gửi phiếu mới từ luồng 3 bước — trả về phiếu đã có mã do backend sinh.
  /// Ném [ApiException] khi backend từ chối (thiếu trường, vượt hạn mức chống spam…).
  ///
  /// [imageCount] hiện chỉ dùng cho nhánh mock: ảnh hiện trường phải tải lên qua
  /// module Files để lấy `imageFileIds` (P3-24, thuộc hệ tích hợp ngoài) nên bản
  /// thật chưa gửi ảnh kèm phiếu.
  Future<FeedbackTicket> create({
    required FeedbackCategory category,
    required String title,
    required String description,
    required String location,
    required int imageCount,
    double? lat,
    double? lng,
  }) async {
    final ticket = AppConfig.useMocks
        ? await _createMock(
            category: category,
            title: title,
            description: description,
            location: location,
            imageCount: imageCount,
          )
        : FeedbackTicket.fromJson(
            await _api.postJson(
              '/feedback/citizen',
              body: {
                'categoryKey': category.key,
                'title': title,
                'description': description,
                'location': location,
                // Toạ độ chỉ có khi công dân cho phép định vị
                'lat': ?lat,
                'lng': ?lng,
                'channel': kFeedbackChannel,
              },
            ),
          );

    _tickets = [ticket, ..._tickets];
    _loadedOnce = true;
    notifyListeners();
    return ticket;
  }

  /// Công dân đánh giá phiếu đã xử lý xong; trả về phiếu sau khi đánh giá.
  ///
  /// Backend nhận `{rating, ratingComment?}` (KHÔNG phải `comment` — ValidationPipe
  /// bật forbidNonWhitelisted nên tên trường sai sẽ bị từ chối 400) và chỉ mở khi
  /// phiếu ở trạng thái resolved, ngược lại trả 409 kèm thông báo tiếng Việt.
  Future<FeedbackTicket> rate(String code, int stars, String comment) async {
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      final current = byCode(code);
      if (current == null) throw const ApiException('Không tìm thấy phiếu phản ánh');
      final rated = _copyWithRating(current, stars, comment);
      _replace(rated);
      notifyListeners();
      return rated;
    }

    await _api.postJson(
      '/feedback/citizen/mine/${Uri.encodeComponent(code)}/rating',
      body: {
        'rating': stars,
        if (comment.isNotEmpty) 'ratingComment': comment,
      },
    );
    // Lấy lại phiếu để đồng bộ timeline mới do backend ghi thêm khi đánh giá
    final updated = await detail(code);
    notifyListeners();
    return updated;
  }

  /// Thay phiếu cùng mã trong danh sách; chưa có thì thêm vào đầu
  void _replace(FeedbackTicket ticket) {
    final i = _tickets.indexWhere((t) => t.code == ticket.code);
    final next = List.of(_tickets);
    if (i < 0) {
      next.insert(0, ticket);
    } else {
      next[i] = ticket;
    }
    _tickets = next;
  }

  Future<FeedbackTicket> _createMock({
    required FeedbackCategory category,
    required String title,
    required String description,
    required String location,
    required int imageCount,
  }) async {
    await Future<void>.delayed(AppConfig.mockDelay);
    final now = DateTime.now();
    String p(int n) => n.toString().padLeft(2, '0');
    final stamp = '${p(now.day)}/${p(now.month)}/${now.year} ${p(now.hour)}:${p(now.minute)}';
    final ticket = FeedbackTicket(
      code: '#PA-${now.year}-${_seq.toString().padLeft(4, '0')}',
      categoryKey: category.key,
      title: title,
      description: description,
      location: location,
      sentAt: stamp,
      status: TicketStatus.received,
      slaHoursLeft: category.resolveDays * 24,
      imageColors: List.generate(
        imageCount,
        (i) => kImagePlaceholderColors[i % kImagePlaceholderColors.length],
      ),
      timeline: [
        TimelineStep(title: 'Gửi phản ánh qua ứng dụng ViGov', meta: stamp),
        const TimelineStep(
          title: 'Chờ Trung tâm Phục vụ hành chính công phân loại',
          meta: 'Trong giờ hành chính',
          current: true,
        ),
      ],
    );
    _seq += 1;
    return ticket;
  }

  FeedbackTicket _copyWithRating(FeedbackTicket t, int stars, String comment) => FeedbackTicket(
        code: t.code,
        categoryKey: t.categoryKey,
        title: t.title,
        description: t.description,
        location: t.location,
        sentAt: t.sentAt,
        status: t.status,
        slaHoursLeft: t.slaHoursLeft,
        imageColors: t.imageColors,
        timeline: t.timeline,
        rating: stars,
        ratingComment: comment.isEmpty ? null : comment,
      );
}
