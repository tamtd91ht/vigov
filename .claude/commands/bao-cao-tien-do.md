---
description: Cập nhật BAO-CAO-TIEN-DO.md theo hiện trạng thật của mã nguồn và pending-tasks.json
allowed-tools: Read, Grep, Glob, Bash, Edit
---

# /bao-cao-tien-do

## Nguyên tắc

Báo cáo tiến độ là **tài liệu khách hàng đọc**. Nó phải nói đúng hiện trạng, kể cả phần
chưa xong. Báo cáo tô hồng là thứ vỡ ra lúc UAT, khi không còn thời gian sửa.

## Thu thập số liệu THẬT

```bash
python - <<'EOF'
import io, json, sys
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
tasks = json.load(io.open('pending-tasks.json', encoding='utf-8'))
c = Counter(t.get('status') for t in tasks)
print("=== Trạng thái task ===")
for k in ('done', 'in-progress', 'pending'):
    print(f"  {k}: {c.get(k, 0)}")
print(f"  tổng: {len(tasks)}")
print("\n=== Đang dở ===")
for t in tasks:
    if t.get('status') == 'in-progress':
        print(f"  [{t['id']}] {t['name']}  (cập nhật {t.get('updatedAt','')[:10]})")
print("\n=== Chưa bắt đầu ===")
for t in tasks:
    if t.get('status') == 'pending':
        print(f"  [{t['id']}] {t['name']}")
EOF
```

Kiểm chứng kỹ thuật hiện tại:

```bash
npm run check:all
cd backend && npm test
```

## Đối chiếu bắt buộc

| # | Đối chiếu |
|---|---|
| 1 | Số task `done` trong báo cáo khớp `pending-tasks.json` |
| 2 | Trạng thái từng module (`README.md` bảng đầu) khớp hiện trạng mã |
| 3 | Mục "còn thiếu gì" khớp `SECURITY.md` mục 4 (12 việc trước production) và mục 5 (ngoài phạm vi) |
| 4 | Câu hỏi mở còn treo khớp `ESTIMATE_TECHNICAL.md` |
| 5 | Kết quả test nêu trong báo cáo là kết quả **vừa chạy**, không phải lần trước |

## Cập nhật

Sửa `BAO-CAO-TIEN-DO.md` **đúng chỗ** đang nói về phần đã đổi. Không thêm mục mới song
song với mục cũ.

Giữ đủ bốn phần:

1. **Đã xong** — theo pha, có số liệu
2. **Đang làm** — task nào, còn gì
3. **Còn thiếu** — nói thật: chưa làm gì, vì sao (chờ khách chốt? ngoài phạm vi? chưa tới?)
4. **Rủi ro và phụ thuộc bên ngoài** — quyền Zalo, nhà cung cấp chưa chốt, hạ tầng

## KHÔNG BAO GIỜ

- Đánh dấu một hạng mục là xong khi chưa kiểm chứng
- Bỏ phần "còn thiếu" hoặc viết mờ nhạt cho đẹp báo cáo
- Ghi số liệu test cũ như thể vừa chạy
- Ghi giá trị secret hay dữ liệu cá nhân vào báo cáo
- Tự chốt câu hỏi mở của khách rồi ghi vào báo cáo như đã quyết

→ `skills/quan-ly-task-plan` · `skills/tai-lieu-dong-bo`
