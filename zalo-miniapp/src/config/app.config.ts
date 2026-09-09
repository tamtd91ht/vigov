/**
 * Cấu hình cấp ứng dụng — điểm tập trung duy nhất đọc biến môi trường (VITE_*).
 * Mọi nơi khác trong mã nguồn KHÔNG đọc import.meta.env trực tiếp.
 */

/**
 * true = bản DEMO: app hiện pop-up cảnh báo khi mở, gắn nhãn "Demo" ở các màn
 * mô phỏng, và tên app thành "ViGov Demo".
 *
 * MẶC ĐỊNH BẬT. Zalo từ chối xét duyệt ngày 05/09/2026 vì app mô phỏng thông
 * tin cơ quan nhà nước mà không nói rõ là bản demo, nên bản đang phát hành là
 * bản demo. Quên khai biến này mà app hiện thừa nhãn "Demo" thì chỉ xấu chứ
 * không sai; ngược lại — bản demo mất nhãn — là đúng cái khiến hồ sơ bị từ
 * chối, nên chọn mặc định nghiêng về phía an toàn.
 *
 * Chuyển sang bản chính thức: đặt VITE_DEMO_MODE=false (và trỏ VITE_ORG_NAME /
 * VITE_ORG_PARENT về tên đơn vị thật). Nội dung hiển thị nằm ở
 * src/config/demo.config.ts.
 */
/**
 * Đọc biến môi trường, coi **chuỗi rỗng là CHƯA ĐẶT**.
 *
 * VÌ SAO KHÔNG DÙNG `??` TRỰC TIẾP: `??` chỉ rơi về mặc định khi giá trị là
 * `undefined`, còn chuỗi rỗng thì nó nhận. Mà đường triển khai thật sinh ra
 * đúng chuỗi rỗng: `docker-compose.yml` truyền `${BIẾN:-}` cho mọi biến không
 * khai trong `.env`, Dockerfile gán tiếp thành `ENV BIẾN=`, rồi Vite nhúng
 * chuỗi rỗng đó vào bundle. Hậu quả: tên xã hiện thành chuỗi trống, tâm bản đồ
 * thành `Number("") = 0` (giữa Vịnh Guinea), style bản đồ thành URL rỗng — tất
 * cả đều KHÔNG báo lỗi.
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

const demoMode = envFlag(import.meta.env.VITE_DEMO_MODE, true);

export const appConfig = {
  demoMode,
  appName: demoMode ? "ViGov Demo" : "ViGov",
  appTagline: "Điều hành số cấp xã",

  /**
   * Giá trị dự phòng cố ý là tên hư cấu: bản demo hiển thị tên một xã có thật
   * kèm tin tức và hồ sơ bịa ra chính là điều Zalo nêu khi từ chối hồ sơ.
   * Tên đơn vị thật khai qua biến môi trường ở bản chính thức.
   */
  org: {
    name: envText(import.meta.env.VITE_ORG_NAME, "Xã Demo"),
    parent: envText(import.meta.env.VITE_ORG_PARENT, "Huyện Demo · Tỉnh Demo"),
    short: envText(import.meta.env.VITE_ORG_SHORT, "VG"),
  },

  api: {
    baseUrl: envText(import.meta.env.VITE_API_BASE_URL, "http://localhost:3001/api/v1"),
    /**
     * true = dùng dữ liệu mẫu trong src/mocks thay vì gọi backend.
     * Mặc định TẮT: từ P5-03 các màn đã nối API thật; bật lại khi cần
     * trình diễn offline (không có máy chủ). Nhánh rẽ nằm trong các service.
     */
    useMocks: envFlag(import.meta.env.VITE_USE_MOCKS, false),
    /** Độ trễ giả lập khi dùng mock */
    mockDelayMs: 320,
  },

  zalo: {
    appId: envText(import.meta.env.VITE_ZALO_APP_ID, ""),
    oaId: envText(import.meta.env.VITE_ZALO_OA_ID, ""),
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
    useMockSdk: envFlag(import.meta.env.VITE_USE_MOCK_SDK, false),
  },

  /**
   * Bản đồ kinh tế số của Mini App.
   *
   * `mock` là bản mô phỏng bằng CSS, không gọi mạng — an toàn khi chưa khai
   * tên miền tile trong danh sách domain cho phép của Mini App. Giá trị khác
   * dùng MapLibre với style ở `styleUrl` (mặc định OpenFreeMap: dữ liệu
   * OpenStreetMap, không cần khoá API).
   *
   * LƯU Ý RIÊNG CỦA ZALO: Mini App chạy trong webview của Zalo, mọi tên miền
   * bên ngoài phải được khai trong phần cấu hình domain của ứng dụng trên
   * Zalo Developers. Chưa khai thì tile im lặng không tải được.
   */
  map: {
    provider: envText(import.meta.env.VITE_MAP_PROVIDER, "mock"),
    styleUrl: envText(import.meta.env.VITE_MAP_STYLE_URL, "https://tiles.openfreemap.org/styles/positron"),
    center: {
      lat: envNumber(import.meta.env.VITE_MAP_CENTER_LAT, 20.6935),
      lng: envNumber(import.meta.env.VITE_MAP_CENTER_LNG, 105.9285),
    },
    zoom: envNumber(import.meta.env.VITE_MAP_ZOOM, 14),
  },

  /** Tổng đài hỗ trợ một cửa */
  hotline: envText(import.meta.env.VITE_HOTLINE, "024 3378 2200"),

  /** Số ảnh tối đa đính kèm một phản ánh */
  maxFeedbackImages: 3,

  files: {
    /**
     * Dung lượng tối đa mỗi ảnh (byte) — PHẢI khớp STORAGE_MAX_FILE_SIZE của
     * backend, nếu không người dân chờ tải hết ảnh rồi mới nhận 413.
     */
    maxSize: envNumber(import.meta.env.VITE_MAX_FILE_SIZE, 20 * 1024 * 1024),
  },

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

  version: envText(import.meta.env.VITE_APP_VERSION, "1.0.0-beta"),

  storageKeys: {
    session: "vigov.zma.session",
    fontScale: "vigov.zma.fontScale",
    notifications: "vigov.zma.notifications",
    lookupHistory: "vigov.zma.lookupHistory",
  },
} as const;
