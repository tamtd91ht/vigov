# P2-20 — Mobile — Cá nhân & Cài đặt

> Trạng thái: **done** · Đổi hướng 27/08/2026: mobile dùng **Flutter (Android + iOS)** thay Zalo Mini App theo yêu cầu khách

## Mô tả

Cỡ chữ lớn áp dụng toàn app (textScaleFactor qua provider, lưu shared_preferences), toggle nhận thông báo đẩy, thông tin định danh, lối tắt Phản ánh của tôi + lịch sử tra cứu, đăng xuất.

## Kế hoạch thực hiện

- [x] AppSettings ChangeNotifier có sẵn ở foundation — màn này chỉnh và persist.
- [x] 3 mức cỡ chữ: Chuẩn/Lớn/Rất lớn từ config.
