# P3-27 — Backend — Kết xuất báo cáo PDF/Excel/PPT

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #27 — Service render báo cáo theo kỳ: PDF, Excel, PPT (PPT có thể bỏ — câu hỏi mở #11).

## Kế hoạch thực hiện

- [x] Excel: exceljs; PDF: puppeteer/pdfmake; PPT: pptxgenjs (nếu giữ).
- [x] Queue render nặng qua RabbitMQ; template theo 4 nhóm biểu đồ.
