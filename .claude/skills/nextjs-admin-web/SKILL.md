---
name: nextjs-admin-web
description: Dùng khi làm việc trong admin-web/ — Next.js App Router, trang phân hệ, bảo vệ route, gọi API, mock data, cấu hình, bố cục. Kích hoạt bởi: admin-web, Next.js, App Router, page.tsx, layout.tsx, AuthGuard, middleware, NEXT_PUBLIC, Web Quản trị, phân hệ, feature, component, useMocks.
---

# Kỹ năng: Web Quản trị (admin-web)
# Mức: CAO | Ngăn: bảo vệ route chỉ ở client, secret vào bundle, cấu hình rải rác

## Cấu trúc

```
admin-web/src/
  app/                 // App Router: (dashboard)/<phân-hệ>/page.tsx, login/
  features/<phân-hệ>/  // toàn bộ giao diện + logic của một phân hệ
  components/{ui,layout}/  // dùng chung
  config/              // app · nav · roles · status · sla · map
  services/            // gọi API
  types/index.ts       // NGUỒN CHUẨN kiểu nghiệp vụ cho cả 4 module
  mocks/               // dữ liệu mẫu khi NEXT_PUBLIC_USE_MOCKS=true
  hooks/ lib/ test/
```

11 phân hệ: `dashboard` `tasks` `documents` `disbursement` `feedback` `map` `reports`
`cms` `users` `settings` `profile` (+ `help`).

## MUST

| # | Luật |
|---|------|
| 1 | Bảo vệ route ở **tầng máy chủ** (middleware / kiểm tra trong server component), không chỉ `AuthGuard` phía client. Ẩn giao diện là trải nghiệm; chặn là bảo mật |
| 2 | Đọc cấu hình qua `src/config/*`, **không** đọc `process.env` ngoài `app.config.ts` |
| 3 | Biến môi trường đọc bằng `envText`/`envNumber`/`envFlag` — coi chuỗi rỗng là chưa đặt (Docker sinh ra đúng chuỗi rỗng) |
| 4 | Nhãn, màu, trạng thái, danh mục, SLA lấy từ `config/`, không viết cứng → `rules/critical/khong-hardcode.md` |
| 5 | Kiểu dữ liệu nghiệp vụ khai ở `src/types/index.ts` — đây là nguồn chuẩn, ba module còn lại khớp theo → `skills/dong-bo-kieu-4-module` |
| 6 | Nút/menu ẩn theo quyền dùng `roles.config.ts`, và quyền đó **phải** khớp `libs/shared/src/auth/roles.ts` |
| 7 | Mọi chuỗi hiển thị tiếng Việt đúng chính tả → `rules/critical/ngon-ngu-hanh-chinh.md` |
| 8 | Bảng danh sách có phân trang, có trạng thái rỗng ("Chưa có dữ liệu"), có trạng thái đang tải |
| 9 | Gọi API cùng origin (qua rewrite/proxy) để thoát CORS của gateway dùng chung |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đặt secret vào `NEXT_PUBLIC_*` — biến này **nằm trong bundle gửi trình duyệt** |
| 2 | So sánh mật khẩu hay quyết định đăng nhập trong trình duyệt (đây chính là phát hiện C-03) |
| 3 | Điền lại `NEXT_PUBLIC_DEMO_PASSWORD` / `NEXT_PUBLIC_DEMO_USER` — hai biến này phải để trống (T-05) |
| 4 | Bật `NEXT_PUBLIC_USE_MOCKS=true` ở staging/production |
| 5 | Nhánh mock trộn lẫn nhánh thật trong cùng một hàm — tách rõ, kiểm cờ ở một chỗ |
| 6 | Đặt trần bề ngang cố định cho bố cục (đã bỏ có chủ ý — cán bộ dùng màn hình rất rộng) |
| 7 | Emoji trong giao diện Web Quản trị |
| 8 | Hiện thông báo lỗi kỹ thuật thô (mã lỗi HTTP, thông báo của Mongo) cho cán bộ |

## Cấu hình cổng và môi trường

Cổng dev là **3100**, không phải 3000 (3000 hay bị chiếm → Next nhảy sang 3001 và đụng
backend). `next.config.ts` đã ghim `turbopack.root` để không cảnh báo nhiều lockfile.

## Sau khi sửa

```
cd admin-web && npx tsc --noEmit && npm run lint
```

Cập nhật `docs/02-ADMIN-WEB.md` nếu đổi luồng hoặc thêm màn → `skills/tai-lieu-dong-bo`

→ `skills/dong-bo-kieu-4-module` · `skills/sla-va-trang-thai` · `rules/critical/bi-mat-cau-hinh.md`
