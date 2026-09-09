# Quy trình: Thêm / đổi endpoint API

Dùng khi: thêm hoặc đổi một endpoint của backend.

## Trả lời trước khi viết dòng mã đầu tiên

| # | Câu hỏi | Nếu chưa trả lời được |
|---|---|---|
| 1 | **Ai gọi** — cán bộ hay công dân? | Hỏi. Hai mức tin cậy khác nhau → hai đường khác nhau |
| 2 | **Quyền gì** — phân hệ nào, mức nào? Hay `@Public()`? | Hỏi. Không có mặc định ngầm |
| 3 | Nếu là đường công dân: **khoá cách ly** là gì? | `citizenPhone` từ phiên — không nhận từ client |
| 4 | Trả về **những trường nào**? Có trường nào là dữ liệu cá nhân? | Che trước khi trả |
| 5 | Truy vấn lọc theo trường nào? Đã có **index** chưa? | Thêm index |
| 6 | Thao tác này có **ghi dữ liệu** không? Nhật ký bắt được chưa? | Phải là POST/PATCH/PUT/DELETE để `AuditInterceptor` bắt |

## Bước

| # | Việc | Kiểm chứng |
|---|---|---|
| 1 | Chọn đường dẫn + phương thức theo `skills/api-contract-design` | Khớp mẫu các phân hệ khác |
| 2 | Viết DTO: **mọi** trường có giới hạn; **không** khai trường client không được đặt | `skills/dto-validation-hardening` |
| 3 | Khai quyền: `@RequirePermission(...)` hoặc `@Public()` kèm comment lý do | Hook `rbac_audit_guard` không nhắc |
| 4 | Controller mỏng: đọc `req.user`, gọi service | Không có nghiệp vụ trong controller |
| 5 | Service: lọc chủ sở hữu **trong** truy vấn, `limit` có trần, loại `deletedAt` | `skills/mongoose-schema-conventions` |
| 6 | Che dữ liệu cá nhân **ở tầng service** trước khi trả | `skills/che-du-lieu-ca-nhan` |
| 7 | Tên trường trả về khớp `admin-web/src/types/index.ts` | `skills/dong-bo-kieu-4-module` |
| 8 | Test: 401 · 403 · 200 (+ **404** cho đường công dân của người khác) | `skills/kiem-thu-vigov` |
| 9 | `npx tsc --noEmit -p apps/api-gateway/tsconfig.app.json && npm test && npm run test:e2e` | Xanh |
| 10 | Nối client (nếu có): admin-web / zalo-miniapp / mobile | Type-check từng module |
| 11 | Cập nhật bảng endpoint `docs/01-BACKEND.md` | |

## Ba cạm bẫy hay gặp

| Cạm bẫy | Đúng phải là |
|---|---|
| Trả **403** khi bản ghi không thuộc người gọi | **404** — 403 tiết lộ bản ghi đó tồn tại |
| Một route dùng cho cả cán bộ và công dân, phân nhánh bằng `if` | Hai route riêng, hai hàm service riêng |
| Nhận `citizenPhone` / `status` / `createdBy` từ body | Lấy từ phiên; `status` chỉ đổi qua endpoint hành động riêng |

## Nếu đổi endpoint ĐANG CHẠY THẬT

Đổi tên trường hoặc bỏ trường là **thay đổi phá vỡ**. Client cũ (app đã cài trên máy
người dân) vẫn đang gọi. Cách làm:

1. Trả **cả hai** tên một thời gian
2. Cập nhật client, phát hành
3. Chờ đủ lâu để người dùng cập nhật app
4. Mới bỏ tên cũ

→ `workflows/_INDEX.md` · `skills/api-contract-design` · `agents/api-backend.md`
