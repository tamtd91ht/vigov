# P2Z-01 — Zalo Mini App — Home & Định danh SĐT Zalo

> Trạng thái: **done** · Bổ sung 27/08/2026: khách yêu cầu làm **cả Zalo Mini App** song song app Flutter

## Mô tả

Luồng định danh số điện thoại qua Zalo SDK (xin quyền → token → đổi SĐT ở server, mock ở phase này); Trang chủ: header chào, 6 ô truy cập nhanh, widget phản ánh mới nhất, mini-feed tin tức.

## Kế hoạch thực hiện

- [x] Adapter `services/zalo.ts`: getPhoneNumber/getUserInfo — mock trên trình duyệt.
- [x] Quick action đọc từ config.
