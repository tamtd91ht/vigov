import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Module Realtime (P5-05) — kênh Socket.IO cập nhật thời gian thực.
 *
 * Chỉ export RealtimeService: các module nghiệp vụ (Feedback, Tasks, Notification)
 * phát sự kiện qua service này và không cần biết gì về tầng WebSocket.
 * RealtimeGateway giữ riêng phần bắt tay, xác thực JWT và chia phòng.
 *
 * PHẠM VI: mức độ realtime đầy đủ đang chờ khách chốt (câu hỏi mở #7). Hiện làm
 * 3 sự kiện: feedback.changed, task.changed, notification.new.
 */
@Module({
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
