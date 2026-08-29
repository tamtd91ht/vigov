# P1-11 — User Mini App & Bảo mật

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #11 (chưa có mockup) — Danh sách công dân dùng Mini App (khoá/mở tài khoản), 2 danh sách phiên đăng nhập (cán bộ web / công dân miniapp), lịch sử blacklist.

## Kế hoạch thực hiện

- [x] Route `/users`. Tuân thủ design system hiện có.
- [x] Tab Công dân: bảng (SĐT che số, tên Zalo, thôn/tổ, số phản ánh đã gửi, trạng thái, ngày đăng ký) + khoá/mở + lý do.
- [x] Tab Phiên đăng nhập: 2 bảng (web cán bộ / miniapp công dân): thiết bị, IP, thời gian, nút thu hồi phiên.
- [x] Tab Blacklist: lịch sử khoá (ai khoá, lý do, thời điểm, trạng thái hiện tại).
- [x] Câu hỏi mở #15: quyền khoá/mở trực tiếp + ai xem blacklist — chờ khách.
