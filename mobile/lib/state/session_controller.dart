import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/api_client.dart';
import '../services/identity_service.dart';

/// Trạng thái phiên định danh toàn app — router đọc để gate onboarding.
class SessionController extends ChangeNotifier {
  SessionController(this._identity, {ApiClient? api}) {
    // Backend trả 401 (token hết hạn) ở BẤT KỲ lời gọi nào → đóng phiên,
    // router tự đẩy công dân về màn định danh.
    (api ?? ApiClient.instance).onUnauthorized = _onUnauthorized;
  }

  final IdentityService _identity;

  /// Được gọi mỗi khi phiên đóng (đăng xuất hoặc token hết hạn) — main.dart
  /// đăng ký để xoá dữ liệu công dân đang giữ trong bộ nhớ.
  void Function()? onSignedOut;

  CitizenSession? _session;
  bool _loaded = false;

  CitizenSession? get session => _session;
  bool get loaded => _loaded;
  bool get identified => _session != null;

  Future<void> restore() async {
    _session = await _identity.restore();
    _loaded = true;
    notifyListeners();
  }

  /// Yêu cầu mã OTP; ném [ApiException] để màn hình hiển thị thông báo của backend.
  Future<int> sendOtp(String phone) => _identity.sendOtp(phone);

  /// Xác thực OTP; ném [ApiException] khi mã sai hoặc hết hạn.
  Future<void> verifyOtp(String phone, String otp) async {
    _session = await _identity.verifyOtp(phone, otp);
    notifyListeners();
  }

  Future<void> logout() async {
    await _identity.clear();
    _session = null;
    onSignedOut?.call();
    notifyListeners();
  }

  /// Xoá phiên khi token hết hạn — không await được trong callback nên chạy nền
  void _onUnauthorized() {
    if (_session == null) return;
    _session = null;
    onSignedOut?.call();
    notifyListeners();
    unawaited(_identity.clear().catchError((Object _) {}));
  }
}
