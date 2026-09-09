---
name: mongoose-schema-conventions
description: Dùng khi tạo hoặc sửa schema Mongoose, thêm trường, thêm index, đặt TTL, xoá mềm, đổi kiểu dữ liệu, viết truy vấn Mongo. Kích hoạt bởi: schema, Mongoose, collection, index, TTL, timestamps, deletedAt, xoá mềm, soft delete, Prop, SchemaFactory, HydratedDocument, migration, đổi trường, thêm trường.
---

# Kỹ năng: Quy ước schema và truy vấn MongoDB
# Mức: CAO | Ngăn: mất dữ liệu, truy vấn chậm, hồ sơ đã xoá hiện lại

## KHI NÀO DÙNG

- Tạo collection mới hoặc thêm trường vào collection đang có
- Thêm index, đặt TTL
- Viết truy vấn danh sách / tìm kiếm / thống kê

## Trường bắt buộc trên mọi collection nghiệp vụ

| Trường | Kiểu | Vì sao |
|---|---|---|
| `createdAt`, `updatedAt` | Date | `@Schema({ timestamps: true })` — cần cho mọi báo cáo và truy vết |
| `createdBy` | string | Ai tạo — cán bộ (`username`) hoặc công dân (số điện thoại) |
| `code` hoặc mã nghiệp vụ | string, unique | Mã người dùng đọc được, in trên giấy. **Không** dùng `_id` làm mã nghiệp vụ |
| `deletedAt` (nếu có xoá) | Date, mặc định `null` | Xoá mềm → `rules/critical/bao-toan-du-lieu.md` |
| `deletedBy`, `deleteReason` | string | Ai xoá, vì sao |

Collection chứa dữ liệu của công dân thì **phải** có trường chủ sở hữu
(`citizenPhone` / `applicantPhone`) và index trên trường đó
→ `rules/critical/cach-ly-du-lieu-cong-dan.md`

## MUST

| # | Luật |
|---|------|
| 1 | `@Schema({ timestamps: true, collection: '<ten_snake_case>' })` — tên collection đặt tường minh, snake_case |
| 2 | Trường bí mật (`passwordHash`, `refreshTokenHash`, `otpHash`) khai `select: false` |
| 3 | Thêm trường mới **phải** có `default` an toàn — bản ghi cũ không có trường đó |
| 4 | Index cho mọi trường dùng để lọc thường xuyên: chủ sở hữu, trạng thái, `createdAt`, mã nghiệp vụ |
| 5 | Index tổ hợp đặt trường **lọc bằng** trước, trường **sắp xếp** sau (`{ citizenPhone: 1, createdAt: -1 }`) |
| 6 | Collection kỹ thuật ngắn hạn (`otp_codes`, `login_sessions`) dùng TTL index, không xoá bằng cron |
| 7 | Truy vấn danh sách **luôn** có giới hạn: `.limit(size)` với trần cứng (mặc định 20, trần 100) |
| 8 | Truy vấn trên collection có xoá mềm **luôn** kèm `deletedAt: null` |
| 9 | Chuỗi người dùng nhập ghép vào `$regex` **phải** escape trước → `skills/tim-kiem-mongo-an-toan` |
| 10 | Đổi kiểu/nghĩa trường đang có dữ liệu → script di trú + sao lưu trước, ghi vào `docs/` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | `deleteOne` · `deleteMany` · `findOneAndDelete` trên collection nghiệp vụ |
| 2 | `find()` không `limit`, `countDocuments()` không bộ lọc trên collection lớn |
| 3 | `updateMany` với bộ lọc rỗng |
| 4 | Lọc bằng JavaScript sau khi đã `find()` toàn bộ — lọc phải nằm trong truy vấn |
| 5 | `skip(n)` cho phân trang sâu — dùng phân trang theo mốc (`createdAt` < cursor) |
| 6 | Nhúng mảng không giới hạn vào document (timeline, comment) — mảng phải có trần, quá trần thì tách collection |
| 7 | Lưu tiền bằng `Number` dạng thập phân — lưu **số nguyên đơn vị đồng** |
| 8 | Lưu ngày dạng chuỗi — dùng `Date`, hiển thị mới định dạng |
| 9 | Đặt `unique: true` mà chưa xử lý dữ liệu trùng đang có (tạo index sẽ thất bại lặng lẽ) |

## Mẫu

```ts
@Schema({ timestamps: true, collection: 'feedback_tickets' })
export class FeedbackTicket {
  /** Mã phiếu in cho công dân — nguồn chuẩn để tra cứu, không dùng _id */
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  /** Chủ sở hữu — khoá cách ly dữ liệu công dân, mọi truy vấn phải lọc theo trường này */
  @Prop({ required: true, index: true })
  citizenPhone!: string;

  @Prop({ required: true, index: true, default: 'moi' })
  status!: string;

  /** Xoá mềm — hồ sơ hành chính không được xoá cứng */
  @Prop({ type: Date, default: null, index: true })
  deletedAt!: Date | null;
}
```

→ `rules/critical/bao-toan-du-lieu.md` · `skills/tim-kiem-mongo-an-toan` · `skills/sla-va-trang-thai`
