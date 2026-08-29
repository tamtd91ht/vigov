import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { NotificationChannel, NotificationRequestedEvent } from '@vigov/shared';
import { REALTIME_EVENTS, RealtimeService } from '../../realtime/realtime.service';
import { Notification, type NotificationDocument } from '../notification.schema';
import type { NotificationProvider, NotificationSendResult } from './notification.provider';

/** Trạng thái gắn kèm sự kiện realtime của thông báo mới — luôn là chưa đọc */
const REALTIME_STATUS_UNREAD = 'unread';

/**
 * Lưu thông báo in-app cho cán bộ (chuông trên Web Quản trị) và cho
 * công dân trong app. Đây là kênh duy nhất luôn dùng được vì không phụ thuộc
 * nhà cung cấp bên ngoài — dùng làm kênh dự phòng khi ZNS/push chưa cấu hình.
 */
@Injectable()
export class InAppProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'inapp';

  private readonly logger = new Logger(InAppProvider.name);

  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    private readonly realtime: RealtimeService,
  ) {}

  async send(msg: NotificationRequestedEvent): Promise<NotificationSendResult> {
    const created = await this.notificationModel.create({
      recipient: msg.recipient,
      title: msg.title,
      body: msg.body,
      data: { templateKey: msg.templateKey, ...(msg.data ?? {}) },
      read: false,
    });
    this.logger.debug(`Đã lưu thông báo in-app ${String(created._id)} cho ${msg.recipient}`);

    /*
     * Đẩy tín hiệu thời gian thực để chuông trên Web Quản trị sáng ngay, không phải
     * chờ nhịp hỏi lại máy chủ (P5-05). Chỉ gửi mã thông báo — client tự gọi
     * GET /notifications để lấy nội dung đã lọc theo quyền của mình.
     */
    this.realtime.emitToUser(msg.recipient, REALTIME_EVENTS.NOTIFICATION_NEW, {
      type: 'created',
      code: String(created._id),
      status: REALTIME_STATUS_UNREAD,
      at: new Date().toISOString(),
    });

    return { ok: true, detail: String(created._id) };
  }
}
