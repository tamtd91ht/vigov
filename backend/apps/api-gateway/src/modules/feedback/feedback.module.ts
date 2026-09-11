import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema, SlaRule, SlaRuleSchema } from '@vigov/shared';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { SettingsModule } from '../settings/settings.module';
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
    // TB-09: ảnh hiện trường và ảnh nghiệm thu phải là tệp riêng tư — kiểm bằng FilesService
    FilesModule,
    // Xuất Excel là GET nên AuditInterceptor không bắt — phải tự ghi vết
    AuditModule,
    // Nhãn lĩnh vực trên tệp xuất lấy từ danh mục ở phân hệ Cấu hình
    SettingsModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
