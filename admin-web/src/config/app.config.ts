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
    // Mặc định gọi API thật. Mock là lựa chọn CÓ CHỦ Ý để trình diễn giao diện
    // khi chưa dựng backend, bật bằng NEXT_PUBLIC_USE_MOCKS=true.
    useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "false") === "true",
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
    /**
     * Adapter bản đồ đang dùng: `mock` (bản mô phỏng CSS) hoặc bất kỳ nguồn
     * style theo chuẩn MapLibre (`openfreemap`, `vietmap`, `goong`, tự dựng…).
     * MapPage chọn component theo giá trị này, không hardcode ở component nào.
     */
    provider: process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "mock",
    apiKey: process.env.NEXT_PUBLIC_MAP_API_KEY ?? "",
    /**
     * URL style MapLibre. Mặc định là OpenFreeMap (dữ liệu OpenStreetMap,
     * không cần khoá API, không giới hạn lượt xem) — bản `positron` nhạt màu
     * để ghim và popup nổi lên trên.
     */
    styleUrl:
      process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron",
    /** Tâm bản đồ lúc mở trang — mỗi đơn vị hành chính một toạ độ khác nhau */
    center: {
      lat: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 20.6935),
      lng: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 105.9285),
    },
    zoom: Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 14),
  },

  /**
   * Kênh thời gian thực (Socket.IO).
   *
   * `namespace` phải khớp REALTIME_NAMESPACE của backend. Địa chỉ máy chủ KHÔNG
   * khai ở đây: nó suy ra từ `api.baseUrl` (bỏ phần đường dẫn API) nên đổi backend
   * chỉ sửa một biến môi trường, không lệch hai nơi.
   */
  realtime: {
    namespace: "/realtime",
    /** Bật/tắt việc nối kênh realtime — tắt thì giao diện chỉ tải lại bằng tay */
    enabled: (process.env.NEXT_PUBLIC_REALTIME_ENABLED ?? "true") === "true",
  },

  /** Đầu mối hỗ trợ hiển thị ở trang Trợ giúp — mỗi xã một số khác nhau */
  support: {
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "",
    hours: process.env.NEXT_PUBLIC_SUPPORT_HOURS ?? "Giờ hành chính, thứ Hai – thứ Sáu",
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
