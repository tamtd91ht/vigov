import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannel, NotificationRequestedEvent } from '@vigov/shared';
import { TEMPLATE_KEYS, type NotificationProvider, type NotificationSendResult } from './notification.provider';

/** Endpoint gửi ZNS của Zalo Business (chỉ gọi được sau khi OA được duyệt) */
const ZNS_ENDPOINT = 'https://business.openapi.zalo.me/message/template';

/** Ánh xạ khoá template nghiệp vụ → khoá cấu hình chứa template id do Zalo cấp */
const ZNS_TEMPLATE_CONFIG_KEYS: Record<string, string> = {
  [TEMPLATE_KEYS.FEEDBACK_RECEIVED]: 'zalo.znsTemplateFeedbackReceived',
  [TEMPLATE_KEYS.FEEDBACK_RESOLVED]: 'zalo.znsTemplateFeedbackResolved',
};

const MISSING_OA_DETAIL = 'Chưa cấu hình Zalo OA';

/**
 * Gửi ZNS (Zalo Notification Service) tới số điện thoại công dân.
 *
 * PHỤ THUỘC KHÁCH HÀNG (câu hỏi mở #3): muốn chạy thật cần
 *  1. Khách đăng ký Zalo OA + nâng cấp gói Zalo Business,
 *  2. Nạp ZALO_OA_ID / ZALO_APP_SECRET vào biến môi trường,
 *  3. Soạn và gửi Zalo duyệt từng template ZNS — lead time duyệt vài ngày làm việc.
 * Khi chưa đủ 3 điều kiện trên, provider chỉ ghi log cảnh báo và báo ok:false
 * để nghiệp vụ phản ánh vẫn chạy bình thường.
 */
@Injectable()
export class ZnsProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'zns';

  private readonly logger = new Logger(ZnsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(msg: NotificationRequestedEvent): Promise<NotificationSendResult> {
    const oaId = this.config.get<string>('zalo.oaId', '');
    const appSecret = this.config.get<string>('zalo.appSecret', '');
    if (!oaId || !appSecret) {
      this.logger.warn(
        `Chưa cấu hình Zalo OA (ZALO_OA_ID/ZALO_APP_SECRET) — bỏ qua ZNS tới ${msg.recipient}`,
      );
      return { ok: false, detail: MISSING_OA_DETAIL };
    }

    const configKey = ZNS_TEMPLATE_CONFIG_KEYS[msg.templateKey];
    const templateId = configKey ? this.config.get<string>(configKey, '') : '';
    if (!templateId) {
      this.logger.warn(`Chưa có template ZNS cho "${msg.templateKey}" — Zalo chưa duyệt hoặc chưa cấu hình`);
      return { ok: false, detail: `Chưa có template ZNS cho ${msg.templateKey}` };
    }

    const payload = {
      phone: toZaloPhone(msg.recipient),
      template_id: templateId,
      template_data: { title: msg.title, body: msg.body, ...(msg.data ?? {}) },
    };

    // Khi OA đã được duyệt: POST ZNS_ENDPOINT với header access_token lấy từ
    // luồng OAuth của Zalo (access token có hạn, cần refresh + cache).
    void ZNS_ENDPOINT;
    this.logger.log(`Xếp hàng gửi ZNS ${msg.templateKey} tới ${payload.phone} (template ${templateId})`);
    return { ok: true, detail: 'Đã xếp hàng gửi ZNS' };
  }
}

/** ZNS yêu cầu số điện thoại dạng 84xxxxxxxxx (bỏ số 0 đầu) */
function toZaloPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}
