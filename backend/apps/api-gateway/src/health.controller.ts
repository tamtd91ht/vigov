import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '@vigov/shared';
import { MessagingService } from './modules/messaging/messaging.service';

/** Mã trạng thái kết nối Mongoose: 1 = đã kết nối */
const MONGO_CONNECTED = 1;

/**
 * Endpoint kiểm tra sức khoẻ dịch vụ — dùng cho HEALTHCHECK của Docker,
 * load balancer và giám sát hạ tầng. Công khai để không cần token.
 */
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly messaging: MessagingService,
  ) {}

  /** Tiến trình còn sống (liveness) — không chạm cơ sở dữ liệu */
  @Public()
  @Get()
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /**
   * Sẵn sàng phục vụ (readiness).
   *
   * CHỈ MongoDB quyết định "sẵn sàng": mất cơ sở dữ liệu là mất toàn bộ nghiệp vụ.
   * RabbitMQ là hạ tầng PHỤ (P5-04) — broker chết hoặc đang chặn publish thì hệ thống
   * vẫn phục vụ đầy đủ, chỉ mất kênh thông báo bất đồng bộ. Vì vậy trạng thái broker
   * được BÁO CÁO cho hệ giám sát nhưng TUYỆT ĐỐI không làm endpoint này trả 503,
   * nếu không load balancer sẽ rút cả API Gateway ra khỏi vòng phục vụ vì một sự cố
   * không liên quan tới khả năng phục vụ.
   */
  @Public()
  @Get('ready')
  ready() {
    const dbConnected = this.mongo.readyState === MONGO_CONNECTED;
    const messaging = this.messaging.getStatus();

    if (!dbConnected) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        database: 'disconnected',
        messaging,
      });
    }

    return { status: 'ok', database: 'connected', messaging };
  }
}
