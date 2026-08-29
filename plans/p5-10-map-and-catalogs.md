# P5-10 — Nối nốt Bản đồ và các danh mục tĩnh vào API

> Trạng thái: **done** · Tách ra từ P5-01 ngày 28/08/2026

## Mô tả

Sau P5-01, 10/11 phân hệ đã chạy bằng dữ liệu thật từ MongoDB. Phần còn lại:

- **Bản đồ Kinh tế số** — backend chưa có endpoint nào, giao diện vẫn đọc toàn bộ từ `src/mocks/map.ts` (8 lớp dữ liệu, 22 ghim cơ sở kinh tế, cơ cấu ngành, 4 chỉ số tổng hợp).
- **Danh mục tĩnh** còn đọc từ `src/mocks/*`: bộ phận chuyên môn, danh bạ cán bộ (dropdown phân công), thôn/tổ dân phố, chuyên mục bài viết/video/truyền thanh, danh sách năm ngân sách.
- **Lịch sử gửi thông báo** — đang bổ sung ở nhánh sửa backend (`GET /notifications/broadcasts`); nếu đã xong thì bỏ mục này.

## Kế hoạch thực hiện

- [x] Backend: schema + CRUD lớp bản đồ và ghim cơ sở kinh tế (`GET/POST/PATCH/DELETE /map/layers`, `/map/pins`), kèm thống kê cơ cấu ngành và 4 chỉ số tổng hợp.
- [x] Backend: endpoint danh mục dùng chung `GET /catalogs/{departments,areas,article-categories,video-topics,radio-categories,budget-years}` — nguồn dữ liệu lấy từ cấu hình tổ chức và dữ liệu thực tế.
- [x] Backend: `GET /catalogs/staff` cho dropdown phân công cán bộ (khác `/users/staff` vì không đòi quyền quản trị người dùng).
- [x] admin-web: thay các import còn lại từ `src/mocks` bằng service gọi API; giữ mock làm đường lui khi bật chế độ demo.
- [x] Bản đồ nền thật (VietMap / Goong / MapLibre) thuộc P5-09, làm sau khi khách chốt nhà cung cấp — câu hỏi mở #2.

## Ghi chú

Component `MapCanvas` đã tách sẵn theo adapter pattern nên khi có provider thật chỉ cần thay component này, không phải sửa trang.
