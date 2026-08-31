import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitizenUser, CitizenUserSchema, LoginSession, LoginSessionSchema } from '@vigov/shared';
import { AuditModule } from '../audit/audit.module';
import { ZaloWebhookController } from './zalo-webhook.controller';
import { ZaloWebhookService } from './zalo-webhook.service';

/**
 * Webhook Zalo Mini App — nghĩa vụ nền tảng bắt buộc để nộp phiên bản lên
 * kiểm duyệt và xin quyền API. Xử lý sự kiện người dùng rút lại sự đồng ý và
 * yêu cầu xoá dữ liệu (NĐ 13/2023).
 *
 * Đặt thành module riêng thay vì nhồi vào AuthModule: đây là điểm vào do BÊN
 * NGOÀI gọi với cơ chế xác thực riêng bằng chữ ký, không dùng JWT như mọi
 * endpoint khác — trộn chung sẽ làm mờ ranh giới đó.
 */
@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: CitizenUser.name, schema: CitizenUserSchema },
      { name: LoginSession.name, schema: LoginSessionSchema },
    ]),
  ],
  controllers: [ZaloWebhookController],
  providers: [ZaloWebhookService],
})
export class ZaloWebhookModule {}
