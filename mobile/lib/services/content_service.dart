import '../config/app_config.dart';
import '../mocks/news_mock.dart';
import '../mocks/radio_mock.dart';
import '../mocks/video_mock.dart';
import '../models/models.dart';
import 'api_client.dart';

/// Số bản ghi tải mỗi lần cho các danh sách nội dung công khai
/// (backend giới hạn tối đa 50 bản ghi/lần với nhóm /public).
const int kContentPageSize = 50;

/// Nội dung công khai cho app công dân — tin tức, video, truyền thanh.
///
/// Nhóm `/content/public/*` KHÔNG cần token nên đọc được cả khi chưa định danh.
/// Kết quả được nhớ tạm trong bộ nhớ để màn chi tiết dựng "tin/video liên quan"
/// mà không phải gọi lại backend (backend chưa có endpoint chi tiết cho video).
class ContentService {
  ContentService({ApiClient? api}) : _api = api ?? ApiClient.instance;

  final ApiClient _api;

  final Map<ArticleType, List<Article>> _articles = {};
  List<VideoItem>? _videos;
  List<RadioBulletin>? _radio;

  // --------------------------------------------------------------- Bài viết

  /// Bài viết đã phát hành theo loại (Tin tức / Sự kiện / Thông báo)
  Future<List<Article>> articles(ArticleType type, {bool refresh = false}) async {
    final cached = _articles[type];
    if (!refresh && cached != null) return cached;

    late final List<Article> items;
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      items = mockArticles.where((a) => a.type == type).toList();
    } else {
      final res = await _api.getJson(
        '/content/public/articles',
        query: {'type': type.apiValue, 'page': 1, 'limit': kContentPageSize},
        auth: false,
      );
      items = asItems(res).map(Article.fromJson).toList();
    }
    _articles[type] = items;
    return items;
  }

  /// Chi tiết bài viết — backend tự tăng lượt xem mỗi lần mở.
  /// Danh sách dùng projection `-content` nên PHẢI gọi endpoint này để có nội dung.
  Future<Article> articleDetail(String id) async {
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      final matches = mockArticles.where((a) => a.id == id);
      if (matches.isEmpty) throw const ApiException('Không tìm thấy bài viết');
      return matches.first;
    }
    final res = await _api.getJson('/content/public/articles/$id', auth: false);
    return Article.fromJson(res);
  }

  /// Bài viết cùng loại để dựng khối "Tin liên quan"
  Future<List<Article>> relatedArticles(Article article, int count) async {
    final list = await articles(article.type);
    return list.where((a) => a.id != article.id).take(count).toList();
  }

  /// Bài viết mới nhất cho khối "Tin tức mới" ở Trang chủ (không lọc theo loại)
  Future<List<Article>> latestArticles(int count) async {
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      return mockArticles.take(count).toList();
    }
    final res = await _api.getJson(
      '/content/public/articles',
      query: {'page': 1, 'limit': count},
      auth: false,
    );
    return asItems(res).map(Article.fromJson).toList();
  }

  // ------------------------------------------------------------------ Video

  Future<List<VideoItem>> videos({bool refresh = false}) async {
    final cached = _videos;
    if (!refresh && cached != null) return cached;

    late final List<VideoItem> items;
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      items = List.of(mockVideos);
    } else {
      final res = await _api.getJson(
        '/content/public/videos',
        query: {'page': 1, 'limit': kContentPageSize},
        auth: false,
      );
      items = asItems(res).map(VideoItem.fromJson).toList();
    }
    _videos = items;
    return items;
  }

  /// Chi tiết video — backend chưa có endpoint riêng nên lấy từ danh sách đã tải
  Future<VideoItem> videoDetail(String id) async {
    final list = await videos();
    final matches = list.where((v) => v.id == id);
    if (matches.isEmpty) throw const ApiException('Không tìm thấy video');
    return matches.first;
  }

  /// Video cùng chuyên mục để dựng khối "Video liên quan"
  Future<List<VideoItem>> relatedVideos(VideoItem video, int count) async {
    final list = await videos();
    return list.where((v) => v.topic == video.topic && v.id != video.id).take(count).toList();
  }

  // ------------------------------------------------------------ Truyền thanh

  Future<List<RadioBulletin>> radio({bool refresh = false}) async {
    final cached = _radio;
    if (!refresh && cached != null) return cached;

    late final List<RadioBulletin> items;
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      items = List.of(mockRadioBulletins);
    } else {
      final res = await _api.getJson(
        '/content/public/radio',
        query: {'page': 1, 'limit': kContentPageSize},
        auth: false,
      );
      items = asItems(res).map(RadioBulletin.fromJson).toList();
    }
    _radio = items;
    return items;
  }
}

/// Danh sách chuyên mục rút ra từ dữ liệu đã tải — thay cho hằng số trong lib/mocks
/// để hàng chip lọc luôn khớp nội dung backend đang phát hành.
List<String> distinctLabels(Iterable<String> values) {
  final seen = <String>[];
  for (final v in values) {
    final label = v.trim();
    if (label.isNotEmpty && !seen.contains(label)) seen.add(label);
  }
  return seen;
}
