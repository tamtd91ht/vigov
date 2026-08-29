import '../../config/app_config.dart';

/// Adapter quét QR — Phase 1 mock trả về mã hồ sơ mẫu.
/// Tích hợp ngoài: thay bằng mobile_scanner (camera thật), giữ nguyên chữ ký.
class QrService {
  Future<String?> scan() async {
    await Future<void>.delayed(AppConfig.mockDelay);
    return 'HS-2026-04182'; // khớp mock hồ sơ trong lib/mocks
  }
}
