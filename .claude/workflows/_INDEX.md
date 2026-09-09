# Quy trình — chỉ mục

Nạp theo loại việc đang làm. Mỗi quy trình là **danh sách bước có cách kiểm chứng**,
không phải nơi viết mã (mã ở `skills/`).

| Quy trình | Dùng khi |
|---|---|
| `tinh-nang-moi.md` | Làm một task mới trong `pending-tasks.json`, hoặc thêm một tính năng |
| `sua-loi.md` | Có lỗi cần điều tra và sửa |
| `them-endpoint.md` | Thêm hoặc đổi một endpoint API |
| `doi-truong-du-lieu.md` | Thêm / đổi tên / đổi kiểu một trường ảnh hưởng nhiều module |
| `tich-hop-ben-thu-ba.md` | Nối một dịch vụ bên ngoài (OCR, GIS, ZNS, FCM, đọc CCCD, S3) |
| `xu-ly-du-lieu-ca-nhan.md` | Thêm trường dữ liệu cá nhân, hoặc xử lý yêu cầu xoá của công dân |
| `truoc-phat-hanh.md` | Chuẩn bị phát hành / UAT / bàn giao |

## Ba bước có ở MỌI quy trình

Bất kể làm gì, ba bước này không được bỏ:

| # | Bước | Bỏ qua được khi |
|---|---|---|
| 1 | **Kiểm chứng thật** — chạy lệnh, đọc kết quả | Không bao giờ |
| 2 | **Rà soát bảo mật** — `agents/ra-soat-bao-mat.md` | Thay đổi không chạm dữ liệu, quyền, tệp, cấu hình |
| 3 | **Đồng bộ tài liệu** — `agents/dong-bo-tai-lieu.md` | Không bao giờ |

## Nguyên tắc chung

- **Nêu giả định trước khi viết mã.** Nghiệp vụ hành chính có nhiều biến thể theo địa
  phương — chọn thầm là chọn sai.
- **Không tự chốt câu hỏi mở của khách hàng** (~27 câu ở `ESTIMATE_TECHNICAL.md`).
- **Làm đúng phạm vi.** Việc phát sinh ngoài phạm vi → ghi vào plan hoặc tạo task mới.
- **Báo cáo trung thực**: đã chạy lệnh nào, kết quả gì, còn gì chưa làm và vì sao.
