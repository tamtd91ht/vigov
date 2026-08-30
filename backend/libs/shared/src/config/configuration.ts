/**
 * Cấu hình tập trung — đọc biến môi trường một chỗ duy nhất.
 * Mọi service khác dùng ConfigService.get('...'), KHÔNG đọc process.env trực tiếp.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',

  mongo: {
    uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/vigov',
  },

  rabbitmq: {
    uri: process.env.RABBITMQ_URI ?? 'amqp://guest:guest@localhost:5672',
    notificationQueue: process.env.RABBITMQ_NOTIFICATION_QUEUE ?? 'vigov.notification',
    workflowQueue: process.env.RABBITMQ_WORKFLOW_QUEUE ?? 'vigov.workflow',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN ?? '7d',
  },

  security: {
    throttleTtlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
    /** Chống spam phản ánh: số phiếu tối đa một công dân gửi mỗi ngày */
    feedbackMaxPerDay: parseInt(process.env.FEEDBACK_MAX_PER_DAY ?? '5', 10),

    /**
     * Whitelist CORS — danh sách tên miền phân tách bằng dấu phẩy.
     * Mặc định '*' cho môi trường phát triển; ở production BẮT BUỘC khai báo
     * tên miền thật, main.ts sẽ từ chối khởi động nếu còn để '*'.
     */
    corsOrigins: process.env.CORS_ORIGINS ?? '*',

    /** Giới hạn kích thước thân yêu cầu JSON / form (tệp có hạn mức riêng ở STORAGE_MAX_FILE_SIZE) */
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',

    /** Hiệu lực Strict-Transport-Security (giây) — chỉ áp dụng khi NODE_ENV=production */
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE ?? '31536000', 10),

    /**
     * Cấu hình 'trust proxy' của Express khi chạy sau nginx/load balancer.
     * Ví dụ: '1' (tin 1 lớp proxy) hoặc 'loopback'. Bỏ trống = không tin proxy nào.
     */
    trustProxy: process.env.TRUST_PROXY ?? '',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localDir: process.env.STORAGE_LOCAL_DIR ?? './uploads',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      bucket: process.env.S3_BUCKET ?? '',
      accessKey: process.env.S3_ACCESS_KEY ?? '',
      secretKey: process.env.S3_SECRET_KEY ?? '',
    },
    /** Dung lượng tối đa mỗi tệp (byte) */
    maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE ?? '20971520', 10),
  },

  /** Provider bên thứ 3 — chốt sau (câu hỏi mở #1, #2, #3) */
  ocr: {
    provider: process.env.OCR_PROVIDER ?? 'mock',
    apiKey: process.env.OCR_API_KEY ?? '',
  },
  /**
   * Đọc thẻ căn cước (P5-11) — tách khỏi `ocr` vì khác nhà cung cấp, khác bộ
   * trường, và chịu ràng buộc dữ liệu cá nhân theo NĐ 13/2023.
   */
  idcard: {
    provider: process.env.IDCARD_PROVIDER ?? 'mock',
    apiKey: process.env.IDCARD_API_KEY ?? '',
  },
  geo: {
    provider: process.env.GEO_PROVIDER ?? 'mock',
    apiKey: process.env.GEO_API_KEY ?? '',
  },
  zalo: {
    oaId: process.env.ZALO_OA_ID ?? '',
    appId: process.env.ZALO_APP_ID ?? '',
    appSecret: process.env.ZALO_APP_SECRET ?? '',
    znsTemplateFeedbackReceived: process.env.ZNS_TEMPLATE_FEEDBACK_RECEIVED ?? '',
    znsTemplateFeedbackResolved: process.env.ZNS_TEMPLATE_FEEDBACK_RESOLVED ?? '',
  },
  push: {
    provider: process.env.PUSH_PROVIDER ?? 'mock',
    fcmServerKey: process.env.FCM_SERVER_KEY ?? '',
  },
});
