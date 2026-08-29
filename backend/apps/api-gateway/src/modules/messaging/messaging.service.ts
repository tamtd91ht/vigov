import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import { EVENTS, type EventName } from '@vigov/shared';

/* ───────────────────────── Kiểu tối thiểu của amqplib ─────────────────────────
 *
 * Gói `amqplib` KHÔNG kèm khai báo kiểu và `@types/amqplib` không nằm trong danh
 * sách phụ thuộc đã chốt của dự án. Thay vì để `any` lọt vào mã nghiệp vụ, khai báo
 * tại chỗ đúng những gì module này dùng — sai chữ ký sẽ bị TypeScript bắt ngay.
 */

/** Một tin lấy từ hàng đợi */
interface AmqpMessage {
  content: Buffer;
  properties: { headers?: Record<string, unknown> };
}

/** Kênh AMQP (chế độ confirm) — chỉ khai báo phần module này gọi tới */
interface AmqpChannel {
  assertQueue(queue: string, options?: AssertQueueOptions): Promise<unknown>;
  prefetch(count: number): Promise<unknown>;
  consume(queue: string, onMessage: (msg: AmqpMessage | null) => void): Promise<unknown>;
  sendToQueue(queue: string, content: Buffer, options?: PublishOptions): boolean;
  ack(message: AmqpMessage, allUpTo?: boolean): void;
  nack(message: AmqpMessage, allUpTo?: boolean, requeue?: boolean): void;
}

/** Tham số khai báo hàng đợi */
interface AssertQueueOptions {
  durable?: boolean;
  /** Exchange nhận tin bị từ chối; chuỗi rỗng = exchange mặc định */
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
}

/** Tham số gửi tin */
interface PublishOptions {
  persistent?: boolean;
  contentType?: string;
  headers?: Record<string, unknown>;
  /** Thư viện tự huỷ tin nếu quá hạn này (ms) */
  timeout?: number;
}

/* ───────────────────────── Hằng số cấu hình hàng đợi (P5-04) ───────────────────────── */

/**
 * Thời gian chờ tối đa cho MỘT lần gửi tin (ms).
 *
 * Đây là chốt chặn quan trọng nhất của module: RabbitMQ của khách có thể rơi vào
 * trạng thái chặn publish (máy chủ hết dung lượng đĩa — `connection.blocked` với lý do
 * "low on disk"). Khi đó lệnh publish KHÔNG BAO GIỜ được broker xác nhận. Nếu chờ vô
 * hạn thì mọi request HTTP gọi tới đây sẽ treo. Hết thời gian này thì bỏ tin, ghi log
 * cảnh báo và trả về false — nghiệp vụ chính vẫn chạy bình thường.
 */
export const PUBLISH_TIMEOUT_MS = 3000;

/** Thời gian chờ tối đa cho một lần bắt tay TCP tới broker (ms) */
const CONNECT_TIMEOUT_MS = 5000;

/** Nhịp heartbeat với broker (giây) — phát hiện đứt kết nối nhanh */
const HEARTBEAT_SECONDS = 10;

/** Khoảng chờ giữa hai lần thử kết nối lại (giây) */
const RECONNECT_SECONDS = 5;

/** Thời gian chờ tối đa khi đóng kết nối lúc tắt ứng dụng (ms) */
const SHUTDOWN_TIMEOUT_MS = 2000;

/** Hậu tố hàng đợi chết (dead-letter): vigov.notification → vigov.notification.dlq */
export const DLQ_SUFFIX = '.dlq';

/** Số lần thử lại một tin trước khi đẩy sang hàng đợi chết */
export const CONSUMER_MAX_RETRY = 3;

/** Số tin broker được phép đẩy song song cho một consumer */
const CONSUMER_PREFETCH = 10;

/** Header mang số lần đã thử xử lý một tin */
const RETRY_HEADER = 'x-vigov-attempt';

/**
 * Bảng định tuyến sự kiện → hàng đợi.
 *
 * - `notification`: các sự kiện mà NotificationModule tiêu thụ để gửi thông báo
 *   (in-app / ZNS / push). Đây là kênh PHỤ, chạy song song với lời gọi trực tiếp.
 * - `workflow`: các sự kiện nghiệp vụ khác, để dành cho worker tách tiến trình
 *   khi hệ thống tách micro-service (Phase 2).
 */
const EVENT_ROUTES: Record<EventName, 'notification' | 'workflow'> = {
  [EVENTS.DOCUMENT_ASSIGNED]: 'notification',
  [EVENTS.FEEDBACK_ASSIGNED]: 'notification',
  [EVENTS.TASK_DEADLINE_WARNING]: 'notification',
  [EVENTS.NOTIFICATION_REQUESTED]: 'notification',
  [EVENTS.FEEDBACK_CREATED]: 'workflow',
  [EVENTS.FEEDBACK_RESOLVED]: 'workflow',
  [EVENTS.DISBURSEMENT_REQUESTED]: 'workflow',
};

