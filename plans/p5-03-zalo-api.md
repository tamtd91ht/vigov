# P5-03 — Nối Zalo Mini App vào API thật

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Tương tự P5-02 cho kênh Zalo: định danh qua token Zalo SDK đổi lấy SĐT ở server, các màn còn lại gọi API chung với app Flutter.

## Kế hoạch thực hiện

- [x] Tạo `src/services/api.ts` gắn JWT, xử lý 401.
- [x] `SessionContext.identify()` gọi `/auth/citizen/zalo/identify` với token từ `zaloService.requestPhoneNumber()`.
- [x] `FeedbackContext` gọi API thay cho state cục bộ; tin tức/video/truyền thanh đọc `/content/public/*`.
- [x] Kiểm tra CORS cho tên miền Mini App (`h5.zdn.vn`) trong `CORS_ORIGINS` của backend.
