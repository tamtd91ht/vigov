---
description: Tạo commit ViGov đúng quy ước — type(scope) tiếng Việt, kiểm tệp env, kiểm phạm vi
argument-hint: "[gợi ý về nội dung commit]"
allowed-tools: Read, Grep, Glob, Bash
---

# /git-commit

## Quy ước commit của dự án này

```
type(scope): mô tả bằng tiếng Việt
```

- **`type`**: `feat` · `fix` · `docs` · `refactor` · `test` · `chore`
- **`scope`**: mã task (`p3-26`), tên module (`admin-web`, `zalo`, `files`, `auth`), hoặc
  vùng nghiệp vụ bằng tiếng Việt (`bảo mật`, `vị trí`, `bản đồ`, `cấu hình`, `deploy`)
- **mô tả**: tiếng Việt, nói **kết quả nghiệp vụ**, không nói tên hàm

Ví dụ thật trong lịch sử dự án:

```
feat(p3-26): đổi mã định vị Zalo lấy toạ độ thật + vá hai chỗ nói dối
fix(bản đồ): ghim maplibre-gl 5.24.0 — bản 6 làm bản đồ trắng trơn không báo lỗi
fix(cấu hình): biến môi trường bỏ trống phải rơi về mặc định, không thành chuỗi rỗng
docs(khối E): đồng bộ tài liệu trạng thái với hiện trạng mã nguồn
```

## Kiểm TRƯỚC khi commit

```bash
git status --short
git diff --cached --stat
git diff --cached --name-only | grep -E '\.env' || echo "OK: không có tệp env"
git branch --show-current
```

| # | Kiểm | Nếu sai |
|---|------|---|
| 1 | Đang ở **nhánh riêng**, không phải `main` | Tạo nhánh trước: `git checkout -b <loại>/<slug>` |
| 2 | Không có tệp `.env*` nào staged ngoài `.env.example` | Bỏ khỏi staging. **Không** `git add -f` |
| 3 | Không có tệp rác (`img.png`, `.bak`, `dist/`, tệp tạm) | Bỏ khỏi staging |
| 4 | Thay đổi **đúng phạm vi** — không có refactor kèm, không đổi format | Tách commit |
| 5 | Đã chạy kiểm chứng | `/kiem-tra-build` |
| 6 | Tài liệu đã đồng bộ | `agents/dong-bo-tai-lieu` |
| 7 | Đổi trường thì **cả 4 module** trong cùng commit | Bổ sung |

## Làm

1. Chạy các lệnh kiểm ở trên
2. Đọc `git diff --cached` để hiểu thay đổi thật, **không** đoán từ tên tệp
3. Soạn thông điệp: một dòng tiêu đề; nếu cần thì thân commit giải thích **vì sao**
4. Đưa thông điệp cho người dùng xem
5. Chỉ commit khi người dùng đồng ý

## KHÔNG BAO GIỜ

- Commit khi người dùng chưa yêu cầu
- `git add -A` mà không xem `git status` trước
- `git add -f` bất kỳ tệp `.env*` nào ngoài `.env.example`
- Ghi **giá trị** secret hay dữ liệu cá nhân vào thông điệp commit (tên biến thì được)
- Commit trên `main`
- `--no-verify` để bỏ qua hook
- Gộp nhiều task không liên quan vào một commit
- Tự `git push` khi người dùng chưa yêu cầu

## Nhánh

Đặt tên `<loại>/<slug>-<ngày>` — ví dụ `security/auth-hardening-20260904`.

→ `commands/ra-soat-diff` · `rules/critical/bi-mat-cau-hinh.md`
