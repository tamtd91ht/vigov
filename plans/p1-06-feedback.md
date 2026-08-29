# P1-06 — Phản ánh Người dân (admin)

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #6 — 4 thẻ thống kê, lọc chip 8 lĩnh vực + trạng thái, lưới phiếu phản ánh có SLA đếm ngược (âm = quá hạn), drawer: ảnh hiện trường trước/sau, bản đồ mini vị trí, timeline xử lý, đánh giá sao + nhận xét của công dân, phân công cán bộ.

## Kế hoạch thực hiện

- [x] Route `/feedback`. Spec UI: prototype dòng 1460–1554 (renderFeedback, fbDrawer) + MOCK_DATA.phanAnh (9 phiếu).
- [x] Card phiếu: ảnh cover màu theo lĩnh vực, mã #PA-xxxx, SLA chip (còn X giờ / quá hạn X giờ / hoàn thành + sao).
- [x] Danh mục lĩnh vực + SLA đọc từ `config/sla.config.ts` (đồng bộ với trang Cấu hình).
- [x] Drawer: ảnh trước/sau (placeholder gradient), mini map (tọa độ mock), timeline, khối đánh giá sao khi đã xử lý, nút phân công/chuyển bộ phận (mock + toast).
- [x] Câu hỏi mở #9: xử lý xong auto gửi Zalo cho công dân? — thuộc P3 Notification.
