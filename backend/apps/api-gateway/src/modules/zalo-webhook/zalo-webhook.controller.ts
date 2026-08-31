import { Body, Controller, ForbiddenException, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '@vigov/shared';
import { ZaloWebhookService } from './zalo-webhook.service';

/**
 * Webhook Zalo Mini App — sự kiện người dùng rút lại sự đồng ý và xoá dữ liệu.
 *
 * Zalo BẮT BUỘC khai URL này ở bước "Thiết lập chung" khi nộp phiên bản lên
 * kiểm duyệt; thiếu nó thì không gửi được hồ sơ xin quyền API. Nghĩa vụ nền
 * tảng này phản chiếu quyền của chủ thể dữ liệu theo NĐ 13/2023.
 *
 * URL khai trên Console:
 *     https://<tên-miền>/api/v1/webhooks/zalo
 *
 * ⚠ CHƯA XÁC MINH BẰNG TÀI LIỆU CHÍNH THỨC: tên sự kiện, tên trường chứa mã
 * người dùng, và cách tính chữ ký đều dựa trên các quy ước webhook khác của
 * Zalo. Vì thế bộ xử lý nhận diện theo NHIỀU tên thay vì một tên, và ghi nhật
 * ký mọi sự kiện lạ để đối chiếu. Khi gửi được yêu cầu thật, đọc
 * `Lịch sử hoạt động` để chốt hợp đồng rồi thu hẹp lại danh sách.
 *
 * Bảo mật: chữ ký sai hoặc thiếu → 403, không xử lý gì. Xem verifySignature().
 */
@Controller('webhooks/zalo')
export class ZaloWebhookController {
  constructor(private readonly webhook: ZaloWebhookService) {}

  /**
   * Nhận sự kiện từ Zalo.
   *
   * Trả 200 kể cả khi sự kiện không cần xử lý: Zalo coi mã khác 2xx là gửi thất
   * bại và sẽ gửi lại nhiều lần. Chỉ 403 khi chữ ký không hợp lệ.
   *
   * `@Public()` vì Zalo gọi tới bằng chữ ký riêng, không mang JWT của hệ thống.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @HttpCode(200)
  async receive(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const signature =
      headers['x-zevent-signature'] ?? headers['x-zalo-signature'] ?? headers['x-signature'] ?? headers['mac'];

    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

    if (!this.webhook.verifySignature(rawBody, signature)) {
      throw new ForbiddenException('Chữ ký không hợp lệ');
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    const outcome = await this.webhook.handle(payload, ip);

    return { received: true, handled: outcome.handled };
  }
}
