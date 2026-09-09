---
name: api-contract-design
description: Dùng khi thiết kế hoặc sửa endpoint REST của backend — đường dẫn, phương thức, dạng dữ liệu trả về, phân trang, mã lỗi, phân tách đường cán bộ và đường công dân. Kích hoạt bởi: endpoint, REST, API mới, route, đường dẫn, GET POST PATCH DELETE, phân trang, pagination, mã lỗi, HTTP status, contract, hợp đồng API, trả về gì.
---

# Kỹ năng: Thiết kế hợp đồng API
# Mức: CAO | Ngăn: API lệch chuẩn giữa các phân hệ, client 4 module gọi sai

## Cấu trúc đường dẫn

Tiền tố: `API_PREFIX` (mặc định `api/v1`) — **không** viết cứng trong client.

| Nhóm | Mẫu đường dẫn | Ai gọi |
|---|---|---|
| Cán bộ (mặc định) | `/<phân-hệ>` · `/<phân-hệ>/:id` | Web Quản trị |
| Công dân | `/<phân-hệ>/citizen/**` | Mini App, Flutter |
| Công khai (không đăng nhập) | `/<phân-hệ>/public/**` hoặc `@Public()` có comment | Bất kỳ |
| Hệ thống | `/health`, `/health/ready` | Hạ tầng |
| Webhook bên ngoài | `/zalo-webhook/**` | Zalo |

**Không** trộn đường cán bộ và đường công dân trên cùng một route rồi phân nhánh bằng
`if` — hai mức tin cậy khác nhau phải là hai đường khác nhau.
→ `rules/critical/cach-ly-du-lieu-cong-dan.md`

## MUST

| # | Luật |
|---|------|
| 1 | Tài nguyên đặt tên **danh từ số nhiều, kebab-case**: `/documents`, `/feedback`, `/staff-users` |
| 2 | Phương thức đúng nghĩa: `GET` đọc thuần (không đổi dữ liệu), `POST` tạo, `PATCH` sửa một phần, `PUT` thay toàn bộ, `DELETE` xoá mềm |
| 3 | Danh sách trả `{ items, total, page, size }` — cùng một hình dạng ở mọi phân hệ |
| 4 | Tham số phân trang: `page` (từ 1), `size` (mặc định 20, **trần cứng 100**) |
| 5 | Tra cứu chi tiết dùng **mã nghiệp vụ** (`code`, `arrivalNo`) khi có, không dùng `_id` |
| 6 | Mã lỗi: 400 dữ liệu không hợp lệ · 401 chưa đăng nhập · 403 không đủ quyền · 404 không tồn tại **hoặc không thuộc quyền xem** · 409 xung đột trạng thái · 429 quá hạn mức |
| 7 | Thông báo lỗi bằng tiếng Việt, hướng người dùng làm gì tiếp → `rules/critical/ngon-ngu-hanh-chinh.md` |
| 8 | Thao tác không tự nhiên (phê duyệt, chuyển xử lý, đóng phiếu) là `POST /<tài-nguyên>/:id/<hành-động>` — động từ tiếng Anh, kebab-case |
| 9 | Trường trả về **khớp tên** với `admin-web/src/types/index.ts` → `skills/dong-bo-kieu-4-module` |
| 10 | Endpoint mới → cập nhật bảng endpoint trong `docs/01-BACKEND.md` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Trả 403 khi bản ghi không thuộc người gọi — phải 404 (403 tiết lộ bản ghi đó tồn tại) |
| 2 | Đổi dữ liệu bằng `GET` (nhật ký thao tác không bắt, và proxy có thể cache) |
| 3 | Trả `_id`/ObjectId cho client công dân khi mã nghiệp vụ đã đủ |
| 4 | Đặt dữ liệu cá nhân vào query string hoặc đường dẫn → `rules/critical/du-lieu-ca-nhan.md` |
| 5 | Endpoint trả danh sách không phân trang |
| 6 | Trả thông báo lỗi của Mongo/SDK/stack trace ra client |
| 7 | Đổi tên trường trả về của endpoint đang có mà không sửa **cả 4 module** cùng lượt |
| 8 | Thêm tham số lọc mới mà không thêm index cho trường đó |

## Mẫu controller

```ts
@Controller('feedback')
export class FeedbackController {
  /** Danh sách phản ánh cho cán bộ — số điện thoại công dân đã che */
  @Get()
  @RequirePermission('feedback', 'view')
  list(@Query() query: ListFeedbackQueryDto) {
    return this.feedback.list(query);
  }

  /** Phản ánh của chính công dân đang đăng nhập — lọc theo phiên, KHÔNG nhận số từ client */
  @Get('citizen/mine')
  listMine(@Req() req: AuthedRequest, @Query() query: ListFeedbackQueryDto) {
    return this.feedback.listMine(req.user!.username, query);
  }
}
```

→ `skills/dto-validation-hardening` · `skills/nestjs-module-pattern` · `rules/critical/phan-quyen-rbac.md`
