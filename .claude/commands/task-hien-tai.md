---
description: Xem task ViGov đang dở và task chưa bắt đầu, kèm plan và câu hỏi mở liên quan
allowed-tools: Read, Bash, Grep
---

# /task-hien-tai

## Làm gì

```bash
python - <<'EOF'
import io, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
tasks = json.load(io.open('pending-tasks.json', encoding='utf-8'))
for status, tieu_de in (('in-progress', 'ĐANG LÀM'), ('pending', 'CHƯA BẮT ĐẦU')):
    rows = [t for t in tasks if t.get('status') == status]
    if not rows:
        continue
    print(f"\n=== {tieu_de} ({len(rows)}) ===")
    for t in rows:
        print(f"\n[{t['id']}] {t['name']}")
        print(f"  {t.get('description','')[:220]}")
        print(f"  plan: {t.get('planFilePath','—')}  ·  cập nhật: {t.get('updatedAt','')[:10]}")
done = sum(1 for t in tasks if t.get('status') == 'done')
print(f"\n=== Tổng: {done}/{len(tasks)} xong ===")
EOF
```

Rồi đọc tệp plan của mỗi task đang dở và tóm lại:

- Phạm vi còn lại (việc nào trong checklist của plan chưa xong)
- Câu hỏi mở đang chặn (nếu có)
- Bước tiếp theo nên làm

## Định dạng báo cáo

```
## Đang làm
### [mã] tên
- Phạm vi: <một câu>
- Đã xong trong plan: <…>
- Còn lại: <…>
- Câu hỏi mở đang chặn: <# hoặc "không">
- Bước tiếp theo: <việc cụ thể>

## Chưa bắt đầu
| Mã | Tên | Ghi chú |

## Tổng: <x>/<y> xong
```

## Lưu ý

- Nhiều task đang `in-progress` cùng lúc là dấu hiệu việc bị bỏ dở — nêu ra
- Task `in-progress` mà `updatedAt` cách đây lâu → hỏi có còn làm không
- Đừng tự đổi trạng thái task trong lệnh này (đó là việc của `/thuc-hien` và `/task-xong`)

→ `skills/quan-ly-task-plan` · `commands/task-xong`
