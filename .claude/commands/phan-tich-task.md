---
description: Phân tích một task ViGov trước khi làm — đọc plan, xác định phạm vi, luật áp dụng, câu hỏi mở, rồi lập kế hoạch
argument-hint: "[mã task, ví dụ P5-11] — bỏ trống thì lấy task đang in-progress"
allowed-tools: Read, Grep, Glob, Bash
---

# /phan-tich-task

Phân tích, **không** viết mã. Kết quả là một bản phân tích để người dùng xác nhận trước
khi bắt tay làm.

## Đầu vào

`$1` = mã task (ví dụ `P5-11`). Bỏ trống → lấy task đang `in-progress` trong
`pending-tasks.json`; nếu có nhiều thì liệt kê và hỏi.

## Làm gì

1. Đọc mục task trong `pending-tasks.json` (id, name, description, planFilePath, status)
2. Đọc tệp plan ở `plans/`
3. Khảo sát mã hiện có ở vùng liên quan — `codegraph_context` trước, `Read` sau
4. Đối chiếu với `rules/_INDEX.md` để biết luật nào áp
5. Tra `ESTIMATE_TECHNICAL.md` xem task này chạm câu hỏi mở nào
6. Kiểm xem đã có mã tương tự chưa → `skills/ke-thua-truoc-khi-viet-moi`

## Kết quả — đúng định dạng này

```
## <mã task> — <tên>

### Phạm vi (một câu)

### Module bị ảnh hưởng
| Module | Việc phải làm |

### Luật bắt buộc áp dụng
| Luật | Vì sao áp cho task này |

### Kỹ năng nên nạp
<danh sách skills/…>

### Mã đã có, dùng lại được
| Tệp | Dùng lại gì |

### Câu hỏi mở của khách đang chạm tới
| # | Nội dung | Mặc định an toàn ta sẽ dùng |

### Giả định
<liệt kê tường minh — mỗi giả định một dòng>

### Câu cần người dùng trả lời trước khi làm
<chỉ những câu mà trả lời khác nhau dẫn tới kết quả khác nhau. Không có thì nói "Không có">

### Kế hoạch
1. [bước] → kiểm chứng: [cách xác nhận]
2. ...

### Cách kiểm chứng cuối
<lệnh cụ thể>
```

## KHÔNG BAO GIỜ

- Tự chốt câu hỏi mở của khách hàng
- Viết mã trong lệnh này
- Mở rộng phạm vi ngoài plan mà không nói rõ

→ `skills/quan-ly-task-plan` · `workflows/tinh-nang-moi`
