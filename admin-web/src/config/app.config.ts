/**
 * Cấu hình cấp ứng dụng — điểm tập trung duy nhất đọc biến môi trường.
 * Mọi nơi khác trong mã nguồn KHÔNG đọc process.env trực tiếp.
 */

/**
 * Đọc biến môi trường, coi **chuỗi rỗng là CHƯA ĐẶT**.
 *
 * VÌ SAO KHÔNG DÙNG `??` TRỰC TIẾP: `??` chỉ rơi về mặc định khi giá trị là
 * `undefined`, còn chuỗi rỗng thì nó nhận. Mà đường triển khai thật lại sinh ra
 * đúng chuỗi rỗng: `docker-compose.yml` truyền `${BIẾN:-}` cho mọi biến không
 * khai trong `.env`, rồi Dockerfile gán tiếp thành `ENV BIẾN=`.
 *
 * Hậu quả nếu để `??`: `.env` trên máy chủ thiếu một biến là tên xã hiện thành
 * chuỗi trống ("UBND " không có gì đằng sau), tâm bản đồ thành `Number("") = 0`
 * (giữa Vịnh Guinea), và style bản đồ thành URL rỗng — tất cả đều KHÔNG báo lỗi.
 */
function envText(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? fallback : trimmed;
}

/** Như `envText` nhưng cho số; giá trị không phải số cũng rơi về mặc định */
function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(envText(value, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Cờ bật/tắt: chỉ đúng chữ "true" là bật; rỗng ⇒ dùng mặc định */
function envFlag(value: string | undefined, fallback: boolean): boolean {
  return envText(value, fallback ? "true" : "false") === "true";
}

export const appConfig = {
  /** Tên nền tảng */
  appName: "ViGov",
  appTagline: "Điều hành số cấp xã",

  /** Đơn vị hành chính đang vận hành */
  org: {
    name: envText(process.env.NEXT_PUBLIC_ORG_NAME, "UBND Xã"),
    parent: envText(process.env.NEXT_PUBLIC_ORG_PARENT, ""),
    short: envText(process.env.NEXT_PUBLIC_ORG_SHORT, "VG"),
  },

  version: envText(process.env.NEXT_PUBLIC_APP_VERSION, "dev"),

  api: {
    baseUrl: envText(process.env.NEXT_PUBLIC_API_BASE_URL, "/api/v1"),
    /** true = dùng dữ liệu mock trong src/mocks thay vì gọi backend */
    // Mặc định gọi API thật. Mock là lựa chọn CÓ CHỦ Ý để trình diễn giao diện
    // khi chưa dựng backend, bật bằng NEXT_PUBLIC_USE_MOCKS=true.
    useMocks: envFlag(process.env.NEXT_PUBLIC_USE_MOCKS, false),
    /** Độ trễ giả lập khi dùng mock (ms) — để UI thể hiện trạng thái tải */
    mockDelayMs: 250,
  },

  auth: {
    storageKey: "vigov.session",
    loginPath: "/login",
    afterLoginPath: "/",
    /** Tài khoản demo cho chế độ mock — gỡ khi nối backend thật */
    demoUsername: envText(process.env.NEXT_PUBLIC_DEMO_USERNAME, ""),
    demoPassword: envText(process.env.NEXT_PUBLIC_DEMO_PASSWORD, ""),
  },

  map: {
    /**
     * Adapter bản đồ đang dùng: `mock` (bản mô phỏng CSS) hoặc bất kỳ nguồn
     * style theo chuẩn MapLibre (`openfreemap`, `vietmap`, `goong`, tự dựng…).
     * MapPage chọn component theo giá trị này, không hardcode ở component nào.
     */
    provider: envText(process.env.NEXT_PUBLIC_MAP_PROVIDER, "mock"),
    apiKey: envText(process.env.NEXT_PUBLIC_MAP_API_KEY, ""),
    /**
     * URL style MapLibre. Mặc định là OpenFreeMap (dữ liệu OpenStreetMap,
     * không cần khoá API, không giới hạn lượt xem) — bản `positron` nhạt màu
     * để ghim và popup nổi lên trên.
     */
    styleUrl: envText(
      process.env.NEXT_PUBLIC_MAP_STYLE_URL,
      "https://tiles.openfreemap.org/styles/positron",
    ),
    /** Tâm bản đồ lúc mở trang — mỗi đơn vị hành chính một toạ độ khác nhau */
    center: {
      lat: envNumber(process.env.NEXT_PUBLIC_MAP_CENTER_LAT, 20.6935),
      lng: envNumber(process.env.NEXT_PUBLIC_MAP_CENTER_LNG, 105.9285),
    },
    zoom: envNumber(process.env.NEXT_PUBLIC_MAP_ZOOM, 14),
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
    enabled: envFlag(process.env.NEXT_PUBLIC_REALTIME_ENABLED, true),
  },

  /** Đầu mối hỗ trợ hiển thị ở trang Trợ giúp — mỗi xã một số khác nhau */
  support: {
    email: envText(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, ""),
    phone: envText(process.env.NEXT_PUBLIC_SUPPORT_PHONE, ""),
    hours: envText(process.env.NEXT_PUBLIC_SUPPORT_HOURS, "Giờ hành chính, thứ Hai – thứ Sáu"),
  },

  /** Tải tệp lên — các ngưỡng phải khớp cấu hình storage của backend */
  files: {
    /** Dung lượng tối đa mỗi tệp (byte); đồng bộ với STORAGE_MAX_FILE_SIZE */
    maxSize: envNumber(process.env.NEXT_PUBLIC_MAX_FILE_SIZE, 20 * 1024 * 1024),
    /** Hiệu lực link ký sẵn khi mở tệp riêng tư (giây) */
    signedUrlTtl: 600,
  },

  /** Định dạng hiển thị chung */
  locale: "vi-VN",
  currencyUnit: "tỷ đồng",
} as const;

export type AppConfig = typeof appConfig;
