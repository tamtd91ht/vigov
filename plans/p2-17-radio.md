# P2-17 — Mobile — Truyền thanh phường

> Trạng thái: **done** · Đổi hướng 27/08/2026: mobile dùng **Flutter (Android + iOS)** thay Zalo Mini App theo yêu cầu khách

## Mô tả

Danh sách bản tin theo ngày, lọc chuyên mục; audio player sticky toàn app: play/pause, thanh tua, ±15s, tốc độ 1x/1.5x/2x, giữ phát khi chuyển màn (controller mock, just_audio thật ở tích hợp ngoài).

## Kế hoạch thực hiện

- [x] RadioPlayerController (ChangeNotifier) toàn cục — mini player gắn ở shell.
- [x] Điều khiển đầy đủ trên cả mini player lẫn màn chi tiết.
