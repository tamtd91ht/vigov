import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';

/**
 * Module Messaging (P5-04) — một cửa duy nhất nói chuyện với RabbitMQ.
 *
 * Đăng ký ở AppModule để kết nối được dựng ngay khi ứng dụng khởi động, đồng thời
 * export MessagingService cho WorkflowModule (bên phát) và NotificationModule
 * (bên tiêu thụ) dùng chung MỘT kết nối.
 *
 * Không có controller: hàng đợi là hạ tầng nội bộ, không lộ ra HTTP. Trạng thái
 * kết nối được báo cáo qua /health/ready (HealthController gọi getStatus()).
 */
@Module({
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
