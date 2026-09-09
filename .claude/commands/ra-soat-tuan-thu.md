---
description: Rà soát tuân thủ ViGov — dữ liệu cá nhân theo NĐ 13/2023, bảo toàn tài liệu, nhật ký, tiếng Việt, tiếp cận, không hardcode
argument-hint: "[phạm vi: diff | module | all] — bỏ trống thì rà cả dự án"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /ra-soat-tuan-thu

Gọi `agents/ra-soat-tuan-thu.md`. Trả lời câu: **hệ thống này có đủ tư cách để một cơ
quan nhà nước đưa vào vận hành và bàn giao chưa.**

Khác `/ra-soat-bao-mat` (tìm lỗ hổng kỹ thuật) — lệnh này rà tư cách bàn giao.
**Chỉ đọc và báo cáo.**

## Sáu trục

| # | Trục | Kiểm gì |
|---|------|---|
| 1 | Dữ liệu cá nhân theo NĐ 13/2023 | Mỗi trường trả lời được: thu để làm gì · ai xem · giữ bao lâu |
| 2 | Bảo toàn tài liệu hành chính | Xoá cứng, truy vấn thiếu `deletedAt: null`, `updateMany` bộ lọc rỗng |
| 3 | Nhật ký thao tác | Đường ghi ngoài HTTP có ghi vết; hành động quan trọng có timeline |
| 4 | Tiếng Việt hành chính | Chuỗi còn tiếng Anh, sai chính tả, dùng lẫn phản ánh/khiếu nại/tố cáo, thuật ngữ kỹ thuật lọt ra giao diện |
| 5 | Khả năng tiếp cận (giao diện công dân) | Cỡ chữ ≥ 16, vùng chạm ≥ 44×44, tương phản, thông báo lỗi có hướng dẫn |
| 6 | Không hardcode | Tên xã, URL, toạ độ, SLA, nhãn trạng thái nằm ngoài `config/` |

Chi tiết lệnh grep: `agents/ra-soat-tuan-thu.md`

## Đối chiếu BẮT BUỘC

`SECURITY.md` mục 4 — **12 việc bắt buộc trước production**. Báo cáo phải nói rõ **từng
việc**: đã làm / chưa làm / không áp dụng.

## Định dạng báo cáo

```
## Mức độ sẵn sàng bàn giao: <Chưa đạt | Đạt có điều kiện | Đạt>

### Chặn phát hành
| # | Vấn đề | Trục | Tệp:dòng | Việc phải làm |

### Phải làm trước khi mở cho dân
### Nên làm, không chặn
### Đối chiếu 12 việc bắt buộc trước production
| # | Việc | Trạng thái | Bằng chứng |

### Ngoài phạm vi Phase 1
### Đã kiểm và đạt
```

## KHÔNG BAO GIỜ

- Khẳng định hệ thống "tuân thủ NĐ 13/2023" — Phase 1 chưa có đánh giá tuân thủ chính thức
- Tự quyết định câu hỏi pháp lý (thời hạn lưu, được thu trường gì, được gửi ra đâu)
- Đánh giá **Đạt** khi còn `CITIZEN_OTP_BYPASS_CODE` bật, `JWT_SECRET` mẫu, hoặc `CORS_ORIGINS=*`
- Bỏ qua mục "Ngoài phạm vi Phase 1" — người đọc cần biết cái gì **chưa** làm

→ `agents/ra-soat-tuan-thu` · `data/tuan-thu-phap-ly.md` · `workflows/truoc-phat-hanh`