/* ───────────────────────────── Kiểu dữ liệu ───────────────────────────── */

/** Phong bì tin gửi qua hàng đợi — luôn kèm tên sự kiện và mốc thời gian phát */
export interface QueueEnvelope<T = unknown> {
  event: EventName;
  payload: T;
  /** ISO 8601 — thời điểm phát sự kiện */
  at: string;
}

/** Trạng thái kết nối broker, dùng cho /health/ready và giám sát */
export interface MessagingStatus {
  connected: boolean;
  blocked: boolean;
  /** Lý do broker chặn publish (ví dụ "low on disk"); rỗng khi không bị chặn */
  reason: string;
}

/** Hàm xử lý một tin lấy từ hàng đợi; ném lỗi = xử lý thất bại → thử lại */
export type QueueHandler = (envelope: QueueEnvelope) => Promise<void>;

/* ───────────────────────────── Service ───────────────────────────── */

/**
 * Cổng giao tiếp RabbitMQ dùng chung (P5-04).
 *
 * NGUYÊN TẮC BẤT DI BẤT DỊCH: hàng đợi là hạ tầng PHỤ. Broker chết, broker chặn
 * publish hay mạng đứt đều KHÔNG được phép làm treo hoặc lỗi một request HTTP nào.
 * Mọi phương thức public ở đây đều nuốt lỗi và trả về giá trị "thất bại êm".
 *
 * - Kết nối chạy nền qua amqp-connection-manager: `onModuleInit` KHÔNG await nên
 *   ứng dụng khởi động bình thường ngay cả khi broker không truy cập được.
 * - `publish()` có timeout cứng PUBLISH_TIMEOUT_MS.
 * - Khi broker báo `blocked` thì bỏ qua publish NGAY, không chờ hết timeout
 *   (nếu vẫn gọi sendToQueue, thư viện sẽ dồn tin trong RAM cho tới khi hết bộ nhớ).
 */
