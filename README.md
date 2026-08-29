https://github.com/tamtd91ht/vigov.git# ViGov — Nền tảng Điều hành số cấp Xã/Phường (Phase 1)

Bốn module chung một dự án (mỗi module tự chứa, sẵn sàng tách repo khi cần):

| Thư mục | Sản phẩm | Techstack | Trạng thái |
|---|---|---|---|
| `admin-web/` | Web Quản trị (11 phân hệ) | Next.js 16 · App Router · TypeScript | **Code-complete P1 (mock data)** |
| `backend/` | API nền tảng (15 module nghiệp vụ) | NestJS 11 · MongoDB · JWT + RBAC | **Code-complete P3 · 11/11 test API pass** |
| `mobile/` | App công dân Android + iOS (9 màn) | **Flutter** · Material 3 · provider + go_router | **Code-complete P2 (mock data)** |
| `zalo-miniapp/` | Zalo Mini App công dân (9 màn) | **ReactJS + Vite** · TypeScript · zmp-sdk adapter | **Code-complete P2Z** |

> Cập nhật 27/08/2026 theo yêu cầu khách: kênh công dân làm **cả hai** — app Flutter (Android + iOS) và Zalo Mini App, dùng chung nghiệp vụ + dữ liệu mẫu để demo đồng bộ. Phát hành 3 kênh: Google Play, App Store, Zalo Mini App Store (task P4-37).

## Quản lý công việc

