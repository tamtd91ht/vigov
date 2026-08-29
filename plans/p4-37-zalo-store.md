# P4-37 — Triển khai — Phát hành Google Play, App Store & Zalo Mini App Store

> Trạng thái: **pending** · Cập nhật 27/08/2026: phát hành 3 kênh (Google Play + App Store + Zalo Mini App Store)

## Mô tả

Chuẩn bị hồ sơ, ký ứng dụng (keystore Android, chứng chỉ iOS + tài khoản Apple Developer của khách), nộp kiểm duyệt Google Play, App Store và Zalo Mini App Store; xử lý feedback kiểm duyệt của cả 3 kênh. Lead time review ngoài tầm kiểm soát — nộp ngay khi code-complete.

## Kế hoạch thực hiện

- [ ] Khách cung cấp tài khoản Google Play Console, Apple Developer, Zalo Developers/OA.
- [ ] Cấu hình icon, splash, quyền (camera/GPS/notification) kèm mô tả mục đích cho từng kênh.
- [ ] Ký app: keystore Android, provisioning iOS; build release qua CI (P4-34).
- [ ] Nộp kiểm duyệt 3 kênh, theo dõi và xử lý feedback.