@Injectable()
export class MessagingService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MessagingService.name);

  private connection?: AmqpConnectionManager;
  private publisher?: ChannelWrapper;
  private readonly consumers: ChannelWrapper[] = [];

  /** Broker đang chặn publish (hết đĩa / hết RAM) */
  private blocked = false;
  private blockReason = '';
  /** Đã ghi log mất kết nối rồi thì thôi, tránh ngập nhật ký khi broker chết dài ngày */
  private disconnectLogged = false;

  private readonly notificationQueue: string;
  private readonly workflowQueue: string;
  private readonly notificationDlq: string;
  private readonly workflowDlq: string;

  constructor(private readonly config: ConfigService) {
    this.notificationQueue = this.config.get<string>('rabbitmq.notificationQueue', 'vigov.notification');
    this.workflowQueue = this.config.get<string>('rabbitmq.workflowQueue', 'vigov.workflow');
    this.notificationDlq = `${this.notificationQueue}${DLQ_SUFFIX}`;
    this.workflowDlq = `${this.workflowQueue}${DLQ_SUFFIX}`;
  }

  /** Tên hàng đợi thông báo (NotificationModule đăng ký consumer trên hàng đợi này) */
  get notificationQueueName(): string {
    return this.notificationQueue;
  }

  onModuleInit(): void {
    const uri = this.config.get<string>('rabbitmq.uri');
    if (!uri) {
      this.logger.warn('Chưa cấu hình RABBITMQ_URI — bỏ qua hàng đợi, hệ thống chạy chế độ gọi trực tiếp');
      return;
    }

    /*
     * amqp.connect() trả về ngay và tự thử lại nền — KHÔNG await ở đây, nếu không
     * broker chết sẽ chặn toàn bộ quá trình khởi động API Gateway.
     */
    this.connection = amqp.connect([uri], {
      heartbeatIntervalInSeconds: HEARTBEAT_SECONDS,
      reconnectTimeInSeconds: RECONNECT_SECONDS,
      connectionOptions: { timeout: CONNECT_TIMEOUT_MS },
    });

    this.connection.on('connect', () => {
      this.disconnectLogged = false;
      this.blocked = false;
      this.blockReason = '';
      this.logger.log(`Đã kết nối RabbitMQ (${safeUri(uri)})`);
    });

    this.connection.on('connectFailed', ({ err }) => this.logDisconnect(err?.message));
    this.connection.on('disconnect', ({ err }) => this.logDisconnect(err?.message));

    // Broker hết đĩa / hết RAM → chặn mọi publish. Ghi nhận để bỏ qua tin ngay lập tức.
    this.connection.on('blocked', ({ reason }) => {
      this.blocked = true;
      this.blockReason = reason || 'không rõ lý do';
      this.logger.error(
        `RabbitMQ ĐANG CHẶN publish (${this.blockReason}). Sự kiện sẽ bị bỏ qua cho tới khi broker mở lại — ` +
          'nghiệp vụ chính không bị ảnh hưởng.',
      );
    });

    this.connection.on('unblocked', () => {
      this.blocked = false;
      this.blockReason = '';
      this.logger.log('RabbitMQ đã mở chặn, tiếp tục gửi sự kiện bình thường');
    });

    this.publisher = this.connection.createChannel({
      name: 'vigov-publisher',
      json: true,
      // Chốt chặn thứ hai của thư viện, bổ trợ cho race timeout trong publish()
      publishTimeout: PUBLISH_TIMEOUT_MS,
      setup: (channel: AmqpChannel) => this.declareTopology(channel),
    });

    // Lỗi khai báo hàng đợi không được để nổi lên thành unhandled error của tiến trình
    this.publisher.on('error', (err) =>
      this.logger.warn(`Kênh gửi RabbitMQ gặp lỗi: ${errorText(err)} (sẽ tự dựng lại)`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    // Đóng có giới hạn thời gian: broker treo không được phép giữ tiến trình không tắt
    const closing = (async () => {
      for (const consumer of this.consumers) await consumer.close().catch(() => undefined);
      await this.publisher?.close().catch(() => undefined);
      await this.connection?.close().catch(() => undefined);
    })();
    await withTimeout(closing, SHUTDOWN_TIMEOUT_MS).catch(() =>
      this.logger.warn('Đóng kết nối RabbitMQ quá thời gian cho phép — bỏ qua để tiến trình tắt được'),
    );
  }

  /* ─────────────────────────── Gửi sự kiện ─────────────────────────── */

  /**
   * Đẩy một sự kiện vào hàng đợi tương ứng.
   *
   * KHÔNG BAO GIỜ ném lỗi và KHÔNG BAO GIỜ chờ quá PUBLISH_TIMEOUT_MS.
   * Trả về `true` khi broker đã xác nhận nhận tin, `false` trong mọi trường hợp còn lại.
   * Nơi gọi chỉ nên dùng giá trị này để ghi log, tuyệt đối không rẽ nhánh nghiệp vụ theo nó.
   */
  async publish(event: EventName, payload: unknown): Promise<boolean> {
    const queue = this.queueFor(event);

    if (!this.publisher || !this.connection?.isConnected()) {
      this.logger.warn(`Bỏ qua sự kiện ${event}: chưa kết nối được RabbitMQ`);
      return false;
    }

    // Broker đang chặn: bỏ qua NGAY, không chờ timeout và không dồn tin vào RAM
    if (this.blocked) {
      this.logger.warn(`Bỏ qua sự kiện ${event}: broker đang chặn publish (${this.blockReason})`);
      return false;
    }

    const envelope: QueueEnvelope = { event, payload, at: new Date().toISOString() };
    const options: PublishOptions = {
      persistent: true,
      contentType: 'application/json',
      timeout: PUBLISH_TIMEOUT_MS,
    };

    try {
      await withTimeout(this.publisher.sendToQueue(queue, envelope, options), PUBLISH_TIMEOUT_MS);
      this.logger.debug(`Đã gửi ${event} vào hàng đợi ${queue}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Không gửi được sự kiện ${event} vào ${queue}: ${errorText(err)} — nghiệp vụ chính vẫn hoàn tất`,
      );
      return false;
    }
  }

  /* ─────────────────────────── Nhận sự kiện ─────────────────────────── */

  /**
   * Đăng ký consumer cho một hàng đợi.
   *
   * Không await: kênh được dựng nền và tự dựng lại sau mỗi lần mất kết nối.
   * Tin xử lý lỗi sẽ được gửi lại tối đa CONSUMER_MAX_RETRY lần, sau đó bị nack
   * để broker chuyển sang hàng đợi chết (`<queue>.dlq`) cho người vận hành xử lý tay.
   */
  consume(queue: string, handler: QueueHandler): void {
    if (!this.connection) {
      this.logger.warn(`Không đăng ký được consumer cho ${queue}: chưa cấu hình RabbitMQ`);
      return;
    }

    const wrapper = this.connection.createChannel({
      name: `vigov-consumer-${queue}`,
      setup: async (channel: AmqpChannel) => {
        await this.declareTopology(channel);
        await channel.prefetch(CONSUMER_PREFETCH);
        await channel.consume(queue, (msg) => {
          if (msg) void this.handleMessage(channel, queue, msg, handler);
        });
        this.logger.log(`Đang lắng nghe hàng đợi ${queue} (thử lại tối đa ${CONSUMER_MAX_RETRY} lần → ${queue}${DLQ_SUFFIX})`);
      },
    });

    wrapper.on('error', (err) =>
      this.logger.warn(`Kênh nhận ${queue} gặp lỗi: ${errorText(err)} (sẽ tự dựng lại)`),
    );

    this.consumers.push(wrapper);
  }

  /* ─────────────────────────── Trạng thái ─────────────────────────── */

  /** Broker sẵn sàng nhận tin (đã kết nối và không bị chặn) */
  isReady(): boolean {
    return Boolean(this.connection?.isConnected()) && !this.blocked;
  }

  /** Trạng thái chi tiết cho /health/ready và hệ giám sát */
  getStatus(): MessagingStatus {
    return {
      connected: Boolean(this.connection?.isConnected()),
      blocked: this.blocked,
      reason: this.blocked ? this.blockReason : '',
    };
  }

  /* ─────────────────────────── Nội bộ ─────────────────────────── */

  /** Hàng đợi đích của một sự kiện theo bảng định tuyến EVENT_ROUTES */
  private queueFor(event: EventName): string {
    return EVENT_ROUTES[event] === 'workflow' ? this.workflowQueue : this.notificationQueue;
  }

  /**
   * Khai báo hàng đợi nghiệp vụ + hàng đợi chết.
   * Chạy lại sau MỖI lần kết nối lại nên phải idempotent (assertQueue là idempotent
   * khi tham số không đổi).
   */
  private async declareTopology(channel: AmqpChannel): Promise<void> {
    await channel.assertQueue(this.notificationDlq, { durable: true });
    await channel.assertQueue(this.workflowDlq, { durable: true });

    // deadLetterExchange rỗng = exchange mặc định, routing key chính là tên hàng đợi chết
    await channel.assertQueue(this.notificationQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: this.notificationDlq,
    });
    await channel.assertQueue(this.workflowQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: this.workflowDlq,
    });
  }

  /** Xử lý một tin: giải mã → gọi handler → ack / thử lại / đẩy sang hàng đợi chết */
  private async handleMessage(
    channel: AmqpChannel,
    queue: string,
    msg: AmqpMessage,
    handler: QueueHandler,
  ): Promise<void> {
    let envelope: QueueEnvelope;
    try {
      envelope = JSON.parse(msg.content.toString()) as QueueEnvelope;
    } catch {
      // Tin hỏng thì thử lại bao nhiêu lần cũng hỏng — đẩy thẳng sang hàng đợi chết
      this.logger.error(`Tin trong ${queue} không phải JSON hợp lệ, chuyển sang ${queue}${DLQ_SUFFIX}`);
      channel.nack(msg, false, false);
      return;
    }

    const attempt = Number(msg.properties.headers?.[RETRY_HEADER] ?? 0);

    try {
      await handler(envelope);
      channel.ack(msg);
    } catch (err) {
      const next = attempt + 1;
      if (next < CONSUMER_MAX_RETRY) {
        this.logger.warn(
          `Xử lý ${envelope.event} thất bại (lần ${next}/${CONSUMER_MAX_RETRY}): ${errorText(err)} — gửi lại vào ${queue}`,
        );
        channel.sendToQueue(queue, msg.content, {
          persistent: true,
          contentType: 'application/json',
          headers: { [RETRY_HEADER]: next },
        });
        channel.ack(msg);
        return;
      }
      this.logger.error(
        `Xử lý ${envelope.event} thất bại ${CONSUMER_MAX_RETRY} lần: ${errorText(err)} — chuyển sang ${queue}${DLQ_SUFFIX}`,
      );
      channel.nack(msg, false, false);
    }
  }

  /** Ghi log mất kết nối đúng MỘT lần cho mỗi lần đứt, tránh ngập nhật ký */
  private logDisconnect(reason?: string): void {
    if (this.disconnectLogged) return;
    this.disconnectLogged = true;
    this.logger.warn(
      `Mất kết nối RabbitMQ: ${reason ?? 'không rõ lý do'} — sẽ tự kết nối lại mỗi ${RECONNECT_SECONDS}s. ` +
        'Sự kiện phát ra trong lúc này sẽ bị bỏ qua, nghiệp vụ chính không bị ảnh hưởng.',
    );
  }
}

/* ─────────────────────────── Hàm thuần dùng chung ─────────────────────────── */

/** Chạy một promise với hạn chót cứng; quá hạn thì reject để nơi gọi bỏ qua */
function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`quá ${ms}ms broker không phản hồi`)), ms);
  });
  return Promise.race([task, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Lấy thông điệp lỗi ở dạng chuỗi, không làm lộ stack ra nhật ký vận hành */
function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Che mật khẩu trong URI trước khi ghi nhật ký: amqp://user:***@host:5672 */
function safeUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):[^@/]*@/, '//$1:***@');
}
