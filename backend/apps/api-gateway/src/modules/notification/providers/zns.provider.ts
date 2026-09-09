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

/** Hạn chờ gọi ZNS — thông báo trễ còn hơn giữ tiến trình gửi treo vô hạn */
const ZNS_TIMEOUT_MS = 8000;

/** Thân phản hồi của ZNS */
interface ZnsResponse {
  data?: { msg_id?: string };
  error: number;
  message?: string;
}

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

    /* Cổng thứ ba: access token của OA.
       KHÔNG phải ZALO_APP_SECRET. Đây là token do luồng OAuth của Zalo OA cấp,
       hạn 1 giờ, gia hạn bằng refresh token (hạn 3 tháng). Chưa có nó thì phải
       báo THẤT BẠI — trước đây hàm này trả ok:true kèm "Đã xếp hàng gửi ZNS"
       trong khi không gửi gì cả, nên nhật ký và bảng theo dõi thông báo đều báo
       thành công cho những tin chưa từng rời máy chủ. */
    const accessToken = this.config.get<string>('zalo.oaAccessToken', '');
    if (!accessToken) {
      this.logger.warn(
        `Chưa có ZALO_OA_ACCESS_TOKEN — KHÔNG gửi được ZNS ${msg.templateKey} tới ${msg.recipient}`,
      );
      return { ok: false, detail: 'Chưa có access token của Zalo OA' };
    }

    const payload = {
      phone: toZaloPhone(msg.recipient),
      template_id: templateId,
      template_data: { title: msg.title, body: msg.body, ...(msg.data ?? {}) },
    };

    try {
      const res = await fetch(ZNS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: accessToken },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ZNS_TIMEOUT_MS),
      });

      if (!res.ok) {
        this.logger.error(`ZNS trả HTTP ${res.status} khi gửi ${msg.templateKey}`);
        return { ok: false, detail: `ZNS trả HTTP ${res.status}` };
      }

      // Giống graph.zalo.me: HTTP 200 cả khi lỗi nghiệp vụ, `error !== 0` mới là hỏng
      const body = (await res.json()) as ZnsResponse;
      if (body.error !== 0) {
        const detail = `[${body.error}] ${body.message ?? ''}`.trim();
        this.logger.error(`Zalo từ chối gửi ZNS ${msg.templateKey}: ${detail}`);
        return { ok: false, detail: `Zalo từ chối gửi ZNS: ${detail}` };
      }

      this.logger.log(`Đã gửi ZNS ${msg.templateKey} tới ${payload.phone} (template ${templateId})`);
      return { ok: true, detail: body.data?.msg_id ? `msg_id ${body.data.msg_id}` : 'Đã gửi ZNS' };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Không gọi được ZNS: ${reason}`);
      return { ok: false, detail: `Không gọi được ZNS: ${reason}` };
    }
  }
}

/** ZNS yêu cầu số điện thoại dạng 84xxxxxxxxx (bỏ số 0 đầu) */
function toZaloPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}
