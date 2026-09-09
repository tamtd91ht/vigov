---
description: Dựng một module nghiệp vụ mới cho backend ViGov theo đúng khuôn — hoặc một phân hệ mới cho Web Quản trị
argument-hint: "<tên-module-kebab-case> [backend|admin-web|both]"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# /module-moi

## Trả lời trước khi dựng

| # | Câu hỏi |
|---|---|
| 1 | Module này thuộc **nghiệp vụ** nào? Có trong `data/glossary.md` chưa? |
| 2 | Có collection riêng không, hay đọc dữ liệu của module khác? |
| 3 | Ai dùng: cán bộ (vai trò nào, phân hệ nào) hay công dân? |
| 4 | Có dữ liệu cá nhân không? → `workflows/xu-ly-du-lieu-ca-nhan.md` |
| 5 | Đã có module nào làm việc tương tự chưa? → `skills/ke-thua-truoc-khi-viet-moi` |

## Backend — cấu trúc

```
backend/apps/api-gateway/src/modules/<ten-module>/
  <ten-module>.module.ts        // khai báo, import, export
  <ten-module>.controller.ts    // định tuyến + quyền, KHÔNG nghiệp vụ
  <ten-module>.service.ts       // toàn bộ nghiệp vụ
  <ten-module>.schema.ts        // schema Mongoose (nếu có collection riêng)
  <ten-module>.service.spec.ts  // test đơn vị
  dto/                          // mỗi tệp một DTO
```

Bước:

1. Dựng thư mục theo khuôn trên
2. Schema: `timestamps: true`, tên collection snake_case tường minh, trường bắt buộc
   (`createdBy`, mã nghiệp vụ, `deletedAt`) → `skills/mongoose-schema-conventions`
3. Controller: mỗi route khai `@RequirePermission(...)` hoặc `@Public()` kèm lý do
4. Đăng ký `MongooseModule.forFeature([...])` trong module sở hữu collection
5. Đăng ký module vào `apps/api-gateway/src/app.module.ts` — **chỉ** ở đó
6. Biến môi trường mới → `configuration.ts` + `.env.local` + `.env.example`
7. Test 401 / 403 / 200
8. `npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json && npm test`
9. Cập nhật `docs/01-BACKEND.md` + `.claude/data/modules.json`

→ `skills/nestjs-module-pattern`

## Admin-web — phân hệ mới

1. Thêm khoá phân hệ vào `MODULES` ở `libs/shared/src/auth/roles.ts` **và** `roles.config.ts`
2. Cấp quyền cho **cả 5 vai trò** — không để `undefined`
3. Thêm vào `nav.config.ts`
4. Trạng thái / danh mục mới → `status.config.ts`
5. Kiểu dữ liệu → `src/types/index.ts` (**nguồn chuẩn** cho cả 4 module)
6. `src/features/<phân-hệ>/` + `src/app/(dashboard)/<phân-hệ>/page.tsx`
7. Bảo vệ route ở **tầng máy chủ**, không chỉ `AuthGuard` phía client
8. `npx tsc --noEmit && npm run lint`
9. Cập nhật `docs/02-ADMIN-WEB.md`

→ `skills/nextjs-admin-web`

## KHÔNG BAO GIỜ

- Tạo `apps/*` mới — Phase 1 chỉ có **một** app là `api-gateway`
- Khai lại schema của module khác (hai model trên cùng collection → ghi lệch nhau)
- Import chéo hai chiều giữa hai module nghiệp vụ
- Đọc `process.env` trực tiếp
- Thêm phân hệ mà bỏ trống quyền của một vai trò

→ `skills/nestjs-module-pattern` · `agents/api-backend`
