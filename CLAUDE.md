# ViGov — quy ước cho AI agent

## Biến môi trường: `.env.local` (giá trị thật) ↔ `.env.example` (mẫu)

Mỗi module có **hai** tệp cấu hình, vai trò khác hẳn nhau:

| Tệp | Nội dung | Git |
|---|---|---|
| `.env.local` | Giá trị **thật** của máy đang chạy: mật khẩu, chuỗi kết nối, khoá API | ❌ Không bao giờ commit |
| `.env.example` | **Mẫu**: đủ tên biến, nhưng giá trị là giữ chỗ (rỗng hoặc `change-me-...`) | ✅ Commit |

Vị trí:

```
backend/.env.local        backend/.env.example
admin-web/.env.local      admin-web/.env.example
zalo-miniapp/.env.local   zalo-miniapp/.env.example
.env                      .env.example          ← NGOẠI LỆ, xem mục dưới
```

### Quy tắc bắt buộc khi ghi vào hai tệp này

1. **Thêm biến mới → sửa CẢ HAI tệp.** Giá trị thật vào `.env.local`, tên biến kèm
   giá trị giữ chỗ và một dòng chú thích vào `.env.example`. Sửa một bên là
   `.env.example` mất đồng bộ, người tiếp theo clone về sẽ thiếu biến mà không biết.

2. **Không bao giờ đặt giá trị thật vào `.env.example`.** Không mật khẩu, không
   chuỗi kết nối có credential, không khoá API, không IP máy chủ nội bộ. Dùng
   `change-me-...`, để trống, hoặc `localhost`.

3. **Không đọc `.env.local` rồi in nội dung ra chat, commit message, hay tài liệu.**
   Tệp này chứa credential thật. Cần dẫn chiếu thì nói tên biến, không nói giá trị.

4. **Không tự tạo lại `.env`** ở `backend/`, `admin-web/`, `zalo-miniapp/`.
   Ứng dụng đọc `.env.local`; để lẫn cả hai sẽ gây lệch cấu hình khó truy.

5. **Không `git add -f` bất kỳ tệp `.env*` nào** ngoài `.env.example`.
   `.gitignore` đã chặn — nếu thấy git bỏ qua một tệp env, đó là đúng thiết kế.

6. **Đổi giá trị mặc định nhạy cảm thì ghi vào `SECURITY.md`**, mục "Việc BẮT BUỘC
   làm trước khi lên production", thay vì chỉ sửa lặng lẽ trong `.env.example`.

### Ngoại lệ: `.env` ở thư mục gốc

Docker Compose **chỉ** tự đọc tệp tên đúng `.env` cùng thư mục — nó không biết tới
`.env.local`, và thiếu `--env-file` thì mọi biến thành rỗng mà không báo lỗi.
Nên thư mục gốc giữ nguyên cặp `.env` / `.env.example`, chỉ dùng cho
`docker-compose.yml` lúc triển khai. Cả hai quy tắc trên vẫn áp dụng y nguyên:
`.env` không commit, `.env.example` chỉ chứa giá trị mẫu.

### Ứng dụng đọc tệp nào

| Module | Cơ chế nạp |
|---|---|
| `backend/` | `ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] })` trong `apps/api-gateway/src/app.module.ts`; mọi biến truy cập qua `ConfigService`, khai báo tại `libs/shared/config/configuration.ts` |
| `admin-web/` | Next.js nạp `.env.local` sẵn có. Biến `NEXT_PUBLIC_*` **được nhúng vào bundle gửi trình duyệt** — tuyệt đối không đặt secret vào tiền tố này |
| `zalo-miniapp/` | Vite nạp `.env.local` (ưu tiên cao hơn `.env`). Biến `VITE_*` cũng vào bundle — không đặt secret |
| `mobile/` | Không dùng tệp env; cấu hình build qua `--dart-define`, xem `lib/config/app_config.dart` |

Biến đã có sẵn trong môi trường (Docker, CI) luôn thắng giá trị trong tệp.

## Nguyên tắc chung của dự án

- **Không hardcode**: URL, tên đơn vị, danh mục, SLA, trạng thái, màu sắc nằm ở
  `src/config/*` của từng module hoặc biến môi trường — không rải rác trong component.
- **Adapter cho mọi dịch vụ bên thứ 3** (OCR, GIS, ZNS, FCM): đổi nhà cung cấp chỉ
  sửa một tệp adapter, không đụng vào tầng nghiệp vụ.
- **Tên trường thống nhất giữa 4 module**; `admin-web/src/types/index.ts` là nguồn chuẩn.

## Tài liệu

`README.md` (cách chạy, xử lý sự cố) · `SECURITY.md` (rà soát bảo mật, việc bắt buộc
trước production) · `BAO-CAO-TIEN-DO.md` (tiến độ) · `deploy/` (triển khai, UAT, phát
hành store) · `plans/` (plan chi tiết từng task) · `pending-tasks.json` (trạng thái task).
