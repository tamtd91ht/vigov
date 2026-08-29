# P2Z-00 — Zalo Mini App — Scaffold & nền tảng dùng chung

> Trạng thái: **done** · Bổ sung 27/08/2026: khách yêu cầu làm **cả Zalo Mini App** song song app Flutter

## Mô tả

Dựng module zalo-miniapp (ReactJS + Vite + zmp-ui), cấu hình app-config.json, design system theo nhận diện ViGov, layout khung (header + bottom nav 5 mục), router, adapter Zalo SDK (mock được trên trình duyệt), store phản ánh + cài đặt.

## Kế hoạch thực hiện

- [x] Vite + React + TypeScript; zmp-ui/zmp-sdk nạp qua adapter để chạy được cả trên trình duyệt lẫn Zalo.
- [x] Toàn bộ cấu hình qua `src/config/*` + biến VITE_* — không hardcode.
- [x] Model + mock dùng chung ngữ cảnh với app Flutter (cùng dữ liệu xã Đại Thắng) để demo đồng bộ.
