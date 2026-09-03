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
    /**
     * true = zaloService trả dữ liệu mẫu thay vì gọi zmp-sdk.
     *
     * TÁCH RIÊNG khỏi `api.useMocks` một cách có chủ ý. Hai thứ đó độc lập:
     * `api.useMocks` nói về dữ liệu nghiệp vụ lấy từ backend, cờ này nói về
     * các API thiết bị của Zalo (camera, vị trí, số điện thoại). Gộp chung thì
     * một bản trình diễn offline — vốn cần dữ liệu mẫu vì chưa có backend —
     * lại vô tình tắt luôn camera thật, và nút quét chỉ quay rồi trả chuỗi mẫu.
     *
     * Mặc định TẮT: bản chạy trong Zalo phải dùng SDK thật. Chỉ bật khi phát
     * triển trên trình duyệt thường và muốn có dữ liệu mẫu cho luồng quét.
     */
    useMockSdk: (import.meta.env.VITE_USE_MOCK_SDK ?? "false") === "true",
  },

  /** Tổng đài hỗ trợ một cửa */
  hotline: import.meta.env.VITE_HOTLINE ?? "024 3378 2200",

  /** Số ảnh tối đa đính kèm một phản ánh */
  maxFeedbackImages: 3,

  /**
   * Ô màu giữ chỗ cho ảnh hiện trường, xoay vòng theo số ảnh.
   *
   * Dùng ở hai chỗ: phiếu đã gửi (backend chỉ trả mã tệp, module Files chưa mở
   * cho Mini App — WBS #24) và nền ô thumbnail khi đường dẫn ảnh Zalo trả về
   * không tải được. Theo quy ước dự án, màu không rải rác trong component.
   */
  imagePlaceholderColors: ["var(--blue)", "var(--green)", "var(--purple)", "var(--orange)", "var(--teal)"],

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
