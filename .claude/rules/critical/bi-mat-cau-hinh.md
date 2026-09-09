# Luật: Bí mật và cấu hình
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC (có hook chặn)
# Ngăn: secret lọt vào mã / bundle trình duyệt / git, cấu hình lệch giữa các máy

## Hai tệp, hai vai trò khác nhau

| Tệp | Nội dung | Git |
|---|---|---|
| `.env.local` | Giá trị **thật** của máy đang chạy | ❌ Không bao giờ commit |
| `.env.example` | **Mẫu**: đủ tên biến, giá trị là giữ chỗ (rỗng hoặc `change-me-...`) | ✅ Commit |

Vị trí: `backend/` · `admin-web/` · `zalo-miniapp/` mỗi nơi một cặp.
**Ngoại lệ thư mục gốc**: dùng cặp `.env` / `.env.example` vì Docker Compose chỉ tự đọc
tệp tên đúng `.env`. `mobile/` không dùng tệp env — cấu hình qua `--dart-define`.

## MUST

| # | Luật |
|---|------|
| 1 | Thêm biến mới → sửa **CẢ HAI** tệp cùng lúc. Giá trị thật vào `.env.local`; tên biến + giá trị giữ chỗ + một dòng chú thích vào `.env.example` |
| 2 | Biến mới của backend phải khai báo trong `libs/shared/src/config/configuration.ts` và truy cập **chỉ** qua `ConfigService` |
| 3 | Biến mới của `admin-web` khai báo trong `src/config/app.config.ts`; của `zalo-miniapp` trong `src/config/app.config.ts` |
| 4 | Đọc biến môi trường phải coi **chuỗi rỗng là chưa đặt** (dùng `envText`/`envNumber`/`envFlag`, không dùng `??` trần) — đường triển khai Docker sinh ra đúng chuỗi rỗng |
| 5 | Biến mới cần truyền qua Docker → cập nhật `docker-compose.yml` và `.env.example` gốc, nếu không container nhận chuỗi rỗng mà không báo lỗi |
| 6 | Đổi giá trị mặc định nhạy cảm → ghi vào `SECURITY.md` mục "Việc BẮT BUỘC làm trước khi lên production" |
| 7 | Secret trong CI đặt ở phần Secrets của nền tảng, tham chiếu bằng `${{ secrets.X }}` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đặt giá trị thật vào `.env.example`: mật khẩu, chuỗi kết nối có credential, khoá API, token, IP máy chủ nội bộ |
| 2 | Đọc `.env.local` rồi **in nội dung ra chat, commit message, tài liệu, hay log**. Cần dẫn chiếu thì nói **tên** biến |
| 3 | Đặt secret vào biến tiền tố `NEXT_PUBLIC_*` hoặc `VITE_*` — chúng **được nhúng vào bundle gửi trình duyệt**, ai mở DevTools cũng đọc được |
| 4 | Hardcode secret trong mã nguồn, kể cả "tạm để test" — hook `secret_scan.py` sẽ chặn |
| 5 | Tự tạo lại tệp `.env` ở `backend/`, `admin-web/`, `zalo-miniapp/` (ứng dụng đọc `.env.local`; để lẫn cả hai gây lệch cấu hình khó truy) |
| 6 | `git add -f` bất kỳ tệp `.env*` nào ngoài `.env.example`. `.gitignore` đã chặn — git bỏ qua tệp env là **đúng thiết kế** |
| 7 | Đọc `process.env` trực tiếp ngoài tệp cấu hình tập trung của module |
| 8 | Đặt giá trị mặc định là URL/host thật (kể cả nội bộ) trong mã — mặc định phải là `localhost` hoặc rỗng |

## Điều kiện DỪNG

- Cần một secret mà `.env.local` chưa có → **hỏi người dùng**, không tự sinh và không tự đoán
- Thấy secret đã lọt vào git → dừng, báo ngay, đề xuất xoay khoá (không tự `git filter-branch`)

## Bí mật đang dùng trong ViGov

| Biến | Ký gì / mở gì | Ghi chú |
|---|---|---|
| `JWT_SECRET` | Token đăng nhập **và** link tệp riêng tư | Production chặn khởi động nếu còn giá trị mẫu; cần ≥ 32 ký tự |
| `MONGO_URI` | Toàn bộ dữ liệu | Phải bật xác thực trước production |
| `RABBITMQ_URI` | Hàng đợi | Phải xoá `guest/guest` trước production |
| `ZALO_APP_SECRET`, `ZALO_OA_ACCESS_TOKEN` | Định danh công dân, gửi ZNS | |
| `CITIZEN_OTP_BYPASS_CODE` | **Lối vào không qua xác thực thật** | Phải để trống trước production |
| `OCR_API_KEY`, `IDCARD_API_KEY`, `GEO_API_KEY`, `FCM_SERVER_KEY`, `S3_*` | Bên thứ 3 | Chỉ đọc qua adapter |

→ `du-lieu-ca-nhan.md` · `khong-hardcode.md` · `skills/trien-khai-docker`
