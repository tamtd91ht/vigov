# P0-02 — Đăng nhập & khung phân quyền RBAC (admin-web)

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

Trang đăng nhập cán bộ + khung RBAC phía FE: định nghĩa vai trò (Quản trị hệ thống, Lãnh đạo phê duyệt, Chuyên viên xử lý, Kế toán – giải ngân, Tiếp nhận một cửa), guard theo route, mock auth service chờ backend thật ở P3.

## Kế hoạch thực hiện

- [x] Trang `/login`: form tài khoản/mật khẩu theo design system mockup; xác thực qua auth service (mock, cấu hình qua env).
- [x] Lưu phiên bằng cookie/localStorage qua lớp trừu tượng `services/auth` — thay bằng JWT thật khi có backend.
- [x] `config/roles.config.ts`: danh sách vai trò + quyền theo phân hệ (xem/sửa/duyệt). Sidebar và route guard đọc từ config này.
- [x] Câu hỏi mở #12 (phân quyền theo hành động?) — hiện làm theo phân hệ, chờ khách xác nhận.
