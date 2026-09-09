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
| 1 | Đang ở `main` — **đúng**, dự án này chỉ dùng một nhánh | Đang ở nhánh khác thì merge về `main` rồi push |
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
- **Tự ý tạo nhánh mới** — xem mục Nhánh bên dưới
- `--no-verify` để bỏ qua hook
- Gộp nhiều task không liên quan vào một commit
- Tự `git push` khi người dùng chưa yêu cầu

## Nhánh — chỉ dùng `main`

Dự án này làm việc **trên một nhánh duy nhất là `main`**. Commit và push thẳng vào `main`.

**Tách nhánh chỉ xảy ra trong đúng hai trường hợp:**

1. Người dùng **tự quyết định** tách và nói ra;
2. Agent **đề nghị** tách, nêu rõ vì sao, và người dùng **chốt đồng ý**.

Ngoài hai trường hợp đó, tạo nhánh là **sai** — nó đẩy phần việc merge sang cho người
dùng, việc mà họ không yêu cầu. "Cẩn thận" không phải lý do để tự tách nhánh: nếu thấy
thay đổi có rủi ro thì **nói ra rủi ro đó**, đừng tự chọn cách làm khác.

Đang lỡ ở nhánh khác thì merge về `main` (`git merge --ff-only`) rồi push `main`.

Khi thật sự cần đề nghị tách: đặt tên `<loại>/<slug>-<ngày>` — ví dụ
`security/auth-hardening-20260904`.

→ `commands/ra-soat-diff` · `rules/critical/bi-mat-cau-hinh.md`
