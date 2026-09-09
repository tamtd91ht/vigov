---
description: Rà soát thay đổi đang có trên nhánh — đúng luật ViGov, đúng phạm vi, có test, có tài liệu
argument-hint: "[nhánh gốc để so, mặc định main]"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /ra-soat-diff

Rà **thay đổi**, không rà toàn dự án. Dùng trước khi commit hoặc trước khi mở PR.

## Lấy thay đổi

```bash
BASE="${1:-main}"
git status --short
git diff --stat "$BASE"...HEAD
git diff "$BASE"...HEAD
git diff                    # chưa staged
git diff --cached           # đã staged
```

## Bảy trục rà

| # | Trục | Kiểm gì |
|---|------|---|
| 1 | **Đúng phạm vi** | Có tệp nào bị sửa mà không liên quan yêu cầu? Có refactor kèm? Có đổi format? |
| 2 | **Dữ liệu cá nhân** | Log PII mới? Trả số chưa che? Trường nhạy cảm mới thiếu trong `REDACTED_FIELDS`? |
| 3 | **Phân quyền** | Route mới có khai quyền? Đường công dân có lọc chủ sở hữu **trong** truy vấn? |
| 4 | **Bảo toàn dữ liệu** | Có xoá cứng? Truy vấn mới thiếu `deletedAt: null`? Đổi schema có `default` an toàn? |
| 5 | **Bí mật và cấu hình** | Secret hardcode? Biến mới có ở **cả hai** tệp env + `configuration.ts` (+ Docker)? |
| 6 | **Không hardcode** | Giá trị riêng của một xã (tên, URL, SLA, toạ độ) nằm ngoài `config/`? |
| 7 | **Tiếng Việt** | Chuỗi mới có dấu, đúng chính tả, đúng thuật ngữ? Còn tiếng Anh? Có emoji trên Web Quản trị? |

## Kiểm kèm

| # | Việc |
|---|------|
| 8 | **Có test** cho hành vi mới? Test có bị `skip` không? |
| 9 | **Đã chạy** `npm run check:all` + test module đã sửa? |
| 10 | **Tài liệu** đã cập nhật theo bảng tra ở `skills/tai-lieu-dong-bo`? |
| 11 | Đổi trường có sửa **cả 4 module** trong cùng thay đổi này? |
| 12 | Có `.env*` nào bị staged ngoài `.env.example`? |
| 13 | Có tệp rác bị thêm (`img.png`, `.bak`, `dist/`, tệp tạm)? |

## Định dạng báo cáo

```
### Chặn commit
| # | Vấn đề | Tệp:dòng | Việc phải làm |

### Nên sửa trước khi commit
### Ngoài phạm vi (nên tách ra khỏi thay đổi này)
### Đã kiểm và đạt
### Chưa kiểm được (và vì sao)
```

Mỗi vấn đề "chặn commit" phải nói **hậu quả cụ thể**, không chỉ nói "vi phạm luật X".

## KHÔNG BAO GIỜ

- Tự commit trong lệnh này
- Bỏ qua tệp bị sửa ngoài phạm vi mà không nêu ra
- Đánh giá "đạt" khi chưa chạy được lệnh kiểm chứng — nói rõ là chưa chạy

→ `agents/ra-soat-bao-mat` · `commands/git-commit` · `rules/_INDEX.md`
