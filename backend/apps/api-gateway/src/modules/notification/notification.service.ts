import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  CitizenUser,
  StaffUser,
  type CitizenUserDocument,
  type NotificationChannel,
  type NotificationRequestedEvent,
  type StaffUserDocument,
} from '@vigov/shared';
import { BroadcastLog, type BroadcastLogDocument, type BroadcastStatus } from './broadcast-log.schema';
import { Notification, type NotificationDocument } from './notification.schema';
import { InAppProvider } from './providers/inapp.provider';
import { PushProvider } from './providers/push.provider';
import { ZnsProvider } from './providers/zns.provider';
import { TEMPLATE_KEYS, type NotificationProvider, type NotificationSendResult } from './providers/notification.provider';

/** Phân trang hộp thông báo in-app */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Trần số người nhận một lần gửi hàng loạt — tránh khoá tiến trình */
const BROADCAST_MAX_RECIPIENTS = 5000;

/** Phân trang lịch sử gửi hàng loạt */
const BROADCAST_DEFAULT_PAGE_SIZE = 20;
const BROADCAST_MAX_PAGE_SIZE = 100;

/** Kênh mặc định gửi cho công dân: ZNS + push, in-app là bản lưu trong app */
const CITIZEN_CHANNELS: NotificationChannel[] = ['zns', 'push', 'inapp'];

export type ChannelResults = Partial<Record<NotificationChannel, NotificationSendResult>>;

/** Tham số thông báo tiếp nhận phản ánh */
export interface FeedbackReceivedNotice {
  code: string;
  citizenPhone: string;
  title: string;
  /** Hạn xử lý theo SLA (nếu đã tính được) */
  slaDueAt?: Date;
  department?: string;
}

/** Tham số thông báo kết quả xử lý phản ánh */
export interface FeedbackResolvedNotice {
  code: string;
  citizenPhone: string;
  title: string;
  resolvedAt: string;
  /** Nội dung kết quả cán bộ ghi khi xác nhận đã xử lý */
  note?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** Bảng tra provider theo kênh — dựng một lần lúc khởi tạo */
  private readonly providers: Map<NotificationChannel, NotificationProvider>;

  constructor(
    private readonly zns: ZnsProvider,
    private readonly push: PushProvider,
    private readonly inapp: InAppProvider,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(BroadcastLog.name) private readonly broadcastLogModel: Model<BroadcastLogDocument>,
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
  ) {
    this.providers = new Map<NotificationChannel, NotificationProvider>(
      [zns, push, inapp].map((p) => [p.channel, p]),
    );
  }

  /**
   * Gửi một thông báo qua tất cả kênh yêu cầu.
   * KHÔNG ném lỗi ra ngoài: lỗi hạ tầng thông báo (Zalo lỗi, FCM timeout...)
   * tuyệt đối không được làm hỏng nghiệp vụ chính (tạo/duyệt phản ánh).
   */
  async send(event: NotificationRequestedEvent): Promise<ChannelResults> {
    const results: ChannelResults = {};
    for (const channel of event.channels) {
      const provider = this.providers.get(channel);
      if (!provider) {
        this.logger.warn(`Không có provider cho kênh "${channel}"`);
        results[channel] = { ok: false, detail: `Không hỗ trợ kênh ${channel}` };
        continue;
      }
      try {
        results[channel] = await provider.send(event);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        this.logger.error(`Gửi thông báo kênh ${channel} tới ${event.recipient} thất bại: ${detail}`);
        results[channel] = { ok: false, detail };
      }
    }
    return results;
  }

  /** Thông báo cho công dân: đã tiếp nhận phản ánh (gọi từ module Feedback) */
  async notifyFeedbackReceived(notice: FeedbackReceivedNotice): Promise<ChannelResults> {
    const due = notice.slaDueAt ? ` Hạn xử lý dự kiến: ${formatDate(notice.slaDueAt)}.` : '';
    return this.send({
      channels: CITIZEN_CHANNELS,
      recipient: notice.citizenPhone,
      templateKey: TEMPLATE_KEYS.FEEDBACK_RECEIVED,
      title: `Đã tiếp nhận phản ánh ${notice.code}`,
      body: `UBND xã đã tiếp nhận phản ánh "${notice.title}".${due} Vui lòng theo dõi tiến độ trong ứng dụng.`,
      data: {
        feedbackCode: notice.code,
        department: notice.department ?? '',
        slaDueAt: notice.slaDueAt ? notice.slaDueAt.toISOString() : '',
      },
    });
  }

  /** Thông báo cho công dân: phản ánh đã xử lý xong (gọi từ module Feedback) */
  async notifyFeedbackResolved(notice: FeedbackResolvedNotice): Promise<ChannelResults> {
    const note = notice.note ? ` Kết quả: ${notice.note}.` : '';
    return this.send({
      channels: CITIZEN_CHANNELS,
      recipient: notice.citizenPhone,
      templateKey: TEMPLATE_KEYS.FEEDBACK_RESOLVED,
      title: `Phản ánh ${notice.code} đã được xử lý`,
      body: `Phản ánh "${notice.title}" đã hoàn tất ngày ${notice.resolvedAt}.${note} Mời quý vị đánh giá mức độ hài lòng.`,
      data: { feedbackCode: notice.code, resolvedAt: notice.resolvedAt },
    });
  }

