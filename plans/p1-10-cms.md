# P1-10 — CMS nội dung Mobile

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #10 (chưa có mockup — thiết kế theo design system) — CRUD tin tức / sự kiện / thông báo, video tuyên truyền, bản tin truyền thanh; gửi broadcast ZNS/push; 2 lịch sử gửi (công dân / nội bộ).

## Kế hoạch thực hiện

- [x] Route `/cms`. Không có mockup — tuân thủ design system hiện có (card, bảng, drawer, tabs).
- [x] Tabs: Tin tức & Sự kiện / Thông báo / Video / Truyền thanh / Lịch sử gửi.
- [x] CRUD bài viết trong drawer: tiêu đề, chuyên mục, ảnh cover, nội dung, trạng thái (Nháp/Đã đăng), ngày đăng.
- [x] Video: bảng (tiêu đề, chủ đề, thời lượng, lượt xem, nguồn YouTube/tự host — câu hỏi mở #19). Truyền thanh: bản tin theo ngày + chuyên mục + file audio.
- [x] Broadcast: form chọn kênh (ZNS/push), đối tượng (toàn dân/nội bộ), nội dung; 2 tab lịch sử gửi. Gửi thật qua P3 Notification (#23).
- [x] Câu hỏi mở #14: quy trình biên tập ai đăng/ai duyệt — chờ khách.
