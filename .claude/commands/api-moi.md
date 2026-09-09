---
description: Thiết kế và triển khai một endpoint API mới cho ViGov theo quy trình đầy đủ
argument-hint: "<mô tả endpoint, ví dụ: cán bộ đóng phiếu phản ánh kèm ảnh nghiệm thu>"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# /api-moi

Theo `workflows/them-endpoint.md`.

## Sáu câu hỏi TRƯỚC khi viết dòng mã đầu tiên

| # | Câu hỏi | Chưa trả lời được thì |
|---|---|---|
| 1 | **Ai gọi** — cán bộ hay công dân? | Hỏi. Hai mức tin cậy → hai đường riêng |
| 2 | **Quyền gì** — phân hệ nào, mức nào? Hay `@Public()`? | Hỏi. Không có mặc định ngầm |
| 3 | Đường công dân: **khoá cách ly** là gì? | `citizenPhone` từ phiên, không nhận từ client |
| 4 | Trả **trường nào**? Có dữ liệu cá nhân không? | Che ở tầng service trước khi trả |
| 5 | Lọc theo trường nào? Đã có **index** chưa? | Thêm index |
| 6 | Có **ghi dữ liệu** không? | Phải là POST/PATCH/PUT/DELETE để `AuditInterceptor` bắt được |

## Bước

1. Đường dẫn + phương thức theo `skills/api-contract-design`
2. DTO: mọi trường có giới hạn; **không** khai trường client không được đặt
   (`citizenPhone`, `createdBy`, `status`, `deletedAt`, mã nghiệp vụ, `slaDeadline`)
3. Khai quyền tường minh trên route
4. Controller mỏng → service làm nghiệp vụ
5. Truy vấn: lọc chủ sở hữu **trong** truy vấn, `limit` có trần, `deletedAt: null`
6. Che dữ liệu cá nhân trước khi trả
7. Tên trường khớp `admin-web/src/types/index.ts`
8. Test: 401 · 403 · 200 (+ **404** cho đường công dân của người khác)
9. `npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json && npm test && npm run test:e2e`
10. Nối client nếu cần
11. Cập nhật bảng endpoint `docs/01-BACKEND.md`

## Ba cạm bẫy

| Cạm bẫy | Đúng phải là |
|---|---|
| Trả **403** khi bản ghi không thuộc người gọi | **404** — 403 tiết lộ bản ghi tồn tại |
| Một route cho cả cán bộ và công dân, phân nhánh bằng `if` | Hai route, hai hàm service riêng |
| Nhận `status` từ body để đổi trạng thái | `POST /<tài-nguyên>/:id/<hành-động>` riêng |

## Mã lỗi

400 dữ liệu không hợp lệ · 401 chưa đăng nhập · 403 không đủ quyền ·
404 không tồn tại **hoặc không thuộc quyền xem** · 409 xung đột trạng thái · 429 quá hạn mức

Thông báo lỗi bằng tiếng Việt, nói người dùng làm gì tiếp.

→ `workflows/them-endpoint` · `skills/api-contract-design` · `agents/api-backend`
