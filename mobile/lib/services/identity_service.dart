import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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

  /*
   * KHO LƯU AN TOÀN — Keychain (iOS) / EncryptedSharedPreferences (Android).
   *
   * VÌ SAO KHÔNG DÙNG shared_preferences NỮA (SECURITY.md T-06): dữ liệu ở đó
   * nằm dạng RÕ trong sandbox ứng dụng. Trên máy đã root/jailbreak, hoặc qua
   * bản sao lưu thiết bị, ai đọc được tệp đó là lấy nguyên access token và
   * refresh token — đủ để dùng tài khoản công dân trong 8 giờ (và làm mới tiếp
   * bằng refresh token). Số điện thoại lưu kèm cũng là dữ liệu cá nhân theo
   * NĐ 13/2023.
   *
   * Dữ liệu phiên của bản cũ vẫn còn trong shared_preferences nên `restore()`
   * chuyển một lần sang kho mới rồi xoá sạch bản cũ — người dùng đang đăng nhập
   * không bị đá ra khi cập nhật app.
   */
  static const _secure = FlutterSecureStorage(
    /* Android: bản 11 của gói LUÔN mã hoá (AES/GCM, khoá trong KeyStore) nên
       không còn cờ `encryptedSharedPreferences` như các bản trước — để mặc định.
       iOS: `first_unlock` cho phép đọc sau lần mở khoá đầu tiên kể từ khi khởi
       động máy; chặt hơn (`unlocked`) sẽ làm app không khôi phục được phiên khi
       chạy nền. */
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _kPhone = 'vigov.session.phone';
  static const _kName = 'vigov.session.name';
  static const _kAt = 'vigov.session.at';
  static const _kArea = 'vigov.session.area';
  static const _kToken = 'vigov.session.token';
  static const _kRefreshToken = 'vigov.session.refreshToken';

  /// Toàn bộ khoá của một phiên — dùng chung cho di trú và xoá, để không sót khoá nào
  static const _sessionKeys = <String>[
    _kPhone,
    _kName,
    _kAt,
    _kArea,
    _kToken,
    _kRefreshToken,
  ];

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
        refreshToken: null,
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
    /* Backend cũ (trước T-09) không trả refreshToken — phiên vẫn dùng được,
       chỉ là hết 8 giờ thì phải định danh lại như cũ. */
    final refreshToken = asString(res['refreshToken']);
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
      refreshToken: refreshToken.isEmpty ? null : refreshToken,
    );
  }

  /// Khôi phục phiên đã lưu khi mở lại app; đồng thời nạp token vào [ApiClient].
  Future<CitizenSession?> restore() async {
    await _migrateLegacySession();

    final phone = await _secure.read(key: _kPhone);
    if (phone == null) return null;

    // Bản thật bắt buộc có token; thiếu token nghĩa là phiên hỏng → coi như chưa định danh
    final token = await _secure.read(key: _kToken);
    if (!AppConfig.useMocks && (token == null || token.isEmpty)) {
      await clear();
      return null;
    }
    _api.accessToken = token;
    _api.refreshToken = await _secure.read(key: _kRefreshToken);

    return CitizenSession(
      phone: phone,
      displayName: await _secure.read(key: _kName) ?? 'Công dân',
      identifiedAt: await _secure.read(key: _kAt) ?? '',
      area: await _secure.read(key: _kArea) ?? '',
    );
  }

  /// Chuyển phiên của bản cũ từ shared_preferences sang kho an toàn, một lần.
  ///
  /// Chạy trước mọi lần đọc: người đang đăng nhập bằng bản cũ cập nhật app lên
  /// bản này thì phiên đi theo, không bị đá về màn định danh. Sau khi chuyển,
  /// bản ghi cũ bị XOÁ — để lại thì token vẫn nằm dạng rõ trên máy.
  Future<void> _migrateLegacySession() async {
    final prefs = await SharedPreferences.getInstance();
    final legacyPhone = prefs.getString(_kPhone);
    if (legacyPhone == null) return;

    for (final key in _sessionKeys) {
      final value = prefs.getString(key);
      if (value != null && value.isNotEmpty) {
        await _secure.write(key: key, value: value);
      }
      await prefs.remove(key);
    }
  }

  Future<void> clear() async {
    _api.accessToken = null;
    _api.refreshToken = null;
    for (final key in _sessionKeys) {
      await _secure.delete(key: key);
    }
  }

  /// Lưu phiên vào kho an toàn của hệ điều hành và gắn token vào client HTTP
  Future<CitizenSession> _persist(
    CitizenSession session, {
    required String? token,
    required String? refreshToken,
  }) async {
    _api.accessToken = token;
    _api.refreshToken = refreshToken;
    await _secure.write(key: _kPhone, value: session.phone);
    await _secure.write(key: _kName, value: session.displayName);
    await _secure.write(key: _kAt, value: session.identifiedAt);
    await _secure.write(key: _kArea, value: session.area);
    await _writeOrDelete(_kToken, token);
    await _writeOrDelete(_kRefreshToken, refreshToken);
    return session;
  }

  /// Ghi giá trị, hoặc XOÁ hẳn khoá khi giá trị rỗng — không để lại token cũ
  Future<void> _writeOrDelete(String key, String? value) async {
    if (value == null || value.isEmpty) {
      await _secure.delete(key: key);
    } else {
      await _secure.write(key: key, value: value);
    }
  }
}
