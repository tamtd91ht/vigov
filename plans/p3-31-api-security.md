# P3-31 — Backend — Bảo mật API

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #31 — Encryption, blacklist token/thiết bị, rate-limit, chống spam phản ánh.

## Kế hoạch thực hiện

- [x] Rate-limit theo IP+user; blacklist đồng bộ trang P1-11.
- [x] Chống spam: giới hạn phản ánh/ngày/công dân theo config; helmet + validation toàn cục.
