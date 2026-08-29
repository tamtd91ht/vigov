/// Cấu hình cấp ứng dụng — điểm tập trung duy nhất đọc biến build.
/// Truyền giá trị khi build bằng --dart-define, ví dụ:
///   flutter build apk --dart-define=API_BASE_URL=https://api.vigov.vn/api/v1 --dart-define=USE_MOCKS=false
class AppConfig {
  AppConfig._();

  static const String appName = 'ViGov';
  static const String appTagline = 'Điều hành số cấp xã';

  /// Đơn vị hành chính đang vận hành (đa tenant sau này lấy từ API)
  static const String orgName = String.fromEnvironment('ORG_NAME', defaultValue: 'Xã Đại Thắng');
  static const String orgParent =
      String.fromEnvironment('ORG_PARENT', defaultValue: 'Huyện Phú Xuyên · Thành phố Hà Nội');

  static const String apiBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3001/api/v1');

  /// true = dùng dữ liệu mock trong lib/mocks thay vì gọi backend (P3)
  static const bool useMocks = bool.fromEnvironment('USE_MOCKS', defaultValue: true);

  /// Độ trễ giả lập khi dùng mock — để UI thể hiện trạng thái tải
  static const Duration mockDelay = Duration(milliseconds: 350);

  /// Tổng đài hỗ trợ hiển thị ở màn Cá nhân / lỗi định danh
  static const String hotline = String.fromEnvironment('HOTLINE', defaultValue: '024 3378 2200');

  /// Số ảnh tối đa đính kèm một phản ánh (WBS #13)
  static const int maxFeedbackImages = 3;

  /// Độ dài OTP định danh SĐT
  static const int otpLength = 6;
}
