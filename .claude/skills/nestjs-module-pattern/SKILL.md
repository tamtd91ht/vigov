---
name: nestjs-module-pattern
description: Dùng khi thêm hoặc sửa một module nghiệp vụ trong backend/ — cấu trúc thư mục module, controller/service/schema/dto, đăng ký vào app.module, alias @vigov/shared, tiêm ConfigService. Kích hoạt bởi các từ khoá: module mới, NestJS module, controller, service, provider, app.module, backend module, thêm phân hệ, api-gateway, dto, schema, Injectable, forRoot, forFeature.
---

# Kỹ năng: Cấu trúc module NestJS trong ViGov
# Mức: CAO | Ngăn: module lệch chuẩn, phụ thuộc vòng, biến môi trường đọc lung tung

## KHI NÀO DÙNG

- Thêm một module nghiệp vụ mới vào `backend/apps/api-gateway/src/modules/`
- Sửa cấu trúc một module đang có
- Không biết đặt tệp mới vào đâu

## Cấu trúc chuẩn một module

```
modules/<ten-module>/
  <ten-module>.module.ts        // khai báo, import, export
  <ten-module>.controller.ts    // chỉ định tuyến + quyền + gọi service
  <ten-module>.service.ts       // toàn bộ nghiệp vụ
  <ten-module>.schema.ts        // schema Mongoose (nếu module có collection riêng)
  <ten-module>.service.spec.ts  // test đơn vị cho nghiệp vụ
  dto/                          // DTO vào/ra, mỗi tệp một DTO
```

Module lớn có nhiều nhóm việc thì chia thư mục con theo **nghiệp vụ**, không theo lớp kỹ
thuật — xem `modules/integrations/{geo,ocr,idcard}/` làm mẫu.

## MUST

| # | Luật |
|---|------|
| 1 | Controller **mỏng**: đọc `req.user`, gọi service, trả kết quả. Không nghiệp vụ trong controller |
| 2 | Mỗi route khai báo `@RequirePermission(...)` hoặc `@Public()` — không có mặc định ngầm → `rules/critical/phan-quyen-rbac.md` |
| 3 | Đọc cấu hình qua `ConfigService.get('<đường.dẫn>')`, khai báo trước ở `libs/shared/src/config/configuration.ts` |
| 4 | Kiểu và tiện ích dùng chung đặt ở `libs/shared`, import qua alias `@vigov/shared` |
| 5 | Đăng ký module vào `apps/api-gateway/src/app.module.ts` — và **chỉ** ở đó |
| 6 | Schema Mongoose đăng ký bằng `MongooseModule.forFeature([...])` trong module sở hữu collection đó |
| 7 | Module cần đọc dữ liệu của module khác → import module đó và tiêm service, **không** tự khai báo lại schema của người khác |
| 8 | Tên tệp, tên thư mục: kebab-case tiếng Anh không dấu. Nội dung comment tiếng Việt |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đọc `process.env` trực tiếp trong service/controller |
| 2 | Khai báo cùng một schema Mongoose ở hai module (hai model khác nhau trên cùng collection → ghi lệch nhau) |
| 3 | Import chéo hai chiều giữa hai module nghiệp vụ (phụ thuộc vòng) — tách phần chung ra `libs/shared` |
| 4 | Đặt logic nghiệp vụ vào interceptor/guard/pipe |
| 5 | Tạo `apps/<service-moi>` mới — Phase 1 chỉ có **một** app là `api-gateway` |
| 6 | Export schema/model ra ngoài module để module khác `findOne` trực tiếp |

## Module nghiệp vụ hiện có

`audit` `auth` `catalogs` `content` `disbursement` `documents` `dossiers` `feedback`
`files` `integrations` `map` `messaging` `notification` `realtime` `reports` `search`
`settings` `tasks` `users` `workflow` `zalo-webhook`

→ chi tiết vai trò từng module: `data/modules.json`

## Sau khi thêm module

1. `npm run typecheck` trong `backend/` — sạch lỗi
2. Test đơn vị cho nghiệp vụ mới → `skills/kiem-thu-vigov`
3. Cập nhật `backend/README.md` và `docs/01-BACKEND.md` → `skills/tai-lieu-dong-bo`
4. Endpoint mới → cập nhật `docs/01-BACKEND.md` bảng endpoint

→ `skills/api-contract-design` · `skills/mongoose-schema-conventions` · `skills/dto-validation-hardening`