- **`pending-tasks.json`** — danh sách toàn bộ task Phase 1 (`{id, name, description, planFilePath, createdAt, updatedAt, status}`), bóc tách từ `ESTIMATE_TECHNICAL.md` (WBS #1–#38). Trạng thái: `pending` → `in-progress` → `done`.
- **`plans/`** — mỗi task một file plan chi tiết (phạm vi, checklist, câu hỏi mở liên quan).
- **`ESTIMATE_SUMMARY.md` / `ESTIMATE_TECHNICAL.md`** — estimate đã lập ngày 26/08/2026.
- **`vigov-prototype.html`** — mockup 8 trang Web Quản trị đã duyệt, dùng làm spec UI.
- **`ViGov_Phase1_Req.xlsx`** — WBS yêu cầu gốc của khách.
- **`BAO-CAO-TIEN-DO.md`** — báo cáo tiến độ + tài liệu kỹ thuật ngắn gọn (kiến trúc, đã tích hợp gì, còn thiếu gì).
- **`SECURITY.md`** — kết quả rà soát bảo mật (P4-36) và việc cần làm trước khi lên production.
- **`mobile/BUILD.md`** — cách build APK/AAB phát hành, cấu hình ký, kết nối backend.
- **`deploy/`** — triển khai VPS + nộp Zalo Mini App (`VPS-VA-ZALO.md`), hạ tầng nền (`README.md`), hồ sơ 3 store (`RELEASE.md`), kế hoạch UAT (`UAT.md`), cấu hình nginx mẫu (`nginx-vigov.conf`).
- **`docker-compose.yml` · `Jenkinsfile` · `.github/workflows/ci.yml`** — dựng toàn hệ và CI/CD (P4-34).

## Chạy nhanh toàn bộ môi trường phát triển

Từ **thư mục gốc** `vi-gov/`:

```bash
npm run install:all   # cài dependency cho cả 4 module (lần đầu)
npm run dev           # chạy song song backend + admin-web + zalo-miniapp
```

| Module | Địa chỉ | Lệnh chạy riêng |
|---|---|---|
| Backend API | http://localhost:3001/api/v1 | `npm run dev:api` |
| Web Quản trị | http://localhost:3100 | `npm run dev:web` |
| Zalo Mini App | http://localhost:5173 | `npm run dev:zalo` |
| App Flutter | thiết bị/emulator | `npm run dev:mobile` |

> Web Quản trị dùng cổng **3100** (không phải 3000 mặc định của Next.js) để tránh
> đụng các công cụ khác thường chiếm cổng 3000 — khi đó Next tự nhảy sang 3001 và
> trùng cổng backend.

Lệnh tiện ích khác ở thư mục gốc: `npm run check:all` (type-check + lint cả 4 module),
`npm run build:all`, `npm run test:api`, `npm run seed`, `npm run clean`.

### Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `npm error code ENOENT ... package.json` | Chạy `npm run dev` ở thư mục không có `package.json` | Chạy ở gốc `vi-gov/` hoặc trong thư mục module |
| `npm error Missing script: "dev"` ở `backend/` | Script cũ chỉ tên `start:dev` | Đã bổ sung alias `dev`; hoặc dùng `npm run start:dev` |
| Backend lặp `Unable to connect to the database. Retrying...` | Chưa chạy MongoDB | `cd backend && docker compose up -d`. `npm run dev` ở gốc nay kiểm tra trước và báo ngay |
| Next.js cảnh báo `inferred your workspace root ... multiple lockfiles` | Có `package-lock.json` lạc ở thư mục cha | Xoá lockfile đó. `admin-web/next.config.ts` đã ghim `turbopack.root` nên không tái diễn |
| Web Quản trị tự nhảy sang cổng 3001, đụng backend | Cổng 3000 bị ứng dụng khác chiếm | Web Quản trị đã đổi mặc định sang **3100** |
| `tsc --noEmit` báo lỗi trong `.next/dev/types/validator.ts` | Cache Next sinh dở do tắt dev server đột ngột | `npm run clean` |
| Test e2e backend lỗi `text index required for $text query` | Ổ đĩa chứa thư mục tạm còn dưới 500 MB — MongoDB từ chối tạo index | Dọn ổ C, hoặc chạy: `TEMP=D:	mpigov TMP=D:	mpigov npm run test:e2e` |
| RabbitMQ nhận kết nối nhưng gửi tin bị treo | Máy chủ chặn publish do hết dung lượng đĩa (`low on disk`) | Giải phóng đĩa trên máy RabbitMQ; kiểm tra bằng `GET /api/v1/health/ready` — trường `messaging.blocked` |

## Triển khai lên máy chủ

Xem **[`docs/04-TRIEN-KHAI.md`](docs/04-TRIEN-KHAI.md)** — runbook từng bước từ VPS
trống tới hệ thống chạy thật (Bước 0–11), rồi chuyển sang Jenkins (Bước 12).
`deploy/README.md` là tài liệu tra cứu theo chủ đề khi cần đào sâu hoặc xử lý sự cố.

Bộ tài liệu bàn giao đầy đủ: [`docs/`](docs/README.md).

## Chạy toàn hệ bằng Docker

```bash
cp .env.example .env          # điền JWT_SECRET, CORS_ORIGINS, tên miền thật
docker compose up -d
docker compose run --rm --no-deps backend node dist/apps/api-gateway/apps/api-gateway/src/seed
```

## Chạy Backend riêng (dev)

```bash
cd backend
npm install
cp .env.example .env.local    # điền giá trị thật vào .env.local — KHÔNG commit
docker compose up -d          # mongo + rabbitmq (bỏ qua nếu dùng MongoDB sẵn có — khai trong .env.local)
npm run seed                  # tạo 10 tài khoản (admin/123456) + cấu hình SLA
npm run start:dev             # http://localhost:3001/api/v1
npm run test:e2e              # 11 test API đầu-cuối
```

## Chạy Web Quản trị

```bash
cd admin-web
npm install
npm run dev          # http://localhost:3100
```

Đăng nhập: tài khoản quản trị **`admin` / `123456`** (tạo bởi `npm run seed`).
Ngoài ra còn 9 tài khoản cán bộ theo danh bạ xã (`binh.nv`, `hanh.tt`, …) với mật khẩu `ViGov@2026`.

> Đặt `NEXT_PUBLIC_USE_MOCKS=false` trong `admin-web/.env.local` để đăng nhập qua backend thật (mặc định hiện tại).
> Đặt `true` nếu muốn xem giao diện khi chưa dựng backend — khi đó trang đăng nhập hiện sẵn tài khoản dùng thử.

## Chạy App công dân (Flutter)

```bash
cd mobile
flutter pub get
flutter run          # chọn thiết bị Android/iOS/emulator
```

Định danh demo (chế độ mock): nhập SĐT 10 số bất kỳ, OTP 6 số bất kỳ. Cấu hình build qua `--dart-define` (xem `mobile/lib/config/app_config.dart`).

## Chạy Zalo Mini App

```bash
cd zalo-miniapp
npm install
cp .env.example .env.local
npm run dev          # http://localhost:5173 — chạy được trên trình duyệt nhờ adapter SDK mock
```

Zalo SDK (SĐT, QR, GPS, chat) đi qua adapter `src/services/zalo.ts`: chế độ mock khi phát triển trên trình duyệt, gọi `zmp-sdk` thật khi chạy trong Zalo (`VITE_USE_MOCKS=false`). Cấu hình Mini App nằm ở `app-config.json`.

## Nguyên tắc code

- **Không hardcode**: mọi cấu hình (URL, tên đơn vị, danh mục, SLA, trạng thái, màu) nằm trong `src/config/*` hoặc biến môi trường (`.env.example` của từng module).
- **Mock tách riêng**: dữ liệu mẫu nằm trong `src/mocks/*`, service layer sẵn interface để chuyển sang API thật (P3) mà không sửa UI.
- **Types đồng bộ**: `admin-web/src/types/index.ts` là nguồn chuẩn tên field cho schema backend.
