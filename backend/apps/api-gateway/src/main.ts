import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { assertProductionSecrets, buildCorsOptions, securityHeaders } from './security.middleware';

/** Giới hạn mặc định cho thân yêu cầu JSON / form (tệp đi qua Multer, có hạn mức riêng) */
const DEFAULT_BODY_LIMIT = '1mb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const isProduction = config.get<string>('env') === 'production';

  // Không tiết lộ công nghệ máy chủ
  app.disable('x-powered-by');

  /*
   * Đứng sau nginx/reverse proxy thì Express phải tin X-Forwarded-For,
   * nếu không rate-limit và nhật ký sẽ ghi nhầm IP của proxy cho mọi người dùng.
   */
  const trustProxy = (config.get<string>('security.trustProxy') ?? '').trim();
  if (trustProxy) {
    const hops = Number.parseInt(trustProxy, 10);
    app.set('trust proxy', Number.isNaN(hops) ? trustProxy : hops);
  }

  // Header bảo mật cho mọi phản hồi (thay cho helmet — xem security.middleware.ts)
  app.use(
    securityHeaders({
      production: isProduction,
      hstsMaxAge: config.get<number>('security.hstsMaxAge'),
    }),
  );

  // Giới hạn kích thước thân yêu cầu để chặn tấn công làm cạn bộ nhớ
  const bodyLimit = config.get<string>('security.bodyLimit') ?? DEFAULT_BODY_LIMIT;
  /*
   * Giữ lại thân yêu cầu THÔ cho webhook Zalo. Chữ ký phải được tính trên đúng
   * chuỗi byte Zalo đã gửi; `JSON.stringify(req.body)` sau khi parse có thể đổi
   * thứ tự khoá hoặc cách escape, làm chữ ký lệch mà không rõ vì sao.
   */
  app.use(
    json({
      limit: bodyLimit,
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api/v1'));

  /*
   * forbidNonWhitelisted: yêu cầu chứa trường lạ sẽ bị từ chối 400 thay vì âm thầm
   * bỏ qua — chặn kiểu tấn công gán thêm thuộc tính (mass assignment).
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Chặn khởi động production khi còn dùng khoá ký JWT mẫu
  assertProductionSecrets(config.get<string>('auth.jwtSecret'), isProduction);

  // CORS theo whitelist đọc từ cấu hình (CORS_ORIGINS)
  const cors = buildCorsOptions(config.get<string>('security.corsOrigins'), isProduction);
  app.enableCors(cors);
  logger.log(
    cors.origin === true
      ? 'CORS: cho phép mọi nguồn (chỉ dùng ở môi trường phát triển)'
      : `CORS: chỉ chấp nhận ${cors.origin.join(', ')}`,
  );

  await app.listen(config.get<number>('PORT', 3001));

  /*
   * Đứng sau nginx: keepAliveTimeout của Node PHẢI lớn hơn keepalive timeout
   * mà proxy giữ, nếu không sẽ 502 ngẫu nhiên.
   *
   * Node mặc định đóng socket rảnh sau 5s, còn nginx KHÔNG tự hết hạn
   * connection trong upstream keepalive pool — nó chỉ bỏ khi upstream chủ động
   * đóng, hoặc khi pool đầy phải evict. Traffic thưa là gặp đúng cửa sổ: nginx
   * lấy lại một socket Node vừa đóng, ghi request vào đó và nhận RST → trả 502
   * gần như tức thì (không phải timeout, nên không ra 504).
   *
   * headersTimeout phải LỚN HƠN keepAliveTimeout, nếu không Node cắt kết nối
   * sai thời điểm trong lúc đang đọc header của request kế tiếp.
   */
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

void bootstrap();
