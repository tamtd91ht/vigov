---
name: hang-doi-rabbitmq
description: Dùng khi làm việc với hàng đợi RabbitMQ, consumer, gửi thông báo nền, workflow nền, việc chạy theo lịch. Kích hoạt bởi: RabbitMQ, amqp, hàng đợi, queue, consumer, producer, publish, thông báo nền, workflow queue, retry, DLQ, idempotent, cron, scheduled, ScheduleModule.
---

# Kỹ năng: Hàng đợi RabbitMQ và việc nền
# Mức: CAO | Ngăn: mất thông báo, xử lý trùng, việc nền không để lại vết

## Phạm vi RabbitMQ trong ViGov

**Không** phải microservice. Chỉ hai hàng đợi cho việc nền:

| Hàng đợi | Biến | Dùng cho |
|---|---|---|
| `vigov.notification` | `RABBITMQ_NOTIFICATION_QUEUE` | Gửi thông báo (ZNS, FCM, trong ứng dụng) |
| `vigov.workflow` | `RABBITMQ_WORKFLOW_QUEUE` | Việc luân chuyển, nhắc hạn, tự động đổi trạng thái |

Nghiệp vụ chính vẫn chạy **đồng bộ trong HTTP request**. Chỉ đẩy sang hàng đợi những việc
người dùng không cần chờ.

## MUST

| # | Luật |
|---|------|
| 1 | Việc nền **đổi dữ liệu nghiệp vụ** phải tự gọi `AuditService.record` — `AuditInterceptor` chỉ bắt HTTP → `rules/critical/nhat-ky-thao-tac.md` |
| 2 | Consumer **idempotent**: xử lý cùng một tin hai lần cho ra cùng kết quả. Kiểm bằng mã tin hoặc trạng thái bản ghi trước khi ghi |
| 3 | Tin nhắn mang **mã nghiệp vụ**, không mang toàn bộ dữ liệu — consumer đọc lại từ Mongo (dữ liệu có thể đã đổi giữa lúc gửi và lúc xử lý) |
| 4 | Tin nhắn **không** chứa dữ liệu cá nhân dạng rõ → `rules/critical/du-lieu-ca-nhan.md` |
| 5 | Consumer lỗi: ghi log có mã tin + lý do, có số lần thử giới hạn, hết lượt thì đưa sang hàng chờ chết và **cảnh báo**, không im lặng bỏ |
| 6 | Gửi tin thất bại **không** được làm hỏng nghiệp vụ chính — bắt lỗi, ghi log, để nghiệp vụ chính hoàn tất |
| 7 | Việc theo lịch (`@Cron`) chạy nhiều instance → phải có chốt chống chạy trùng, hoặc chỉ bật ở một instance bằng cờ môi trường |
| 8 | Health check phơi trạng thái hàng đợi (`GET /health/ready` — trường `messaging.blocked`) |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Đưa nghiệp vụ then chốt (tạo hồ sơ, phê duyệt, giải ngân) vào hàng đợi — mất tin là mất nghiệp vụ |
| 2 | Dùng RabbitMQ làm kho dữ liệu hay nguồn chuẩn |
| 3 | Consumer không có giới hạn số lần thử (tin lỗi quay vòng vô hạn) |
| 4 | Đặt tên hàng đợi cứng trong mã — đọc từ `ConfigService` |
| 5 | Giữ `guest/guest` trong `RABBITMQ_URI` ở môi trường thật (SECURITY.md mục 4, việc 7) |
| 6 | Cron tự động **xoá** dữ liệu → `rules/critical/bao-toan-du-lieu.md` |
| 7 | Cron tự động đổi trạng thái hồ sơ mà không ghi timeline "hệ thống tự đổi vì quá hạn" |

## Sự cố đã gặp

RabbitMQ nhận kết nối nhưng gửi tin bị treo → máy chủ chặn publish do hết dung lượng đĩa
(`low on disk`). Kiểm tra bằng `GET /api/v1/health/ready`, trường `messaging.blocked`.

→ `rules/critical/nhat-ky-thao-tac.md` · `skills/adapter-ben-thu-ba` · `skills/trien-khai-docker`
