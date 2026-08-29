# P3-23 — Backend — Notification (ZNS + push + in-app)

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #23 — Service thông báo hợp nhất: ZNS Zalo, push Mini App, in-app web. Template + hàng đợi RabbitMQ + retry. Kết nối ZNS thật thuộc hệ số tích hợp ngoài.

## Kế hoạch thực hiện

- [x] Notification service consume event từ các phân hệ.
- [x] Template ZNS chờ Zalo duyệt (lead time — nộp sớm tuần 1).
- [x] Adapter pattern: ZnsProvider / PushProvider / InAppProvider.
