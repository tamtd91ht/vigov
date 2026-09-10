---
name: dong-bo-kieu-4-module
description: Dùng khi thêm hoặc đổi tên trường dữ liệu nghiệp vụ, đổi kiểu, thêm trạng thái, và cần đồng bộ giữa backend, admin-web, zalo-miniapp. Kích hoạt bởi: đồng bộ kiểu, types/index.ts, tên trường, đổi tên trường, thêm trường, interface, kiểu dữ liệu, 3 module, lệch trường, contract.
---

# Kỹ năng: Đồng bộ tên trường giữa 4 module
# Mức: CAO | Ngăn: một module gửi `citizenPhone`, một module đọc `phone`, lỗi âm thầm

## Nguồn chuẩn

`admin-web/src/types/index.ts` là **nguồn chuẩn** tên và kiểu của dữ liệu nghiệp vụ
(đã ghi trong `CLAUDE.md` gốc dự án). Ba module còn lại khớp theo:

| Module | Nơi khai kiểu | Cách kiểm |
|---|---|---|
| `admin-web/` | `src/types/index.ts` ← **NGUỒN CHUẨN** | `npx tsc --noEmit` |
| `backend/` | `*.schema.ts` + `dto/` (tên trường trả ra API) | `npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json` |
| `zalo-miniapp/` | `src/types/` | `npx tsc --noEmit` |

**TypeScript không bắt được lệch giữa module** — mỗi module biên dịch riêng, không import
chéo nhau. Lệch trường chỉ hiện ra lúc chạy thật, dưới dạng ô trống hoặc `undefined`.

## Trình tự bắt buộc khi đổi một trường

1. **Sửa nguồn chuẩn** — `admin-web/src/types/index.ts`
2. **Sửa backend** — schema + DTO + hàm map trả về
3. **Sửa admin-web** — service, component đang đọc trường đó
4. **Sửa zalo-miniapp** — `src/types/` + service + component (nếu trường đó tới công dân)
5. **Sửa mobile** — `lib/models/` + `fromJson`/`toJson` + widget
6. **Cập nhật `data/glossary.md`** nếu là khái niệm nghiệp vụ mới
7. **Chạy `npm run check:all`** ở gốc — type-check + lint cả 4 module
8. **Một commit** cho cả 6 bước — chia commit là để lại trạng thái lệch trong lịch sử

Trường **không** tới kênh công dân thì bỏ bước 4 và 5, nhưng phải nói rõ trong commit.

## MUST

| # | Luật |
|---|------|
| 1 | Tên trường viết `camelCase` tiếng Anh, cùng một tên ở cả 4 module |
| 2 | Khoá trạng thái / danh mục giữ nguyên chuỗi ngắn không dấu (`moi`, `dang`, `cho`, `qua`, `xong`) — **nhãn** tiếng Việt nằm ở cấu hình, không nằm trong dữ liệu |
| 3 | Trường ngày giờ truyền qua API dạng chuỗi ISO 8601; mỗi client tự định dạng khi hiển thị |
| 4 | Trường tiền truyền dạng **số nguyên đơn vị đồng** |
| 5 | Trường không có giá trị trả chuỗi rỗng hoặc mảng rỗng, **không** trả `null` (bốn client xử lý `null` khác nhau) |
| 6 | Thêm trạng thái mới → cập nhật `status.config.ts` + `categories.ts` + `@IsIn` của DTO backend |
| 7 | Đổi tên trường trong API là **thay đổi phá vỡ** — nếu client cũ đang chạy thật, phải trả **cả hai** tên một thời gian rồi mới bỏ tên cũ |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đổi tên trường ở một module rồi "sửa nốt sau" |
| 2 | Dùng tên khác nhau cho cùng một khái niệm (`citizenPhone` / `phone` / `applicantPhone` cho cùng một người) |
| 3 | Nhồi nhãn tiếng Việt vào dữ liệu thay vì dùng khoá + bảng nhãn |
| 4 | Thêm trường vào API mà không thêm vào `types/index.ts` |
| 5 | Trả cùng một trường với kiểu khác nhau ở hai endpoint |
| 6 | Đổi ý nghĩa một trường mà giữ nguyên tên |

## Trường dễ nhầm — đang có

| Khái niệm | Tên chuẩn | Ghi chú |
|---|---|---|
| Số điện thoại công dân gửi phản ánh | `citizenPhone` | Ra API thì **đã che** |
| Số điện thoại người làm hồ sơ một cửa | `applicantPhone` | Ra API thì **đã che** |
| Mã phiếu phản ánh | `code` | Mã in cho công dân |
| Số đến của văn bản | `arrivalNo` | |
| Số ký hiệu văn bản | `refNo` | |

→ `rules/critical/khong-hardcode.md` · `skills/api-contract-design` · `data/glossary.md`
