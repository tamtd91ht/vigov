---
description: Kết thúc một task ViGov — kiểm chứng, rà bảo mật, đồng bộ tài liệu, đổi trạng thái
argument-hint: "<mã task, ví dụ P5-11>"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
---

# /task-xong

**Không** đổi trạng thái trước khi làm xong bảy bước dưới. Đánh dấu `done` khi chưa kiểm
chứng là để lại một việc chưa xong trong hồ sơ bàn giao.

## Bảy bước

| # | Việc | Không được bỏ |
|---|------|---|
| 1 | Đọc plan, đối chiếu **từng mục checklist** — mục nào chưa làm thì nói ra | ✅ |
| 2 | Chạy kiểm chứng thật (xem dưới) | ✅ |
| 3 | Rà soát bảo mật nếu chạm dữ liệu / quyền / tệp / cấu hình → `agents/ra-soat-bao-mat` | ✅ nếu áp dụng |
| 4 | Đồng bộ tài liệu → `agents/dong-bo-tai-lieu` | ✅ |
| 5 | Cập nhật plan: ghi những gì **không** làm và vì sao | ✅ |
| 6 | Đổi `status` → `done` và `updatedAt` trong `pending-tasks.json` | ✅ |
| 7 | Cập nhật `BAO-CAO-TIEN-DO.md` | ✅ |

## Bước 2 — kiểm chứng

```bash
npm run check:all                              # gốc
cd backend && npm test                         # nếu sửa backend
cd backend && npm run test:e2e                 # nếu chạm API
cd mobile && flutter analyze && flutter test   # nếu sửa Flutter
```

**Có lệnh nào đỏ → KHÔNG đánh dấu `done`.** Báo lỗi và dừng.

## Bước 6 — sửa đúng phần tử, không viết lại cả tệp

```bash
python - <<'EOF'
import io, json, sys
from datetime import datetime, timezone
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
MA = "P5-11"          # ← đổi thành mã task
path = 'pending-tasks.json'
tasks = json.load(io.open(path, encoding='utf-8'))
found = False
for t in tasks:
    if t.get('id') == MA:
        t['status'] = 'done'
        t['updatedAt'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        found = True
        break
if not found:
    raise SystemExit(f"Không tìm thấy task {MA}")
io.open(path, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(tasks, ensure_ascii=False, indent=2) + '\n')
print(f"{MA} → done")
EOF
```

**Không** xoá task khỏi tệp — đổi trạng thái, giữ lịch sử.

## Báo cáo cuối

```
## [mã] tên — XONG

### Đã làm
### Đã chạy — lệnh và kết quả thật
### Tài liệu đã cập nhật
### Giả định đã dùng
### KHÔNG làm (và vì sao)
### Câu hỏi mở còn treo
```

Mục "KHÔNG làm" là phần có giá trị nhất khi bàn giao — đừng để trống nếu thật sự có việc
đã cắt ra khỏi phạm vi.

→ `skills/quan-ly-task-plan` · `skills/tai-lieu-dong-bo`
