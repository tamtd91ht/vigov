# P5-04 — RabbitMQ — publisher/consumer thật

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Techstack yêu cầu RabbitMQ. Hiện đã có hợp đồng sự kiện (libs/shared/src/events) và docker-compose, nhưng workflow gọi trực tiếp và notification chỉ ghi log. Chuyển sang hàng đợi thật để tách rời và chịu lỗi tốt hơn.

## Kế hoạch thực hiện

- [x] Đăng ký `ClientsModule` (transport RMQ) đọc `rabbitmq.uri` từ ConfigService.
- [x] WorkflowService phát sự kiện `document.assigned`, `feedback.assigned`, `feedback.resolved` thay cho gọi hàm trực tiếp.
- [x] NotificationModule làm consumer hàng đợi `vigov.notification`, có retry và hàng đợi chết (dead-letter).
- [x] CronJob nhắc hạn phát `task.deadline.warning` để notification xử lý.
- [x] Bổ sung healthcheck kết nối RabbitMQ vào `/health/ready`.
