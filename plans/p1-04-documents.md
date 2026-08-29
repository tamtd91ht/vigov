# P1-04 — Văn bản & Đơn thư

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #4 — 2 tab Văn bản đến / Đơn thư công dân; cột hạn xử lý đếm ngược (quá hạn tô đỏ); drawer: xem bản scan + panel OCR trích 7 trường (số ký hiệu, ngày, cơ quan, trích yếu, hạn, độ mật, độ khẩn) cho cán bộ xác nhận/sửa; timeline luân chuyển; nút 'Chuyển thành công việc'; nhãn độ mật/độ khẩn.

## Kế hoạch thực hiện

- [x] Route `/documents`. Spec UI: prototype dòng 1308–1380 (renderDocs, docDrawer) + MOCK_DATA.vanBanDen (8) + donThu (6).
- [x] Tab + bảng: số đến, số ký hiệu, ngày, cơ quan, trích yếu, bộ phận, hạn (đếm ngược màu theo còn lại/quá hạn), trạng thái.
- [x] Drawer: khung scan placeholder + các trường gắn nhãn 'OCR' màu tím, nút xác nhận từng trường; timeline luân chuyển; footer 'Chuyển thành công việc' (tạo task mock + toast + điều hướng).
- [x] Form 'Tiếp nhận văn bản' + bộ lọc nâng cao: dựng khung, trường chi tiết chờ khách (câu hỏi mở #7).
- [x] Tích hợp OCR thật thuộc hệ số tích hợp ngoài (P3/#25) — Phase này mock kết quả trích xuất.
