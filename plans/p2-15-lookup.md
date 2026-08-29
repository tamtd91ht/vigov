# P2-15 — Mobile — Tra cứu Hồ sơ

> Trạng thái: **done** · Đổi hướng 27/08/2026: mobile dùng **Flutter (Android + iOS)** thay Zalo Mini App theo yêu cầu khách

## Mô tả

Nhập mã hồ sơ + quét QR (adapter mock, plugin camera thật ở tích hợp ngoài); kết quả: thủ tục, người nộp, trạng thái, cán bộ phụ trách, tracker 4 bước; lưu & hiển thị lịch sử tra cứu (shared_preferences).

## Kế hoạch thực hiện

- [x] QrService adapter mock.
- [x] Tracker 4 bước dùng chung phong cách TimelineWidget.
- [x] Nguồn dữ liệu hồ sơ một cửa chờ khách (câu hỏi mở #18).
