import type { NotificationChannel, NotificationRequestedEvent } from '@vigov/shared';

/** Kết quả gửi của một kênh — không bao giờ ném lỗi ra ngoài nghiệp vụ chính */
export interface NotificationSendResult {
  ok: boolean;
  detail?: string;
}

/**
 * Hợp đồng chung cho mọi kênh thông báo (ZNS / push / in-app).
 * Thêm kênh mới = thêm một provider hiện thực interface này rồi đăng ký
 * trong NotificationModule, không phải sửa NotificationService.
 */
export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(msg: NotificationRequestedEvent): Promise<NotificationSendResult>;
}

/** Khoá template dùng chung giữa module Feedback và các provider */
export const TEMPLATE_KEYS = {
  FEEDBACK_RECEIVED: 'feedback_received',
  FEEDBACK_RESOLVED: 'feedback_resolved',
  BROADCAST: 'broadcast',
} as const;
