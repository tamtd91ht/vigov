# P5-02 — Nối app Flutter vào API thật

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

App công dân Android/iOS đang chạy hoàn toàn bằng mock trong lib/mocks/*. Nối vào backend: định danh SĐT + OTP, gửi và theo dõi phản ánh, tin tức, truyền thanh, video, tra cứu hồ sơ.

## Kế hoạch thực hiện

- [x] Tạo `lib/services/api_client.dart`: base URL từ AppConfig, gắn JWT, xử lý 401 (đăng xuất) và lỗi mạng.
- [x] Đổi `IdentityService` sang gọi `/auth/citizen/otp/request` và `/otp/verify`, lưu token thay cho phiên mock.
- [x] `FeedbackStore` gọi `/feedback/citizen` (tạo, danh sách, chi tiết, đánh giá) thay cho danh sách trong bộ nhớ.
- [x] Tin tức/video/truyền thanh đọc từ `/content/public/*`.
- [x] Giữ cờ `USE_MOCKS` để chạy demo offline khi cần.
