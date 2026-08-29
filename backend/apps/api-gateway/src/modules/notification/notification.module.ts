import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitizenUser, CitizenUserSchema, StaffUser, StaffUserSchema } from '@vigov/shared';
import { MessagingModule } from '../messaging/messaging.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BroadcastLog, BroadcastLogSchema } from './broadcast-log.schema';
import { NotificationConsumer } from './notification.consumer';
import { NotificationController } from './notification.controller';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationService } from './notification.service';
import { InAppProvider } from './providers/inapp.provider';
import { PushProvider } from './providers/push.provider';
import { ZnsProvider } from './providers/zns.provider';

/**
 * Module Notification (WBS #23, P3-23) — một cửa gửi thông báo cho toàn hệ thống.
 * Schema `Notification` và `BroadcastLog` là schema cục bộ của module này (không nằm ở libs/shared);
 * StaffUser/CitizenUser chỉ đọc để tra người nhận khi gửi hàng loạt / push.
 *
 * P5-04: NotificationConsumer lắng nghe hàng đợi `vigov.notification` để nhận sự
 * kiện do WorkflowModule phát ra (kênh phụ, chạy song song với lời gọi trực tiếp).
 * P5-05: InAppProvider phát `notification.new` qua RealtimeService cho đúng người nhận.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: BroadcastLog.name, schema: BroadcastLogSchema },
      { name: StaffUser.name, schema: StaffUserSchema },
      { name: CitizenUser.name, schema: CitizenUserSchema },
    ]),
    MessagingModule,
    RealtimeModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationConsumer, ZnsProvider, PushProvider, InAppProvider],
  exports: [NotificationService],
})
export class NotificationModule {}