  /** Thông báo in-app cho một cán bộ (chuông trên Web Quản trị) */
  async notifyStaff(
    username: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<ChannelResults> {
    return this.send({
      channels: ['inapp'],
      recipient: username,
      templateKey: TEMPLATE_KEYS.BROADCAST,
      title,
      body,
      data,
    });
  }

  /**
   * Thông báo in-app cho MỌI cán bộ đang hoạt động của một bộ phận.
   *
   * Dùng khi việc được giao cho cả bộ phận chứ chưa có cán bộ đích danh
   * (ví dụ văn bản đến mới phân công bộ phận chủ trì — P5-04).
   */
  async notifyDepartment(
    department: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<{ recipients: number }> {
    if (!department) return { recipients: 0 };

    const staff = await this.staffModel
      .find({ department, status: 'active' })
      .select('username')
      .limit(BROADCAST_MAX_RECIPIENTS)
      .lean()
      .exec();

    for (const member of staff) {
      await this.notifyStaff(member.username, title, body, data);
    }

    this.logger.log(`Đã thông báo "${title}" tới ${staff.length} cán bộ bộ phận ${department}`);
    return { recipients: staff.length };
  }

  /** Hộp thông báo in-app của người đang đăng nhập */
  async listInbox(recipient: string, page = DEFAULT_PAGE, limit = DEFAULT_PAGE_SIZE) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
    const filter = { recipient };

    const [items, total, unread] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
      this.notificationModel.countDocuments({ ...filter, read: false }).exec(),
    ]);

    return { items, total, unread, page: safePage, limit: safeLimit };
  }

  /** Đánh dấu một thông báo là đã đọc — chỉ thông báo của chính người gọi */
  async markRead(id: string, recipient: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Không tìm thấy thông báo');
    const updated = await this.notificationModel
      .findOneAndUpdate({ _id: id, recipient }, { $set: { read: true } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy thông báo');
    return updated;
  }

  /**
   * Gửi hàng loạt (WBS #23): thông báo chung tới toàn bộ công dân hoặc cán bộ.
   * Phase 1 gửi tuần tự theo lô; khi lượng người nhận lớn nên đẩy qua hàng đợi
   * RabbitMQ (rabbitmq.notificationQueue) để không chặn request HTTP.
   */
  async broadcast(input: {
    channels: NotificationChannel[];
    audience: 'citizen' | 'internal';
    title: string;
    body: string;
    data?: Record<string, string>;
    actor: string;
  }) {
    const recipients = await this.resolveAudience(input.audience);
    let ok = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const results = await this.send({
        channels: input.channels,
        recipient,
        templateKey: TEMPLATE_KEYS.BROADCAST,
        title: input.title,
        body: input.body,
        data: input.data,
      });
      // Coi là thành công nếu có ít nhất một kênh gửi được
      if (Object.values(results).some((r) => r?.ok)) ok += 1;
      else failed += 1;
    }

    this.logger.log(
      `${input.actor} gửi thông báo hàng loạt tới ${recipients.length} người nhận (${input.audience}) — thành công ${ok}`,
    );

    // Lưu lại lượt gửi để màn hình "Lịch sử gửi" tra được về sau
    const log = await this.broadcastLogModel.create({
      channels: input.channels,
      audience: input.audience,
      title: input.title,
      body: input.body,
      sentBy: input.actor,
      total: recipients.length,
      delivered: ok,
      failed,
      status: broadcastStatus(recipients.length, ok),
    });

    return { id: String(log._id), audience: input.audience, total: recipients.length, ok, failed, status: log.status };
  }

  /**
   * Lịch sử các lượt gửi hàng loạt (WBS #23).
   * Chỉ trả số liệu tổng hợp — không có danh sách người nhận nên không lộ SĐT thật.
   */
  async listBroadcasts(audience?: 'citizen' | 'internal', page = DEFAULT_PAGE, limit = BROADCAST_DEFAULT_PAGE_SIZE) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), BROADCAST_MAX_PAGE_SIZE);
    const filter = audience ? { audience } : {};

    const [items, total] = await Promise.all([
      this.broadcastLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.broadcastLogModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((doc) => ({
        id: String(doc._id),
        channels: doc.channels,
        audience: doc.audience,
        title: doc.title,
        body: doc.body,
        sentBy: doc.sentBy,
        total: doc.total,
        delivered: doc.delivered,
        failed: doc.failed,
        status: doc.status,
        createdAt: doc.createdAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  /** Danh sách người nhận theo nhóm đối tượng */
  private async resolveAudience(audience: 'citizen' | 'internal'): Promise<string[]> {
    if (audience === 'internal') {
      const staff = await this.staffModel
        .find({ status: 'active' })
        .select('username')
        .limit(BROADCAST_MAX_RECIPIENTS)
        .lean()
        .exec();
      return staff.map((s) => s.username);
    }
    const citizens = await this.citizenModel
      .find({ status: 'active' })
      .select('phone')
      .limit(BROADCAST_MAX_RECIPIENTS)
      .lean()
      .exec();
    return citizens.map((c) => c.phone);
  }
}

/** Trạng thái lượt gửi: đủ / một phần / hỏng hoàn toàn */
function broadcastStatus(total: number, delivered: number): BroadcastStatus {
  if (delivered >= total) return 'sent';
  if (delivered === 0) return 'failed';
  return 'partial';
}

/** dd/MM/yyyy — định dạng hiển thị thống nhất với FE */
function formatDate(value: Date): string {
  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${value.getFullYear()}`;
}
