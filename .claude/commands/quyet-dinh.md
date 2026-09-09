---
description: Ghi lại một quyết định kiến trúc ViGov thành ADR trong docs/quyet-dinh/
argument-hint: "<tên quyết định, ví dụ: lưu OTP trong Mongo thay Redis>"
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# /quyet-dinh

Ghi ADR (Architecture Decision Record) vào `docs/quyet-dinh/NNNN-<slug>.md`.

## Có cần ADR không

Ghi khi quyết định có **ít nhất một** đặc điểm:

- Có phương án khác hợp lý mà ta đã bỏ
- Khó đảo ngược (đổi lại phải viết lại nhiều mã, hoặc phải di trú dữ liệu)
- Đánh đổi một thứ để lấy một thứ khác
- Ảnh hưởng bảo mật, dữ liệu cá nhân, hay khả năng bàn giao
- **Nhận một rủi ro có điều kiện**

**Không** ghi cho: chọn tên biến, cách format, sửa lỗi thường, việc đã có luật quy định.

## Làm

1. `ls docs/quyet-dinh/` → lấy số kế tiếp (bốn chữ số). Thư mục chưa có thì tạo.
2. Viết theo khuôn dưới
3. Đối chiếu chéo: quyết định liên quan bảo mật → thêm dòng ở `SECURITY.md`

## Khuôn mẫu

```markdown
# NNNN — <Tên quyết định>

- Ngày: dd/MM/yyyy
- Trạng thái: Đề xuất | Đã chốt | Đã thay thế bởi NNNN
- Người quyết định: <ai>
- Task liên quan: <mã task> · Câu hỏi mở liên quan: <#n hoặc "không">

## Bối cảnh
Vấn đề gì buộc phải quyết định. Ràng buộc THẬT: ngân sách, hạ tầng khách hàng có,
quy định pháp lý, thời gian.

## Quyết định
Viết ở thể khẳng định: "ViGov lưu mã OTP trong MongoDB, không dùng Redis."

## Hệ quả
Được gì. Mất gì. Việc phải làm thêm. Rủi ro đã nhận và ĐIỀU KIỆN để rủi ro đó
chấp nhận được.

## Phương án đã bỏ
Từng phương án + vì sao bỏ. Đây là phần có giá trị nhất khi đọc lại sau này.
```

## MUST

- Tiếng Việt, đúng thuật ngữ
- Ghi **cả phương án đã bỏ** và lý do — thiếu phần này thì ADR chỉ là mô tả hiện trạng
- Ghi rõ **rủi ro đã nhận** và **điều kiện** để nó chấp nhận được
- Quyết định phụ thuộc câu hỏi mở của khách → ghi rõ là **giả định tạm**
- Trần 100 dòng; dài hơn thì phần kỹ thuật đưa sang `docs/`

## KHÔNG BAO GIỜ

- Sửa hoặc xoá ADR đã chốt — tạo ADR mới, đặt ADR cũ thành "Đã thay thế bởi NNNN"
- Ghi giá trị secret, dữ liệu cá nhân, hay IP máy chủ nội bộ vào ADR
- Ghi ADR **thay cho** việc hỏi khách hàng khi đó là quyết định của khách

## Quyết định đã có nhưng chưa thành ADR

| Quyết định | Đang ghi ở |
|---|---|
| Lưu OTP trong Mongo thay Redis (để không thêm dịch vụ phải bảo mật/sao lưu) | `SECURITY.md` TB-08 · `configuration.ts` |
| Tự viết security header thay dùng helmet | `security.middleware.ts` |
| Ghim `maplibre-gl` 5.24.0 | commit `fix(bản đồ)` |
| Không nâng `exceljs` / `zmp-sdk` dù `npm audit` cảnh báo | `SECURITY.md` mục 3 |
| Coi chuỗi rỗng là chưa đặt khi đọc biến môi trường | `app.config.ts` |
| Tách `idcard` khỏi `ocr` vì ràng buộc NĐ 13/2023 | `configuration.ts` |

→ `skills/quyet-dinh-kien-truc`
