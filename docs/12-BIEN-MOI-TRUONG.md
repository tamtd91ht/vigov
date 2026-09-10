# ViGov — Biến môi trường: `.env`, `.env.example`, `.env.local`

Nơi duy nhất giải thích ba tệp này. Tài liệu khác nêu lệnh cần chạy rồi trỏ về đây.

## 1. Ba tệp, ba vai trò

| Tệp | Nội dung | Ai điền | Git |
|---|---|---|---|
| `.env.example` | Mẫu: đủ tên biến, giá trị giữ chỗ (`change-me-...` hoặc rỗng) | Người viết mã, khi thêm biến | ✅ Commit |
| `.env.local` | Giá trị **thật** của một máy: mật khẩu, chuỗi kết nối, khoá API | Người chạy máy đó | ❌ Không |
| `.env` | **Chỉ ở thư mục gốc**, dành riêng cho `docker-compose.yml` | Người triển khai | ❌ Không |

Tách hai tệp vì: chỉ có tệp giá trị thật thì người mới clone không biết cần biến nào; commit
tệp giá trị thật thì `JWT_SECRET` và mật khẩu Mongo vào lịch sử git — không lấy lại được.
`.env.example` mô tả **hình dạng** cấu hình, `.env.local` chứa **nội dung**.

## 2. Vị trí

```
vi-gov/
├── .env  ·  .env.example        ← chỉ cho docker-compose.yml
├── backend/.env.local  ·  .env.example
├── admin-web/.env.local  ·  .env.example
└── zalo-miniapp/.env.local  ·  .env.example
```

`.gitignore` chặn mọi `.env*` trừ `.env.example`. Git bỏ qua tệp env là **đúng thiết kế** —
không `git add -f`.

**Vì sao gốc dùng `.env`:** Docker Compose chỉ tự đọc tệp tên đúng `.env` cùng thư mục, nó
không biết `.env.local`. Thiếu tệp đó mà không truyền `--env-file` thì mọi `${BIẾN}` thành
chuỗi rỗng **và không báo lỗi**.

## 3. Module nào đọc tệp nào

| Module | Cơ chế | Khai báo biến |
|---|---|---|
| `backend/` | `envFilePath: ['.env.local', '.env']` — `apps/api-gateway/src/app.module.ts:44` | `libs/shared/src/config/configuration.ts`, đọc qua `ConfigService` |
| `admin-web/` | Next.js tự nạp `.env.local` | `src/config/app.config.ts` |
| `zalo-miniapp/` | Vite tự nạp `.env.local` | `src/config/app.config.ts` |
| Docker | `docker-compose.yml` đọc `.env` gốc rồi tiêm thành biến môi trường container | khối `environment:` |

Backend nạp `backend/.env.local` **trước**, rồi `backend/.env` — nên nó *có* đọc
`backend/.env` nếu tệp đó tồn tại. Vì thế quy ước **cấm tạo `backend/.env`**: hai tệp cùng
tồn tại thì một giá trị cũ ở tệp bị lãng quên gây lệch cấu hình khó truy. Backend không đọc
`.env` ở thư mục **gốc** — tệp đó của Docker Compose.

### Thứ tự ưu tiên

```
Biến có trong môi trường (Docker, CI, shell)  →  .env.local  →  .env  →  mặc định trong mã
```

Giải thích câu hỏi hay gặp *"sửa `.env.local` rồi mà Docker vẫn giá trị cũ"*: container nhận
biến từ `docker-compose.yml`, và biến môi trường thật thắng nội dung tệp.

## 4. Bốn cạm bẫy

| # | Bẫy | Hệ quả · cách tránh |
|---|---|---|
| 1 | `NEXT_PUBLIC_*` và `VITE_*` **nằm trong bundle gửi trình duyệt** | Ai mở DevTools cũng đọc được → không đặt secret vào hai tiền tố này. Giá trị chốt **lúc build**, sửa tệp sau khi build là vô tác dụng |
| 2 | Build thiếu `.env.local` → bundle Mini App trỏ `localhost` | `localhost` là chính điện thoại người dân. Chốt chặn `zalo-miniapp/scripts/zmp-prepare.mjs:150` tự dừng build — điền `.env.local` rồi build lại, không gỡ chốt |
| 3 | Docker truyền **chuỗi rỗng**, không phải `undefined` | `??` chỉ chặn `null`/`undefined` nên chuỗi rỗng đi qua và vô hiệu giá trị mặc định. `admin-web` và `zalo-miniapp` đã phòng bằng `envText`/`envNumber`/`envFlag` |
| 4 | Sửa `.env.local` mà quên `.env.example` | Máy mình chạy tốt, người tiếp theo thiếu biến mà không có cách nào biết |

> ⚠ **Rủi ro còn tồn:** `backend/libs/shared/src/config/configuration.ts` vẫn dùng `??` trần,
> chưa có `envText`. Đã đối chiếu 38 biến `docker-compose.yml` truyền rỗng: hiện không biến
> nào có mặc định khác rỗng, nên chưa gây lỗi. Biến tiếp theo thêm kèm mặc định có nghĩa sẽ
> mắc bẫy #3.

## 5. Thêm một biến mới

