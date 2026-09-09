---
description: Thực hiện một task ViGov theo quy trình đầy đủ — làm, test, rà bảo mật, đồng bộ tài liệu
argument-hint: "[mã task hoặc mô tả việc cần làm]"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
---

# /thuc-hien

Làm việc theo `workflows/tinh-nang-moi.md`. Lệnh này là đường chính khi bắt tay code.

## Đầu vào

`$ARGUMENTS` = mã task (`P5-11`) hoặc mô tả việc.

## Trình tự bắt buộc

| # | Việc | Không được bỏ |
|---|------|---|
| 1 | Đọc task + plan (nếu có mã task). Chưa có phân tích thì chạy `/phan-tich-task` trước | |
| 2 | **Nêu giả định** và câu hỏi mở đang chạm tới | ✅ |
| 3 | Nêu kế hoạch `1. [bước] → kiểm chứng: [cách xác nhận]` | ✅ |
| 4 | Đổi trạng thái task sang `in-progress` | nếu có mã task |
| 5 | Làm từng bước. Đọc mã lân cận trước khi sửa | |
| 6 | Viết test cho hành vi mới | ✅ |
| 7 | Chạy kiểm chứng thật | ✅ |
| 8 | Rà soát bảo mật nếu chạm dữ liệu / quyền / tệp / cấu hình | ✅ |
| 9 | Đồng bộ tài liệu | ✅ |
| 10 | Báo cáo trung thực | ✅ |

## Kiểm chứng (bước 7)

```
npm run check:all                      # gốc — type-check + lint cả 4 module
cd backend && npm test                 # nếu đã sửa backend
cd backend && npm run test:e2e         # nếu đã chạm API
cd mobile && flutter analyze && flutter test   # nếu đã sửa Flutter
```

Dán **kết quả thật**. Test đỏ thì nói rõ đỏ ở đâu, không tóm thành "có lỗi".

## DỪNG và hỏi khi

- Yêu cầu có hai cách hiểu dẫn tới hai kết quả khác nhau
- Chạm một câu hỏi mở của khách hàng
- Cần thêm trường dữ liệu cá nhân mới → `workflows/xu-ly-du-lieu-ca-nhan.md`
- Cần đổi kiểu/nghĩa trường đang có dữ liệu
- Cần nới một chốt bảo mật
- Cần gửi dữ liệu ra dịch vụ ngoài mới → `workflows/tich-hop-ben-thu-ba.md`
- Không biết nghiệp vụ hành chính thật sự chạy thế nào

## Báo cáo cuối

```
### Đã làm
### Đã chạy — lệnh và kết quả
### Tài liệu đã cập nhật
### Giả định đã dùng
### Còn lại / chưa làm và vì sao
```

→ `workflows/tinh-nang-moi` · `agents/kien-truc-truong`
