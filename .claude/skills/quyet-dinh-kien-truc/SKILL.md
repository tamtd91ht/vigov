---
name: quyet-dinh-kien-truc
description: Dùng khi có một quyết định kiến trúc hoặc kỹ thuật đáng tranh luận cần ghi lại — chọn công nghệ, đánh đổi, thay đổi cách làm. Kích hoạt bởi: ADR, quyết định kiến trúc, đánh đổi, tradeoff, vì sao chọn, architecture decision, ghi lại quyết định, thay đổi cách làm.
---

# Kỹ năng: Ghi lại quyết định kiến trúc (ADR)
# Mức: TRUNG BÌNH | Ngăn: sáu tháng sau không ai biết vì sao chọn như vậy

## Khi nào phải ghi ADR

Ghi khi quyết định có **ít nhất một** đặc điểm sau:

- Có phương án khác hợp lý mà ta đã bỏ
- Khó đảo ngược (đổi lại phải viết lại nhiều mã, hoặc phải di trú dữ liệu)
- Đánh đổi một thứ để lấy một thứ khác (ví dụ: chọn Mongo lưu OTP thay Redis để **không
  thêm một dịch vụ phải dựng/bảo mật/sao lưu**)
- Ảnh hưởng tới bảo mật, dữ liệu cá nhân, hay khả năng bàn giao
- Nhận một rủ ro có điều kiện (ví dụ: trả mật khẩu tạm trong phản hồi HTTP, chấp nhận
  được **chỉ khi** đã bật HTTPS)

**Không** ghi ADR cho: chọn tên biến, cách format, sửa lỗi thường, việc đã có luật quy định.

## Nơi ghi

`docs/quyet-dinh/NNNN-<slug-tiếng-việt-không-dấu>.md`, `NNNN` là số tăng dần bốn chữ số.

## Khuôn mẫu

```markdown
# NNNN — <Tên quyết định>

- Ngày: dd/MM/yyyy
- Trạng thái: Đề xuất | Đã chốt | Đã thay thế bởi NNNN
- Người quyết định: <ai>
- Task liên quan: <mã task> · Câu hỏi mở liên quan: <#n hoặc "không">

## Bối cảnh
Vấn đề gì buộc phải quyết định. Ràng buộc thật (ngân sách, hạ tầng khách hàng có,
quy định pháp lý, thời gian).

## Quyết định
Chọn gì. Viết ở thể khẳng định: "ViGov lưu mã OTP trong MongoDB, không dùng Redis."

## Hệ quả
Được gì. Mất gì. Việc phải làm thêm. Rủi ro đã nhận và điều kiện để rủi ro đó chấp nhận được.

## Phương án đã bỏ
Từng phương án + vì sao bỏ. Đây là phần có giá trị nhất khi đọc lại sau này.
```

## MUST

| # | Luật |
|---|------|
| 1 | ADR ghi bằng tiếng Việt, đúng thuật ngữ |
| 2 | Ghi cả **phương án đã bỏ** và lý do — thiếu phần này thì ADR chỉ là mô tả hiện trạng |
| 3 | Ghi rõ **rủi ro đã nhận** và **điều kiện** để nó chấp nhận được |
| 4 | Quyết định đổi sau này → tạo ADR **mới**, đặt ADR cũ thành "Đã thay thế bởi NNNN". Không sửa ADR cũ |
| 5 | ADR liên quan tới dữ liệu cá nhân hay bảo mật → dẫn chiếu chéo với `SECURITY.md` |
| 6 | Quyết định phụ thuộc câu hỏi mở của khách → ghi rõ là **giả định tạm**, không phải quyết định cuối |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Sửa hoặc xoá ADR đã chốt |
| 2 | Ghi giá trị secret, dữ liệu cá nhân, hay IP máy chủ nội bộ vào ADR |
| 3 | Ghi ADR thay cho việc hỏi khách hàng khi đó là quyết định của khách |
| 4 | Viết ADR dài quá 100 dòng — nếu cần dài hơn, phần chi tiết kỹ thuật đưa sang `docs/` |

## Quyết định đã có trong dự án nhưng chưa thành ADR

Những chỗ này đang ghi rải trong comment mã và `SECURITY.md`. Khi chạm vào, gom thành ADR:

| Quyết định | Đang ghi ở |
|---|---|
| Lưu OTP trong Mongo thay Redis (để không thêm dịch vụ phải bảo mật/sao lưu) | `SECURITY.md` TB-08 · `configuration.ts` |
| Tự viết security header thay dùng helmet | `security.middleware.ts` |
| Ghim `maplibre-gl` 5.24.0 (bản 6 làm bản đồ trắng, không báo lỗi) | commit `fix(bản đồ)` |
| Không nâng `exceljs` / `zmp-sdk` dù `npm audit` cảnh báo | `SECURITY.md` mục 3 |
| Coi chuỗi rỗng là chưa đặt khi đọc biến môi trường | `app.config.ts` |

→ `skills/tai-lieu-dong-bo` · `commands/quyet-dinh`
