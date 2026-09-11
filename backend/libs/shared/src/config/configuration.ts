/**
 * Cấu hình tập trung — đọc biến môi trường một chỗ duy nhất.
 * Mọi service khác dùng ConfigService.get('...'), KHÔNG đọc process.env trực tiếp.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',

  /**
   * Tên đơn vị, dùng cho phần đầu biểu mẫu của tệp xuất (Excel, PDF).
   *
   * Một mã nguồn chạy cho nhiều xã nên tên đơn vị KHÔNG được viết cứng trong bộ
   * xuất — sai tên đơn vị trên một bảng biểu gửi cấp trên là sự cố có người phải
   * giải trình. Mặc định là chuỗi trung tính, không phải tên của khách nào.
   */
  org: {
    name: process.env.ORG_NAME ?? 'UBND xã',
    parent: process.env.ORG_PARENT ?? '',
  },

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
    /**
     * Mã OTP dự phòng cho giai đoạn CHƯA có quyền getPhoneNumber của Zalo.
     * Để TRỐNG là tắt hẳn. Xem SECURITY.md — phải xoá trước khi mở cho dân.
     */
    otpBypassCode: process.env.CITIZEN_OTP_BYPASS_CODE ?? '',
    /**
     * Nơi lưu mã OTP: `memory` (mặc định, một tiến trình) hoặc `mongo`.
     * BẮT BUỘC đặt `mongo` khi chạy nhiều instance sau bộ cân bằng tải —
     * xem SECURITY.md phát hiện TB-08.
     */
    otpStore: process.env.OTP_STORE ?? 'memory',
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

  /**
   * Ngưỡng cảnh báo tiến độ giải ngân.
   *
   * Bản đầu viết cứng 0.7 trong `disbursement.service.ts`. Mỗi địa phương có
   * cách siết tiến độ khác nhau và ngưỡng này sẽ được bàn lại hằng năm, nên nó
   * phải là cấu hình — xem `rules/critical/khong-hardcode.md`.
   *
   * Dùng `||` thay vì `??`: đường triển khai Docker sinh ra CHUỖI RỖNG chứ
   * không phải undefined, và `Number.parseFloat('')` là NaN — cả hai đều phải
   * rơi về mặc định.
   */
  disbursement: {
    /** Đạt dưới tỷ lệ này so với kế hoạch luỹ kế đã tới hạn → cảnh báo nguy cơ chậm */
    riskRatio: Number.parseFloat(process.env.DISBURSEMENT_RISK_RATIO || '') || 0.8,
    /** Còn bao nhiêu ngày tới hạn kết thúc thì coi là "sắp đến hạn" */
    dueSoonDays: Number.parseInt(process.env.DISBURSEMENT_DUE_SOON_DAYS || '', 10) || 30,
  },

  /** Provider bên thứ 3 — chốt sau (câu hỏi mở #1, #2, #3) */
  ocr: {
    provider: process.env.OCR_PROVIDER ?? 'mock',
    apiKey: process.env.OCR_API_KEY ?? '',
    /**
     * Điểm cuối của dịch vụ OCR. Để trống thì provider tự dùng mặc định của
     * mình — biến này chỉ cần khi đổi sang máy chủ riêng hoặc bản tự dựng.
     */
    endpoint: process.env.OCR_ENDPOINT ?? '',
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
    oaAccessToken: process.env.ZALO_OA_ACCESS_TOKEN ?? '',
    znsTemplateFeedbackReceived: process.env.ZNS_TEMPLATE_FEEDBACK_RECEIVED ?? '',
    znsTemplateFeedbackResolved: process.env.ZNS_TEMPLATE_FEEDBACK_RESOLVED ?? '',
  },
  push: {
    provider: process.env.PUSH_PROVIDER ?? 'mock',
    fcmServerKey: process.env.FCM_SERVER_KEY ?? '',
  },
});
