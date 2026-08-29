import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

/// Thời gian chờ tối đa một lời gọi API trước khi báo lỗi mạng.
const Duration kApiTimeout = Duration(seconds: 20);

/// Mã HTTP hết hạn / thiếu phiên đăng nhập.
const int kHttpUnauthorized = 401;

/// Thông báo mặc định khi backend không trả nội dung lỗi đọc được.
const String kDefaultErrorMessage = 'Không kết nối được máy chủ, vui lòng thử lại';

/// Lỗi trả về từ API — [message] LUÔN là tiếng Việt để hiển thị thẳng lên màn hình.
class ApiException implements Exception {
  const ApiException(this.message, [this.statusCode]);

  final String message;

  /// null khi lỗi xảy ra trước lúc nhận được phản hồi (mất mạng, quá hạn chờ)
  final int? statusCode;

  /// Phiên đăng nhập hết hạn — app phải đưa công dân về màn định danh
  bool get isUnauthorized => statusCode == kHttpUnauthorized;

  @override
  String toString() => message;
}

/// Client HTTP dùng chung cho mọi lời gọi backend NestJS.
///
/// - Base URL đọc từ [AppConfig.apiBaseUrl] (`--dart-define=API_BASE_URL=...`),
///   KHÔNG hardcode để chạy được trên máy ảo (10.0.2.2) lẫn thiết bị thật.
/// - Tự gắn `Authorization: Bearer` khi đã có token.
/// - Giải mã JSON theo UTF-8 để không vỡ dấu tiếng Việt.
/// - Gặp 401 thì xoá token và báo cho [onUnauthorized] (SessionController đăng ký).
class ApiClient {
  ApiClient({http.Client? httpClient}) : _http = httpClient ?? http.Client();

  /// Thể hiện dùng chung toàn app — các service mặc định lấy thể hiện này.
  static final ApiClient instance = ApiClient();

  final http.Client _http;

  /// JWT của công dân đang đăng nhập; null = chưa định danh
  String? accessToken;

  /// Được gọi khi backend trả 401 — SessionController dùng để xoá phiên
  void Function()? onUnauthorized;

  bool get hasToken => (accessToken ?? '').isNotEmpty;

  /// GET trả về đối tượng JSON
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
    bool auth = true,
  }) async {
    return _send(() => _http.get(_uri(path, query), headers: _headers(auth: auth)));
  }

  /// POST body JSON, trả về đối tượng JSON
  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send(
      () => _http.post(
        _uri(path),
        headers: _headers(auth: auth, json: true),
        body: jsonEncode(body ?? const <String, dynamic>{}),
      ),
    );
  }

  /// Ghép base URL + đường dẫn + tham số truy vấn.
  /// [path] đã được encode sẵn ở nơi gọi khi chứa ký tự đặc biệt (ví dụ mã phiếu có '#').
  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final base = AppConfig.apiBaseUrl.endsWith('/')
        ? AppConfig.apiBaseUrl.substring(0, AppConfig.apiBaseUrl.length - 1)
        : AppConfig.apiBaseUrl;
    final suffix = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$base$suffix');
    if (query == null || query.isEmpty) return uri;
    // Bỏ tham số rỗng để không gửi ?type= lên backend (class-validator sẽ từ chối)
    final params = <String, String>{
      for (final e in query.entries)
        if (e.value != null && '${e.value}'.isNotEmpty) e.key: '${e.value}',
    };
    return uri.replace(queryParameters: {...uri.queryParameters, ...params});
  }

  Map<String, String> _headers({required bool auth, bool json = false}) {
    return {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json; charset=utf-8',
      if (auth && hasToken) 'Authorization': 'Bearer $accessToken',
    };
  }

  /// Gửi yêu cầu, quy mọi sự cố về [ApiException] có thông báo tiếng Việt.
  Future<Map<String, dynamic>> _send(Future<http.Response> Function() request) async {
    http.Response res;
    try {
      res = await request().timeout(kApiTimeout);
    } on SocketException {
      throw const ApiException(
        'Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.',
      );
    } on TimeoutException {
      throw const ApiException('Máy chủ phản hồi quá lâu, vui lòng thử lại.');
    } on http.ClientException catch (e) {
      throw ApiException('Lỗi kết nối: ${e.message}');
    }

    // Giải mã UTF-8 thủ công: http mặc định latin-1 khi thiếu charset trong header
    final decoded = _decodeBody(res.bodyBytes);

    if (res.statusCode == kHttpUnauthorized) {
      accessToken = null;
      onUnauthorized?.call();
      throw ApiException(
        _messageOf(decoded) ?? 'Phiên đăng nhập đã hết hạn, vui lòng định danh lại.',
        res.statusCode,
      );
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_messageOf(decoded) ?? kDefaultErrorMessage, res.statusCode);
    }
    if (decoded is Map<String, dynamic>) return decoded;
    // Endpoint trả mảng trần — bọc lại để nơi gọi vẫn đọc bằng khoá 'items'
    if (decoded is List) return {'items': decoded};
    return const <String, dynamic>{};
  }

  Object? _decodeBody(List<int> bytes) {
    if (bytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(bytes));
    } on FormatException {
      return null;
    }
  }

  /// Lấy thông báo lỗi tiếng Việt từ thân phản hồi NestJS.
  /// `message` có thể là chuỗi hoặc mảng (lỗi class-validator) — gộp mảng bằng xuống dòng.
  String? _messageOf(Object? decoded) {
    if (decoded is! Map<String, dynamic>) return null;
    final message = decoded['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) {
      return message.map((e) => '$e').join('\n');
    }
    final error = decoded['error'];
    return error is String && error.isNotEmpty ? error : null;
  }
}
