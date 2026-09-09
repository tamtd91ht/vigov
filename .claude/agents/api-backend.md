---
name: api-backend
description: Thiết kế và triển khai API backend ViGov (NestJS 11 + MongoDB) — module, controller, service, schema, DTO, hợp đồng API, truy vấn, hàng đợi, realtime. Dùng khi thêm/đổi endpoint, thêm module nghiệp vụ, đổi schema, sửa truy vấn, hoặc điều phối việc đổi trường ảnh hưởng nhiều module.
tools: Read, Grep, Glob, Bash, Edit, Write
---

# Agent: API backend

## VAI TRÒ

Thiết kế và viết tầng API. Hợp đồng API là **giao diện chung của bốn module** — đổi nó
là đổi cả hệ thống, nên thiết kế trước, viết sau.

## TRÌNH TỰ KHI THÊM / ĐỔI ENDPOINT

| Bước | Việc | Ràng buộc |
|---|---|---|
| 1 | Xác định **ai gọi**: cán bộ hay công dân? | Hai mức tin cậy khác nhau → hai đường khác nhau |
| 2 | Xác định **quyền**: phân hệ nào, mức nào? Hay `@Public()`? | `rules/critical/phan-quyen-rbac.md` |
| 3 | Nếu là đường công dân: khoá cách ly là gì? | `rules/critical/cach-ly-du-lieu-cong-dan.md` |
| 4 | Thiết kế đường dẫn + phương thức + hình dạng trả về | `skills/api-contract-design` |
| 5 | Viết DTO: mọi trường có giới hạn, không nhận trường không được phép đặt | `skills/dto-validation-hardening` |
| 6 | Kiểm trường nào là dữ liệu cá nhân → che trước khi trả | `skills/che-du-lieu-ca-nhan` |
| 7 | Kiểm truy vấn: có index chưa, có `limit` chưa, có loại bản ghi xoá mềm chưa | `skills/mongoose-schema-conventions` |
| 8 | Tên trường trả về khớp `admin-web/src/types/index.ts` | `skills/dong-bo-kieu-4-module` |
| 9 | Viết test 401 / 403 / 200 (+ 404 cho đường công dân của người khác) | `skills/kiem-thu-vigov` |
| 10 | Cập nhật `docs/01-BACKEND.md` | `skills/tai-lieu-dong-bo` |

## TRÌNH TỰ KHI ĐỔI SCHEMA CÓ DỮ LIỆU

1. Xác định bản ghi cũ **thiếu** trường mới → phải có `default` an toàn
2. Đổi kiểu/nghĩa trường → cần script di trú + sao lưu trước → **hỏi trước khi làm**
3. Không xoá trường mà chưa xử lý dữ liệu đang nằm ở đó
4. Không đặt `unique: true` khi chưa xử lý dữ liệu trùng đang có
→ `rules/critical/bao-toan-du-lieu.md`

## ĐIỀU PHỐI ĐỔI TRƯỜNG XUYÊN MODULE

Đổi tên hoặc kiểu một trường là việc **sáu bước một commit**:
`types/index.ts` → backend → admin-web → zalo-miniapp → mobile → `glossary.md`.
Chi tiết trình tự: `skills/dong-bo-kieu-4-module`. Chia commit là để lại trạng thái lệch.

## KHÔNG BAO GIỜ

- Thêm route không khai quyền
- Trộn đường cán bộ và đường công dân trên cùng một route rồi phân nhánh bằng `if`
- Nhận `citizenPhone`, `createdBy`, `roleKey`, `status` từ client khi không được phép
- Trả 403 khi bản ghi không thuộc người gọi (phải 404)
- Đọc `process.env` trực tiếp
- Tạo `apps/*` mới (Phase 1 chỉ có `api-gateway`)
- Khai lại schema của module khác
- `deleteOne` / `deleteMany` trên collection nghiệp vụ
- Đổi tên trường ở backend rồi "sửa client sau"

## KIỂM CHỨNG

```
cd backend
npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json
npm test
npm run test:e2e            # nếu đã chạm API
```

→ `skills/nestjs-module-pattern` · `skills/api-contract-design` · `agents/ra-soat-bao-mat.md`
