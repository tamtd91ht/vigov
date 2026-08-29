import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema, SlaRule, SlaRuleSchema } from '@vigov/shared';
import { NotificationModule } from '../notification/notification.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/**
 * Module Feedback (WBS #6 — xử lý phản ánh trên Web Quản trị,
 * WBS #13 — gửi/theo dõi phản ánh trên app công dân & Zalo Mini App).
 * SlaRule dùng để tính hạn xử lý theo lĩnh vực; NotificationModule cung cấp
 * NotificationService để báo tiếp nhận / trả kết quả cho công dân.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: SlaRule.name, schema: SlaRuleSchema },
    ]),
    NotificationModule,
    // P5-05: phát feedback.changed khi phiếu được tạo / phân công / xử lý xong
    RealtimeModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
