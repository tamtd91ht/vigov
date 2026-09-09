---
name: dto-validation-hardening
description: Dùng khi viết hoặc sửa DTO, xác thực dữ liệu vào, giới hạn độ dài, chống gán thêm thuộc tính, kiểm tra định dạng số điện thoại/mã hồ sơ. Kích hoạt bởi: DTO, class-validator, ValidationPipe, IsString, IsOptional, whitelist, forbidNonWhitelisted, xác thực đầu vào, validate, sanitize, giới hạn độ dài, mass assignment, injection.
---

# Kỹ năng: Xác thực và làm sạch dữ liệu vào
# Mức: CAO | Ngăn: gán thêm thuộc tính, injection, tấn công bằng dữ liệu quá lớn

## Cơ chế đã có

`main.ts` bật `ValidationPipe` toàn cục với `whitelist` + `forbidNonWhitelisted` +
`transform`. Nghĩa là: trường **không** khai trong DTO sẽ bị **từ chối** (400), không
phải bị bỏ qua. Đây là lá chắn chính chống gán thêm thuộc tính — đừng làm yếu nó.

`BODY_LIMIT` (mặc định `1mb`) giới hạn kích thước thân yêu cầu; tệp có hạn mức riêng
ở `STORAGE_MAX_FILE_SIZE`.

## MUST

| # | Luật |
|---|------|
| 1 | **Mọi** body và query của endpoint đi qua một class DTO — không nhận `any`, không đọc `req.body` trần |
| 2 | **Mọi** trường chuỗi có `@MaxLength(n)` với `n` cụ thể. Không có trường chuỗi vô hạn |
| 3 | Trường số có `@Min` / `@Max`; trường ngày dùng `@IsDateString` hoặc `@IsISO8601` |
| 4 | Enum nghiệp vụ (trạng thái, mức ưu tiên, lĩnh vực) dùng `@IsIn([...])` lấy từ **cấu hình**, không viết cứng danh sách trong DTO → `rules/critical/khong-hardcode.md` |
| 5 | Số điện thoại: `@Matches(/^0\d{9}$/)` — chuẩn hoá về dạng `0xxxxxxxxx` trước khi lưu |
| 6 | Mã nghiệp vụ, mã hồ sơ: `@Matches` với mẫu chặt, không nhận ký tự đặc biệt |
| 7 | Query phân trang dùng DTO chung có trần: `page ≥ 1`, `size ≤ 100` |
| 8 | Trường tải lên tệp: kiểm cả MIME và phần mở rộng, ở **cả** controller và service → `skills/an-toan-tep-upload` |
| 9 | Trường HTML/rich text: làm sạch trước khi lưu, không tin `class-validator` làm việc đó |
| 10 | Trường ObjectId: `@IsMongoId()` — tránh Mongo nhận chuỗi lạ rồi báo lỗi thô |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Tắt `whitelist` hoặc `forbidNonWhitelisted`, hoặc gọi `ValidationPipe` cục bộ với cấu hình lỏng hơn |
| 2 | Khai trường trong DTO mà endpoint không được phép cho client đặt: `status` khi chỉ cán bộ được đổi, `citizenPhone` ở đường công dân, `createdBy`, `_id`, `deletedAt` |
| 3 | Nhận thẳng object lồng nhau tuỳ ý (`@IsObject()` trần) — khai DTO con + `@ValidateNested` + `@Type` |
| 4 | Nhận mảng không giới hạn — `@ArrayMaxSize(n)` |
| 5 | Dùng `@IsOptional()` cho trường thật ra bắt buộc, rồi kiểm bằng `if` trong service |
| 6 | Nới `BODY_LIMIT` để "cho qua" một trường dài — sửa trường, không nới trần |
| 7 | Ghép chuỗi người dùng nhập vào `$regex`, `$where`, hay chuỗi truy vấn mà không escape |

## Trường KHÔNG BAO GIỜ nhận từ client

| Trường | Nguồn đúng |
|---|---|
| `citizenPhone` ở đường công dân | phiên (`req.user`) |
| `createdBy`, `updatedBy`, `actor` | phiên |
| `roleKey` khi tự đăng ký | quản trị viên cấp |
| `isPrivate = false` cho tệp nghiệp vụ | cưỡng chế `true` |
| `deletedAt`, `deletedBy` | đường xoá mềm riêng |
| `code` / mã nghiệp vụ khi tạo mới | hệ thống sinh |
| `slaDeadline`, `daysLeft` | hệ thống tính từ cấu hình SLA |

## Mẫu

```ts
export class CreateCitizenFeedbackDto {
  @IsIn(feedbackCategoryKeys)          // danh mục đọc từ cấu hình, không viết cứng
  category!: string;

  @IsString() @MaxLength(200)
  title!: string;

  @IsString() @MaxLength(5000)
  content!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsMongoId({ each: true })
  photoIds?: string[];

  // KHÔNG khai citizenPhone: lấy từ phiên đã xác thực
}
```

→ `skills/api-contract-design` · `skills/tim-kiem-mongo-an-toan` · `rules/critical/du-lieu-ca-nhan.md`
