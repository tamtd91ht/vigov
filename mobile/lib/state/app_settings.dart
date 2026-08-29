import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Mức cỡ chữ toàn app (WBS #20) — danh sách cấu hình, không hardcode trong màn hình.
class FontScaleOption {
  const FontScaleOption(this.key, this.label, this.scale);

  final String key;
  final String label;
  final double scale;
}

const List<FontScaleOption> fontScaleOptions = [
  FontScaleOption('normal', 'Chuẩn', 1.0),
  FontScaleOption('large', 'Lớn', 1.15),
  FontScaleOption('xlarge', 'Rất lớn', 1.3),
];

/// Cài đặt người dùng: cỡ chữ + nhận thông báo — persist bằng shared_preferences.
class AppSettings extends ChangeNotifier {
  static const _kFont = 'vigov.settings.fontScale';
  static const _kNotify = 'vigov.settings.notifications';

  FontScaleOption _font = fontScaleOptions.first;
  bool _notificationsEnabled = true;

  FontScaleOption get font => _font;
  double get fontScale => _font.scale;
  bool get notificationsEnabled => _notificationsEnabled;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final key = prefs.getString(_kFont);
    _font = fontScaleOptions.firstWhere((o) => o.key == key, orElse: () => fontScaleOptions.first);
    _notificationsEnabled = prefs.getBool(_kNotify) ?? true;
    notifyListeners();
  }

  Future<void> setFont(FontScaleOption option) async {
    _font = option;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kFont, option.key);
  }

  Future<void> setNotifications(bool enabled) async {
    // Đăng ký/huỷ token FCM/APNs thật thực hiện ở P3 Notification (#23)
    _notificationsEnabled = enabled;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kNotify, enabled);
  }
}