| # | Việc | Tệp |
|---|---|---|
| 1 | Giá trị thật | `<module>/.env.local` |
| 2 | Tên biến + giá trị giữ chỗ + một dòng chú thích | `<module>/.env.example` |
| 3 | Khai báo để mã đọc | backend: `configuration.ts` · client: `src/config/app.config.ts` |
| 4 | Nếu chạy qua Docker | `docker-compose.yml` **và** `.env.example` gốc |
| 5 | Nếu phải đặt lúc triển khai | `docs/04-TRIEN-KHAI-VPS.md` |
| 6 | Nếu đổi mặc định nhạy cảm | `SECURITY.md` mục 4 |

Bỏ bước 4 là lỗi hay gặp nhất: chạy đúng trên máy dev, lên Docker thành chuỗi rỗng.
Kiểm nhanh: `/kiem-tra-env`.

## 6. Cấu hình OCR: CSDL thắng biến môi trường

Nhà cung cấp OCR cấu hình được ở **Web Quản trị → Cấu hình → Tích hợp**. Giá trị đó lưu
trong MongoDB và **ưu tiên cao hơn** `OCR_PROVIDER` / `OCR_API_KEY` / `OCR_ENDPOINT`:

```
Cấu hình ở trang Cấu hình (MongoDB)   →   tệp env (giá trị mồi)
```

Ưu tiên đi **một chiều**, quyết ở đúng một chỗ:
`IntegrationSettingsService.resolveOcr()`. Provider nhận cấu hình đã chốt qua tham số
`extract(fileRef, config)`, không tự suy luận lại.

"Chưa cấu hình" = **`provider` rỗng**, không phải chưa có bản ghi. Chọn *"Theo cấu hình máy
chủ"* ở giao diện là cách chủ động quay về biến môi trường.

Khoá API nhập ở giao diện được mã hoá **AES-256-GCM** trước khi lưu, khoá mã hoá suy từ
`JWT_SECRET` bằng HKDF (`libs/shared/src/crypto/secret-box.ts`). API chỉ trả khoá đã che.

> ⚠ Đổi `JWT_SECRET` là khoá đã lưu **không giải mã được nữa**. Hệ thống không sập: coi như
> chưa có khoá, ghi `error`, giao diện báo nhập lại. Đổi khoá thì nhập lại khoá API ngay sau.

**Bài học về tên khoá cấu hình:** một chốt chặn cũ viết `config.get('nodeEnv')` trong khi
`configuration.ts` khai khoá là `env`. `get` với tên khoá không tồn tại trả `undefined` chứ
không báo lỗi, nên chốt đó chưa bao giờ chạy và không test nào bắt được. Viết chốt dựa trên
cấu hình thì phải có test khoá luôn **tên khoá**.

## 7. Xử lý sự cố

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| `docker compose up` báo biến chưa đặt | Thiếu `.env` gốc | `cp .env.example .env` rồi điền |
| Tên xã rỗng, tâm bản đồ ra giữa đại dương | Biến truyền rỗng qua Docker | Khai biến trong `.env` gốc — bẫy #3 |
| Mini App không kết nối được máy chủ | Build thiếu `zalo-miniapp/.env.local` | Tạo `.env.local`, build lại — bẫy #2 |
| Sửa `.env.local` mà Docker vẫn giá trị cũ | Biến container thắng tệp | Sửa `.env` gốc rồi `docker compose up -d` |
| Sửa `VITE_*` / `NEXT_PUBLIC_*` mà giao diện không đổi | Chốt lúc build | Build lại |
| Đổi `OCR_PROVIDER` mà không có tác dụng | Trang Cấu hình đang ghi đè | Xem Cấu hình → Tích hợp — mục 6 |
| Máy khác chạy hỏng, máy mình chạy tốt | Biến mới chưa vào `.env.example` | Bổ sung rồi chạy `/kiem-tra-env` |
| `git status` không thấy `.env.local` | `.gitignore` chặn | Đúng thiết kế |

## 8. Bốn điều tuyệt đối không làm

| # | Cấm | Vì sao |
|---|---|---|
| 1 | Giá trị thật trong `.env.example` | Tệp này lên git — không lấy lại được |
| 2 | Secret trong `NEXT_PUBLIC_*` / `VITE_*` | Nằm trong bundle gửi trình duyệt |
| 3 | In nội dung `.env.local` ra chat / commit / tài liệu | Chứa credential thật. Dẫn chiếu thì nói **tên** biến |
| 4 | Tạo `.env` ở `backend/`, `admin-web/`, `zalo-miniapp/` | Lệch cấu hình khó truy — mục 3 |

Thiếu secret thì **hỏi người phụ trách**, không tự sinh. Secret đã lọt vào git thì **báo ngay
và xoay khoá**, không tự viết lại lịch sử git.

→ `README.md` (lệnh chạy) · `docs/04-TRIEN-KHAI-VPS.md` (biến lúc triển khai) ·
`docs/06-VAN-HANH.md` (sự cố khi đang chạy) · `SECURITY.md` (việc trước production) ·
`.claude/rules/critical/bi-mat-cau-hinh.md` (luật cho AI agent)
