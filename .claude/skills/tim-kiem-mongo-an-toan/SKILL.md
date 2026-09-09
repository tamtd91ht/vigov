---
name: tim-kiem-mongo-an-toan
description: Dùng khi viết tìm kiếm, lọc theo từ khoá, tìm kiếm toàn cục, $regex, $text index, aggregate, thống kê. Kích hoạt bởi: tìm kiếm, search, regex, $regex, $text, escape, aggregate, thống kê, báo cáo số liệu, lọc từ khoá, full text, index text, truy vấn chậm.
---

# Kỹ năng: Tìm kiếm và truy vấn Mongo an toàn
# Mức: CAO | Ngăn: injection qua regex, truy vấn treo máy chủ, thống kê sai

## MUST

| # | Luật |
|---|------|
| 1 | Chuỗi người dùng nhập ghép vào `$regex` **phải** escape ký tự đặc biệt trước. Users, Feedback, Search hiện đã escape — theo đúng cách đó |
| 2 | `$regex` luôn kèm neo đầu (`^`) hoặc giới hạn độ dài từ khoá (≤ 100 ký tự) — regex không neo trên collection lớn là quét toàn bảng |
| 3 | Tìm kiếm toàn văn dùng `$text` + text index; `$regex` chỉ cho tìm theo tiền tố (mã hồ sơ, số điện thoại) |
| 4 | Mọi truy vấn danh sách có `limit` với trần cứng |
| 5 | `aggregate` đặt `$match` **đầu tiên**, có bộ lọc chủ sở hữu/trạng thái trước khi `$group` |
| 6 | Tìm kiếm toàn cục (`/search`) chỉ trả tài nguyên mà **vai trò người gọi được xem** — lọc theo quyền, không lọc sau |
| 7 | Tìm kiếm của công dân chỉ quét dữ liệu của chính họ → `rules/critical/cach-ly-du-lieu-cong-dan.md` |
| 8 | Thêm trường vào bộ lọc → thêm index cho trường đó |
| 9 | Thống kê dùng `countDocuments` có bộ lọc, không `find().length` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | `new RegExp(userInput)` hoặc `{ $regex: userInput }` không escape |
| 2 | `$where` — cho phép chạy JavaScript trên máy chủ Mongo |
| 3 | Nhận toán tử Mongo từ client (`{ $ne: null }` gửi qua body lọt vào truy vấn) — DTO chặn bằng `@IsString` |
| 4 | `$regex` với `.*` ở đầu trên collection > 10.000 bản ghi |
| 5 | Phân trang sâu bằng `skip(n)` với `n` lớn |
| 6 | `aggregate` không `$match` đầu tiên |
| 7 | Thống kê gộp trên toàn bộ collection rồi lọc ở tầng ứng dụng |
| 8 | Bỏ `deletedAt: null` khỏi bộ lọc thống kê — hồ sơ đã xoá sẽ vào báo cáo |

## Mẫu escape

```ts
/**
 * Escape ký tự đặc biệt của regex trước khi ghép vào truy vấn.
 * VÌ SAO: từ khoá `.*` hay `(a+)+` do người dùng nhập sẽ thành regex quét toàn
 * bảng hoặc regex thảm hoạ (ReDoS) làm treo tiến trình Node.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const keyword = escapeRegex(query.q.trim()).slice(0, 100);
const filter = keyword
  ? { deletedAt: null, code: { $regex: `^${keyword}`, $options: 'i' } }
  : { deletedAt: null };
```

## Lưu ý về text index trong test

Test e2e backend có thể lỗi `text index required for $text query` khi ổ đĩa chứa thư mục
tạm còn dưới 500 MB — MongoDB từ chối tạo index. Dọn ổ, hoặc trỏ `TEMP`/`TMP` sang ổ khác.
→ `README.md` bảng xử lý sự cố

→ `skills/mongoose-schema-conventions` · `skills/dto-validation-hardening` · `skills/bao-cao-va-xuat-file`
