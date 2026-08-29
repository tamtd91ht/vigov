# P2-12 — Mobile — Home & Định danh SĐT

> Trạng thái: **done** · Đổi hướng 27/08/2026: mobile dùng **Flutter (Android + iOS)** thay Zalo Mini App theo yêu cầu khách

## Mô tả

Scaffold Flutter (go_router, provider); luồng định danh số điện thoại + OTP (mock, backend thật ở P3); Trang chủ: header chào theo định danh, 6 ô truy cập nhanh, widget 'Phản ánh của tôi' mới nhất, mini-feed tin tức.

## Kế hoạch thực hiện

- [x] Onboarding: nhập SĐT → OTP 6 số (mock qua `IdentityService`, lưu phiên bằng shared_preferences).
- [x] Quick actions đọc từ config — không hardcode.
- [x] Widget phản ánh mới nhất + 3 tin mới, điều hướng sâu vào tab/route tương ứng.
