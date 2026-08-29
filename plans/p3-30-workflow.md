# P3-30 — Backend — Workflow xuyên phân hệ

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #30 — Luồng Văn bản → Công việc, Phản ánh → Công việc; đồng bộ trạng thái ngược; CronJob nhắc SLA/hạn xử lý.

## Kế hoạch thực hiện

- [x] Event-driven qua RabbitMQ: doc.assigned → task.created…
- [x] CronJob quét hạn: nhắc trước hạn theo config cảnh báo SLA.
