/// Adapter gọi điện / nhắn tin — Phase 1 mock (UI hiển thị SnackBar).
/// Tích hợp ngoài: thay bằng url_launcher (tel:, sms:), giữ nguyên chữ ký.
class CallService {
  Future<bool> call(String phone) async => true;

  Future<bool> message(String phone) async => true;
}
