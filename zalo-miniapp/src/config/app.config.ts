/**
 * Cấu hình cấp ứng dụng — điểm tập trung duy nhất đọc biến môi trường (VITE_*).
 * Mọi nơi khác trong mã nguồn KHÔNG đọc import.meta.env trực tiếp.
 */
export const appConfig = {
  appName: "ViGov",
  appTagline: "Điều hành số cấp xã",

  org: {
    name: import.meta.env.VITE_ORG_NAME ?? "Xã Đại Thắng",
    parent: import.meta.env.VITE_ORG_PARENT ?? "Huyện Phú Xuyên · Thành phố Hà Nội",
    short: import.meta.env.VITE_ORG_SHORT ?? "VG",
  },

  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1",
    /**
     * true = dùng dữ liệu mẫu trong src/mocks thay vì gọi backend.
     * Mặc định TẮT: từ P5-03 các màn đã nối API thật; bật lại khi cần
     * trình diễn offline (không có máy chủ). Nhánh rẽ nằm trong các service.
     */
    useMocks: (import.meta.env.VITE_USE_MOCKS ?? "false") === "true",
    /** Độ trễ giả lập khi dùng mock */
    mockDelayMs: 320,
  },

  zalo: {
    appId: import.meta.env.VITE_ZALO_APP_ID ?? "",
    oaId: import.meta.env.VITE_ZALO_OA_ID ?? "",
  },

  /** Tổng đài hỗ trợ một cửa */
  hotline: import.meta.env.VITE_HOTLINE ?? "024 3378 2200",

  /** Số ảnh tối đa đính kèm một phản ánh */
  maxFeedbackImages: 3,

  /** Số tin tức hiển thị ở Trang chủ */
  homeNewsCount: 3,

  version: import.meta.env.VITE_APP_VERSION ?? "1.0.0-beta",

  storageKeys: {
    session: "vigov.zma.session",
    fontScale: "vigov.zma.fontScale",
    notifications: "vigov.zma.notifications",
    lookupHistory: "vigov.zma.lookupHistory",
  },
} as const;
