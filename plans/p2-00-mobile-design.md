# P2-00 — Thiết kế UI/UX App công dân (Flutter)

> Trạng thái: **done** · Đổi hướng 27/08/2026: mobile dùng **Flutter (Android + iOS)** thay Zalo Mini App theo yêu cầu khách

## Mô tả

Design system Flutter (Material 3 tuỳ biến theo nhận diện ViGov: navy #1B3A5C, hồng #E91E8C), theme sáng, cỡ chữ điều chỉnh được; wireframe 9 màn + luồng điều hướng bottom nav. App chạy Android + iOS từ 1 codebase.

## Kế hoạch thực hiện

- [x] ThemeData tập trung tại `lib/config/theme.dart` — palette đồng bộ Web Quản trị.
- [x] Bottom nav 5 mục: Trang chủ / Phản ánh của tôi / Gửi phản ánh (nút giữa nổi) / Tin tức / Cá nhân; các tiện ích còn lại vào lưới truy cập nhanh ở Trang chủ.
- [x] Wireframe 9 màn triển khai trực tiếp bằng code (mock data) để khách duyệt trên app thật.
