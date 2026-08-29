import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';
import '../models/models.dart';
import 'api_client.dart';

/// Hiệu lực mã OTP mặc định khi backend không trả về (giây)
const int kDefaultOtpExpiresInSeconds = 300;

/// Phiên định danh công dân theo SĐT.
class CitizenSession {
  const CitizenSession({
    required this.phone,
    required this.displayName,
    required this.identifiedAt,
    this.area = '',
  });

  final String phone;
  final String displayName;
  final String identifiedAt;

  /// Thôn/tổ dân phố do backend gán cho tài khoản công dân (có thể rỗng)
  final String area;
}

/// Định danh SĐT + OTP.
///
/// - `AppConfig.useMocks = true`  → chạy offline, chấp nhận mọi mã đủ độ dài.
/// - `AppConfig.useMocks = false` → gọi `/auth/citizen/otp/**` của backend NestJS,
///   lưu accessToken + thông tin công dân bằng shared_preferences và gắn token
///   vào [ApiClient] cho các lời gọi sau.
///
/// Mọi lỗi từ backend ném ra [ApiException] với thông báo tiếng Việt để màn
/// Onboarding hiển thị trực tiếp.
class IdentityService {
  IdentityService({ApiClient? api}) : _api = api ?? ApiClient.instance;

  final ApiClient _api;

  static const _kPhone = 'vigov.session.phone';
  static const _kName = 'vigov.session.name';
  static const _kAt = 'vigov.session.at';
  static const _kArea = 'vigov.session.area';
  static const _kToken = 'vigov.session.token';

  /// Yêu cầu backend gửi mã OTP; trả về số giây mã còn hiệu lực.
  ///
  /// LƯU Ý Phase 1: backend CHƯA gửi SMS/ZNS thật mà chỉ ghi mã ra log máy chủ
  /// (dòng `Mã OTP cho [số điện thoại]: [mã]`). Người kiểm thử lấy mã ở đó.
  Future<int> sendOtp(String phone) async {
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      return kDefaultOtpExpiresInSeconds;
    }
    final res = await _api.postJson(
      '/auth/citizen/otp/request',
      body: {'phone': phone},
      auth: false,
    );
    if (res['sent'] == false) {
      throw const ApiException('Không gửi được mã xác thực, vui lòng thử lại sau.');
    }
    return asInt(res['expiresInSeconds'], kDefaultOtpExpiresInSeconds);
  }

  /// Xác thực OTP và mở phiên. Ném [ApiException] khi mã sai/hết hạn.
  Future<CitizenSession> verifyOtp(String phone, String otp) async {
    if (AppConfig.useMocks) {
      await Future<void>.delayed(AppConfig.mockDelay);
      if (otp.length != AppConfig.otpLength) {
        throw const ApiException('Mã xác thực không đúng, vui lòng kiểm tra lại.');
      }
      return _persist(
        CitizenSession(
          phone: phone,
          displayName: 'Công dân ${phone.substring(phone.length - 3)}',
          identifiedAt: DateTime.now().toIso8601String(),
        ),
        token: null,
      );
    }

    final res = await _api.postJson(
      '/auth/citizen/otp/verify',
      body: {'phone': phone, 'otp': otp, 'device': 'ViGov Flutter'},
      auth: false,
    );

    final token = asString(res['accessToken']);
    if (token.isEmpty) {
      throw const ApiException('Máy chủ không cấp được mã phiên, vui lòng thử lại.');
    }
    final user = res['user'] is Map<String, dynamic>
        ? res['user'] as Map<String, dynamic>
        : const <String, dynamic>{};

    return _persist(
      CitizenSession(
        phone: asString(user['phone'], phone),
        displayName: asString(user['displayName'], 'Công dân'),
        identifiedAt: DateTime.now().toIso8601String(),
        area: asString(user['area']),
      ),
      token: token,
    );
  }

  /// Khôi phục phiên đã lưu khi mở lại app; đồng thời nạp token vào [ApiClient].
  Future<CitizenSession?> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final phone = prefs.getString(_kPhone);
    if (phone == null) return null;

    // Bản thật bắt buộc có token; thiếu token nghĩa là phiên hỏng → coi như chưa định danh
    final token = prefs.getString(_kToken);
    if (!AppConfig.useMocks && (token == null || token.isEmpty)) {
      await clear();
      return null;
    }
    _api.accessToken = token;

    return CitizenSession(
      phone: phone,
      displayName: prefs.getString(_kName) ?? 'Công dân',
      identifiedAt: prefs.getString(_kAt) ?? '',
      area: prefs.getString(_kArea) ?? '',
    );
  }

  Future<void> clear() async {
    _api.accessToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kPhone);
    await prefs.remove(_kName);
    await prefs.remove(_kAt);
    await prefs.remove(_kArea);
    await prefs.remove(_kToken);
  }

  /// Lưu phiên xuống shared_preferences và gắn token vào client HTTP
  Future<CitizenSession> _persist(CitizenSession session, {required String? token}) async {
    _api.accessToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPhone, session.phone);
    await prefs.setString(_kName, session.displayName);
    await prefs.setString(_kAt, session.identifiedAt);
    await prefs.setString(_kArea, session.area);
    if (token == null) {
      await prefs.remove(_kToken);
    } else {
      await prefs.setString(_kToken, token);
    }
    return session;
  }
}
