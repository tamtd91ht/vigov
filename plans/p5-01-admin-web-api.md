# P5-01 — Nối Web Quản trị vào API thật (11 phân hệ)

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Hiện chỉ phần đăng nhập gọi backend; toàn bộ dữ liệu nghiệp vụ vẫn đọc từ src/mocks/*. Thay bằng lớp service gọi API, giữ nguyên giao diện đã duyệt.

## Kế hoạch thực hiện

- [x] Tạo `src/services/<phân hệ>.ts` cho từng phân hệ, dùng `apiClient` sẵn có (đã tự gắn JWT và xử lý 401).
- [x] Chuyển từng trang từ `useState(mockData)` sang tải dữ liệu qua service, bổ sung trạng thái đang tải và lỗi.
- [x] Giữ `src/mocks/*` làm dữ liệu dự phòng khi `NEXT_PUBLIC_USE_MOCKS=true` để vẫn demo được giao diện lúc chưa có backend.
- [x] Thứ tự ưu tiên: Nhiệm vụ → Văn bản → Phản ánh → Giải ngân → Cấu hình → CMS → Người dùng → Dashboard/Báo cáo → Bản đồ.
- [x] Phân trang, lọc, tìm kiếm chuyển sang tham số truy vấn của API thay vì lọc phía trình duyệt.

## Kết quả (28/08/2026)

- Seed 101 bản ghi nghiệp vụ vào MongoDB thật; chạy lại không nhân bản.
- Thêm endpoint `GET /reports/dashboard` gộp số liệu trang Tổng quan.
- 11/11 trang trả HTTP 200 với dữ liệu từ MongoDB; tsc và eslint sạch.
- Còn lại: phân hệ Bản đồ và các danh mục tĩnh — xem P5-10.
