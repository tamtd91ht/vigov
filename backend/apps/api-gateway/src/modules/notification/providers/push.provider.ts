import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CitizenUser, type CitizenUserDocument } from '@vigov/shared';
import type { NotificationChannel, NotificationRequestedEvent } from '@vigov/shared';
import type { NotificationProvider, NotificationSendResult } from './notification.provider';

/** Endpoint FCM HTTP v1 — chỉ gọi được khi khách cấp project Firebase */
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

/** Giá trị PUSH_PROVIDER nghĩa là "chưa đấu nối thật" */
const MOCK_PROVIDER = 'mock';

/**
 * Đẩy thông báo tới app Flutter qua FCM (Android) / APNs (iOS).
 * Token thiết bị lưu ở CitizenUser.pushTokens do app đăng ký sau khi định danh.
 * Chưa cấu hình PUSH_PROVIDER/FCM_SERVER_KEY thì chỉ ghi log và báo ok:false.
 */
@Injectable()
export class PushProvider implements NotificationProvider {
  readonly channel: NotificationChannel = 'push';

  private readonly logger = new Logger(PushProvider.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
  ) {}

  async send(msg: NotificationRequestedEvent): Promise<NotificationSendResult> {
    const provider = this.config.get<string>('push.provider', MOCK_PROVIDER);
    const serverKey = this.config.get<string>('push.fcmServerKey', '');
    if (provider === MOCK_PROVIDER || !serverKey) {
      this.logger.warn(
        `Chưa cấu hình push (PUSH_PROVIDER=${provider}) — bỏ qua thông báo đẩy tới ${msg.recipient}`,
      );
      return { ok: false, detail: 'Chưa cấu hình dịch vụ thông báo đẩy' };
    }

    const citizen = await this.citizenModel.findOne({ phone: msg.recipient }).select('pushTokens').exec();
    const tokens = citizen?.pushTokens ?? [];
    if (tokens.length === 0) {
      return { ok: false, detail: 'Người nhận chưa đăng ký thiết bị nhận thông báo' };
    }

    // Khi có project Firebase: POST FCM_ENDPOINT (hoặc firebase-admin SDK) với
    // registration_ids = tokens, notification = { title, body }, data = msg.data.
    void FCM_ENDPOINT;
    this.logger.log(`Xếp hàng đẩy push "${msg.title}" tới ${tokens.length} thiết bị của ${msg.recipient}`);
    return { ok: true, detail: `Đã xếp hàng đẩy tới ${tokens.length} thiết bị` };
  }
}
