import 'package:flutter/material.dart';

import '../config/theme.dart';

/// ===== Model nghiệp vụ dùng chung — tên field khớp schema backend P3 =====

// ---------------------------------------------------------------------------
// Tiện ích đọc JSON — backend trả về Map<String, dynamic> động
// ---------------------------------------------------------------------------

/// Đọc chuỗi an toàn; thiếu khoá hoặc null → [fallback]
String asString(Object? value, [String fallback = '']) =>
    value == null ? fallback : '$value';

/// Đọc số nguyên an toàn (backend có thể trả double, ví dụ slaHoursLeft = 71.5)
int asInt(Object? value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

/// Đọc danh sách con trong phản hồi phân trang `{items, total, page, limit}`
List<Map<String, dynamic>> asItems(Map<String, dynamic> json) {
  final items = json['items'];
  if (items is! List) return const [];
  return items.whereType<Map<String, dynamic>>().toList();
}

/// Đổi token màu của CMS (`var(--blue)`) sang màu trong bảng màu ViGov.
/// Web Quản trị lưu màu bìa dạng biến CSS nên app phải ánh xạ lại.
Color colorFromToken(Object? token, [Color fallback = AppColors.blue]) {
  final raw = asString(token).trim();
  if (raw.isEmpty) return fallback;
  // Chấp nhận cả mã hex trực tiếp (#RRGGBB) phòng khi CMS đổi cách lưu
  if (raw.startsWith('#')) {
    final hex = int.tryParse(raw.substring(1), radix: 16);
    if (hex != null) return Color(raw.length == 7 ? 0xFF000000 | hex : hex);
  }
  final name = RegExp(r'--([a-z0-9-]+)').firstMatch(raw)?.group(1) ?? raw;
  return const {
        'navy': AppColors.navy,
        'blue': AppColors.blue,
        'pink': AppColors.pink,
        'green': AppColors.green,
        'orange': AppColors.orange,
        'purple': AppColors.purple,
        'red': AppColors.red,
        'teal': AppColors.teal,
        'slate': AppColors.slate,
      }[name] ??
      fallback;
}

/// Màu placeholder cho ảnh hiện trường — ảnh thật lấy qua module Files (P3-24)
const List<Color> kImagePlaceholderColors = [AppColors.blue, AppColors.teal, AppColors.slate];

/// Bước trong timeline xử lý / luân chuyển
class TimelineStep {
  const TimelineStep({required this.title, required this.meta, this.current = false});

  /// Backend lưu `state`: 'ok' = đã xong, 'cur' = đang ở bước này
  factory TimelineStep.fromJson(Map<String, dynamic> json) => TimelineStep(
        title: asString(json['title']),
        meta: asString(json['meta']),
        current: asString(json['state']) == 'cur',
      );

  final String title;
  final String meta;
  final bool current;
}

enum TicketStatus { received, processing, resolved }

/// Đổi chuỗi trạng thái của backend ('received' | 'processing' | 'resolved') sang enum
TicketStatus ticketStatusFromApi(Object? value) => switch (asString(value)) {
      'processing' => TicketStatus.processing,
      'resolved' => TicketStatus.resolved,
      _ => TicketStatus.received,
    };

extension TicketStatusX on TicketStatus {
  String get label => switch (this) {
        TicketStatus.received => 'Mới tiếp nhận',
        TicketStatus.processing => 'Đang xử lý',
        TicketStatus.resolved => 'Đã xử lý',
      };
}

/// Phiếu phản ánh của công dân
class FeedbackTicket {
  const FeedbackTicket({
    required this.code,
    required this.categoryKey,
    required this.title,
    required this.description,
    required this.location,
    required this.sentAt,
    required this.status,
    required this.slaHoursLeft,
    required this.imageColors,
    required this.timeline,
    this.rating = 0,
    this.ratingComment,
  });

  /// Dựng phiếu từ phản hồi `/feedback/citizen/**`.
  /// Ảnh hiện trường mới chỉ có danh sách id tệp → tạm hiển thị bằng màu placeholder.
  factory FeedbackTicket.fromJson(Map<String, dynamic> json) {
    final imageIds = json['imageFileIds'];
    final imageCount = imageIds is List ? imageIds.length : 0;
    final timeline = json['timeline'];

    return FeedbackTicket(
      code: asString(json['code']),
      categoryKey: asString(json['categoryKey']),
      title: asString(json['title']),
      description: asString(json['description']),
      location: asString(json['location']),
      sentAt: asString(json['sentAt']),
      status: ticketStatusFromApi(json['status']),
      slaHoursLeft: asInt(json['slaHoursLeft']),
      imageColors: List.generate(
        imageCount,
        (i) => kImagePlaceholderColors[i % kImagePlaceholderColors.length],
      ),
      timeline: timeline is List
          ? timeline.whereType<Map<String, dynamic>>().map(TimelineStep.fromJson).toList()
          : const [],
      rating: asInt(json['rating']),
      ratingComment: asString(json['ratingComment']).isEmpty
          ? null
          : asString(json['ratingComment']),
    );
  }

  final String code;
  final String categoryKey;
  final String title;
  final String description;
  final String location;
  final String sentAt;
  final TicketStatus status;

  /// Giờ còn lại theo SLA; âm = quá hạn; bỏ qua khi đã xử lý
  final int slaHoursLeft;

  /// Ảnh hiện trường — Phase 1 mock bằng màu placeholder
  final List<Color> imageColors;
  final List<TimelineStep> timeline;
  final int rating;
  final String? ratingComment;
}

enum ArticleType { news, event, notice }

extension ArticleTypeX on ArticleType {
  String get label => switch (this) {
        ArticleType.news => 'Tin tức',
        ArticleType.event => 'Sự kiện',
        ArticleType.notice => 'Thông báo',
      };

  /// Giá trị gửi lên `?type=` của `/content/public/articles`
  String get apiValue => name;
}

/// Đổi chuỗi loại bài viết của backend ('news' | 'event' | 'notice') sang enum
ArticleType articleTypeFromApi(Object? value) => switch (asString(value)) {
      'event' => ArticleType.event,
      'notice' => ArticleType.notice,
      _ => ArticleType.news,
    };

/// Bài viết từ CMS (đồng bộ CmsArticle của admin-web)
class Article {
  const Article({
    required this.id,
    required this.type,
    required this.title,
    required this.category,
    required this.excerpt,
    required this.content,
    required this.coverColor,
    required this.publishedAt,
    required this.views,
  });

  /// Dựng bài viết từ `/content/public/articles`.
  /// Danh sách dùng projection `-content` nên [content] rỗng cho tới khi mở chi tiết.
  factory Article.fromJson(Map<String, dynamic> json) => Article(
        id: asString(json['_id'] ?? json['id']),
        type: articleTypeFromApi(json['type']),
        title: asString(json['title']),
        category: asString(json['category']),
        excerpt: asString(json['excerpt']),
        content: asString(json['content']),
        coverColor: colorFromToken(json['coverColor']),
        publishedAt: asString(json['publishedAt']),
        views: asInt(json['views']),
      );

  final String id;
  final ArticleType type;
  final String title;
  final String category;
  final String excerpt;

  /// Nội dung thuần — các đoạn cách nhau bằng \n\n
  final String content;
  final Color coverColor;
  final String publishedAt;
  final int views;
}

/// Video tuyên truyền
class VideoItem {
  const VideoItem({
    required this.id,
    required this.title,
    required this.topic,
    required this.duration,
    required this.views,
    required this.publishedAt,
    required this.coverColor,
    this.description = '',
  });

  /// Dựng video từ `/content/public/videos`.
  /// Schema CMS chưa có trường mô tả nên [description] rỗng — màn chi tiết tự ẩn khối này.
  factory VideoItem.fromJson(Map<String, dynamic> json) => VideoItem(
        id: asString(json['_id'] ?? json['id']),
        title: asString(json['title']),
        topic: asString(json['topic']),
        duration: asString(json['duration']),
        views: asInt(json['views']),
        publishedAt: asString(json['publishedAt']),
        coverColor: colorFromToken(json['coverColor']),
      );

  final String id;
  final String title;
  final String topic;
  final String duration;
  final int views;
  final String publishedAt;
  final Color coverColor;
  final String description;
}

/// Bản tin truyền thanh
class RadioBulletin {
  const RadioBulletin({
    required this.id,
    required this.title,
    required this.category,
    required this.date,
    required this.durationSeconds,
    required this.plays,
  });

  /// Dựng bản tin từ `/content/public/radio`
  factory RadioBulletin.fromJson(Map<String, dynamic> json) => RadioBulletin(
        id: asString(json['_id'] ?? json['id']),
        title: asString(json['title']),
        category: asString(json['category']),
        date: asString(json['date']),
        durationSeconds: asInt(json['durationSeconds']),
        plays: asInt(json['plays']),
      );

  final String id;
  final String title;
  final String category;

  /// dd/MM/yyyy — dùng nhóm danh sách theo ngày
  final String date;
  final int durationSeconds;
  final int plays;
}

/// Kết quả tra cứu hồ sơ một cửa (tracker 4 bước — WBS #15)
class DossierResult {
  const DossierResult({
    required this.code,
    required this.procedure,
    required this.applicant,
    required this.statusLabel,
    required this.officer,
    required this.currentStep,
    required this.steps,
    required this.submittedAt,
    required this.expectedAt,
  });

  final String code;
  final String procedure;
  final String applicant;
  final String statusLabel;
  final String officer;

  /// 1-based, 1..steps.length
  final int currentStep;
  final List<String> steps;
  final String submittedAt;
  final String expectedAt;
}

enum ContactGroup { leader, department }

/// Liên hệ danh bạ chính quyền
class GovContact {
  const GovContact({
    required this.name,
    required this.title,
    required this.department,
    required this.phone,
    required this.group,
  });

  final String name;
  final String title;
  final String department;
  final String phone;
  final ContactGroup group;

  /// Dựng từ JSON của GET /catalogs/public/directory.
  /// Nhóm lạ (ví dụ 'emergency' backend thêm sau) xếp vào `department` để danh
  /// bạ vẫn hiển thị đủ thay vì rơi mất bản ghi.
  factory GovContact.fromJson(Map<String, dynamic> json) => GovContact(
        name: json['name'] as String? ?? '',
        title: json['title'] as String? ?? '',
        department: json['department'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        group: json['group'] == 'leader'
            ? ContactGroup.leader
            : ContactGroup.department,
      );
}
