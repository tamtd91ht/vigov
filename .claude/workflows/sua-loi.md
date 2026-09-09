# Quy trình: Sửa lỗi

Dùng khi: có lỗi cần điều tra và sửa.

## Nguyên tắc

**Tìm nguyên nhân gốc trước khi sửa.** Với hệ thống của cơ quan nhà nước, một bản vá
che triệu chứng sẽ để lại lỗi thật trong hệ thống mà UBND xã phải vận hành nhiều năm.

## Bước

| # | Việc | Kiểm chứng |
|---|---|---|
| 1 | Tái hiện lỗi. Không tái hiện được thì nói rõ và hỏi thêm dữ kiện | Có cách bấm/gọi ra được lỗi |
| 2 | Xác định **triệu chứng thật** vs **triệu chứng người dùng thấy** | Một câu mô tả chính xác |
| 3 | Khoanh vùng: module nào, tầng nào (giao diện / API / dữ liệu / cấu hình) | Danh sách tệp nghi vấn |
| 4 | Đọc mã ở vùng đó, **đọc cả comment tiếng Việt** — dự án này giải thích *vì sao* trong comment | Hiểu ý định ban đầu |
| 5 | Tìm **nguyên nhân gốc**, viết ra một câu: "X xảy ra vì Y" | Câu đó giải thích được **mọi** triệu chứng |
| 6 | Kiểm xem lỗi này có **ở chỗ khác nữa** không (cùng một sai sót lặp lại) | Đã grep tìm mẫu tương tự |
| 7 | Viết test **đỏ** tái hiện lỗi | Test fail đúng lý do |
| 8 | Sửa **nguyên nhân gốc**, phạm vi tối thiểu | Test chuyển xanh |
| 9 | Chạy toàn bộ test của module + `npm run check:all` | Xanh, không hồi quy |
| 10 | Nếu lỗi liên quan bảo mật → cập nhật `SECURITY.md` mục 2 | Có mã phát hiện + trạng thái |
| 11 | Nếu là sự cố môi trường/triển khai → thêm dòng vào bảng xử lý sự cố `README.md` | |
| 12 | Đồng bộ tài liệu | `agents/dong-bo-tai-lieu.md` |

## Bảng chẩn đoán nhanh theo triệu chứng

| Triệu chứng | Nghi vấn đầu tiên |
|---|---|
| Ô trống / `undefined` trên giao diện | Lệch tên trường giữa 4 module → `skills/dong-bo-kieu-4-module` |
| Tên xã rỗng, toạ độ ra giữa biển, URL rỗng | Biến môi trường thành **chuỗi rỗng** qua Docker → `skills/trien-khai-docker` |
| `PATCH`/`POST` bị chặn hết | Xung đột CORS ở gateway dùng chung |
| 502 sau nginx | `keepalive` — xem `deploy/gateway-151-vigov.conf` |
| Realtime im lặng | nginx không chuyển tiếp `/socket.io/` |
| Rate-limit đếm gộp mọi người | Chưa đặt `TRUST_PROXY` |
| Người bị khoá vẫn dùng được | Token thiếu `sid`, hoặc bỏ tra `SessionRegistry` |
| Hồ sơ đã xoá hiện lại trên báo cáo | Truy vấn thiếu `deletedAt: null` |
| Số liệu báo cáo lệch | Bộ lọc thiếu, hoặc múi giờ, hoặc đếm cả bản ghi đã xoá |
| Hạn xử lý sai một hai ngày | Tính ngày tự nhiên thay vì **ngày làm việc** → `skills/sla-va-trang-thai` |
| Test e2e lỗi `text index required` | Thư mục tạm còn dưới 500 MB |
| Mã OTP không xác thực được sau khi đổi instance | `OTP_STORE=memory` với nhiều instance |
| Bản đồ trắng trơn, không báo lỗi | `maplibre-gl` bị nâng lên bản 6 — phải ghim `5.24.0` |

## KHÔNG BAO GIỜ

- Sửa triệu chứng khi chưa hiểu nguyên nhân
- `try/catch` bọc lỗi rồi bỏ qua để "không còn thấy lỗi"
- Đổi ngưỡng/mong đợi của test để test xanh
- Tắt một chốt bảo mật để lỗi biến mất
- Sửa dữ liệu thật để che lỗi (thay vì sửa mã) → `rules/critical/bao-toan-du-lieu.md`
- Refactor kèm trong lúc sửa lỗi (làm bản vá khó rà)

→ `workflows/_INDEX.md` · `skills/kiem-thu-vigov`
