/**
 * Cấu hình cấp ứng dụng — điểm tập trung duy nhất đọc biến môi trường.
 * Mọi nơi khác trong mã nguồn KHÔNG đọc process.env trực tiếp.
 */
export const appConfig = {
  /** Tên nền tảng */
  appName: "ViGov",
  appTagline: "Điều hành số cấp xã",

  /** Đơn vị hành chính đang vận hành */
  org: {
    name: process.env.NEXT_PUBLIC_ORG_NAME ?? "UBND Xã",
    parent: process.env.NEXT_PUBLIC_ORG_PARENT ?? "",
    short: process.env.NEXT_PUBLIC_ORG_SHORT ?? "VG",
  },

  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",

  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
    /** true = dùng dữ liệu mock trong src/mocks thay vì gọi backend */
    useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") === "true",
    /** Độ trễ giả lập khi dùng mock (ms) — để UI thể hiện trạng thái tải */
    mockDelayMs: 250,
  },

  auth: {
    storageKey: "vigov.session",
    loginPath: "/login",
    afterLoginPath: "/",
    /** Tài khoản demo cho chế độ mock — gỡ khi nối backend thật */
    demoUsername: process.env.NEXT_PUBLIC_DEMO_USERNAME ?? "",
    demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "",
  },

  map: {
    provider: process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "mock",
    apiKey: process.env.NEXT_PUBLIC_MAP_API_KEY ?? "",
  },

  /** Tải tệp lên — các ngưỡng phải khớp cấu hình storage của backend */
  files: {
    /** Dung lượng tối đa mỗi tệp (byte); đồng bộ với STORAGE_MAX_FILE_SIZE */
    maxSize: Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE ?? 20 * 1024 * 1024),
    /** Hiệu lực link ký sẵn khi mở tệp riêng tư (giây) */
    signedUrlTtl: 600,
  },

  /** Định dạng hiển thị chung */
  locale: "vi-VN",
  currencyUnit: "tỷ đồng",
} as const;

export type AppConfig = typeof appConfig;
