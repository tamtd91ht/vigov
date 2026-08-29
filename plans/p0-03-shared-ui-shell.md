# P0-03 — Khung UI dùng chung (shell, drawer, toast, bình luận, nhật ký)

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #1 — Sidebar + topbar (tìm kiếm, chuông, trợ giúp, hồ sơ người dùng), drawer chi tiết trượt phải dùng chung, toast, tabs, khối bình luận & timeline nhật ký, bảng/thẻ KPI/chip trạng thái. Port design token từ vigov-prototype.html.

## Kế hoạch thực hiện

- [x] Port toàn bộ CSS token của mockup (màu navy/pink/blue…, card, chip, drawer, kanban, timeline…) vào `styles/globals.css` — giữ 100% look-and-feel đã duyệt.
- [x] Component: AppShell (Sidebar + Topbar), Drawer, Toast (context), Tabs, Card, KpiCard, Chip, Avatar, ProgressBar, Timeline, CommentList, FileList, DataTable, SegmentControl, FilterChips.
- [x] Bộ icon SVG stroke dùng chung port từ mockup (`lib/icons.tsx`).
- [x] Menu sidebar đọc từ `config/nav.config.ts` (id, nhãn, icon, route, badge) — không hardcode trong component.
