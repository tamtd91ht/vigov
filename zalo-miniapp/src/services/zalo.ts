import { appConfig } from "@/config/app.config";

/**
 * Adapter Zalo Mini App SDK.
 *
 * Hai chế độ chạy, quyết định bởi `appConfig.zalo.useMockSdk` (`VITE_USE_MOCK_SDK`):
 *
 * - MOCK (`=true`): trả dữ liệu mẫu, không đụng tới SDK. Dùng khi phát triển
 *   trên trình duyệt thường.
 * - THẬT (mặc định): gọi `zmp-sdk`. Ngoài ứng dụng Zalo — ví dụ bản nginx tĩnh
 *   ở cổng 8085 — SDK nạp được nhưng mọi lệnh đều ném lỗi, nên từng hàm đều bọc
 *   try/catch và rơi về giá trị trung tính. KHÔNG rơi về dữ liệu mẫu: giả vờ
 *   thành công ở môi trường thật che mất lỗi tích hợp.
 *
 * Cờ này KHÁC `api.useMocks`. Cái kia nói về dữ liệu nghiệp vụ lấy từ backend;
 * cái này nói về API thiết bị của Zalo. Trước đây dùng chung một cờ, nên bản
 * trình diễn offline vô tình tắt luôn camera thật — bấm quét chỉ quay một nhịp
 * rồi trả chuỗi mẫu.
 *
 * Ghi chú về `import()`: `vite.config.ts` đặt `codeSplitting: false` nên zmp-sdk
 * được gộp thẳng vào bundle — lệnh import dưới đây không sinh chunk rời, và
 * bundle vẫn nạp được bằng thẻ script cổ điển như Zalo yêu cầu.
 */

export interface ZaloUserProfile {
  id: string;
  name: string;
  avatar?: string;
}

export interface LocationResult {
  granted: boolean;
  /**
   * Toạ độ. KHÔNG đến từ zmp-sdk: SDK đã bỏ `latitude`/`longitude`, chỉ trả
   * `token` để backend đổi (hết hạn sau 2 phút, dùng một lần). Đây là toạ độ
   * do THIẾT BỊ đo qua `navigator.geolocation` — xem browserGeolocate().
   */
  lat?: number;
  lng?: number;
  address?: string;
  token?: string;
  /**
   * Bán kính sai số (mét) do thiết bị khai. Phải hiện ra được: một điểm sai số
   * 2000m nhìn trên bản đồ y như điểm sai số 10m, mà một cái ghim đúng ngõ còn
   * cái kia ghim sang xã khác.
   */
  accuracy?: number;
  /** Nguồn toạ độ — để biết đường nào đang chạy khi thử trên điện thoại */
  source?: "zalo" | "browser" | "mock";
  /**
   * Lý do thất bại, NGUYÊN VĂN từ SDK. Trước đây mọi lỗi đều rơi về
   * `{granted:false}` trơn, nên màn hình nói dối là "người dùng từ chối" trong
   * khi thật ra Zalo chặn quyền API. Người thử cầm điện thoại không mở được
   * console, nên lỗi phải hiện ra được trên giao diện.
   */
  error?: string;
}

/** Bật để thử luồng người dùng từ chối quyền vị trí (câu hỏi mở #16) */
export const zaloMockFlags = { denyLocation: false };

/** Phần API của zmp-sdk mà ứng dụng này dùng — khai hẹp để lỗi lộ ra lúc biên dịch */
type ZmpSdk = Pick<
  typeof import("zmp-sdk"),
  | "getUserInfo"
  | "getPhoneNumber"
  | "getAccessToken"
  | "scanQRCode"
  | "chooseImage"
  | "getLocation"
  | "openChat"
  | "openPhone"
  | "requestCameraPermission"
  | "checkZaloCameraPermission"
  | "getSystemInfo"
>;

/**
 * Ảnh mẫu cho nhánh mock SDK — SVG nội tuyến dạng data-URI nên hiện được ảnh
 * thật lúc phát triển trên trình duyệt, không cần tệp trong thư mục public.
 */
const MOCK_IMAGE_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
      '<rect width="240" height="240" fill="#3B82C4"/>' +
      '<circle cx="88" cy="84" r="26" fill="#ffffff" opacity=".85"/>' +
      '<path d="M0 240 L86 128 L152 200 L196 160 L240 210 L240 240Z" fill="#1B3A5C" opacity=".55"/>' +
      '<text x="120" y="228" font-family="Arial" font-size="18" fill="#ffffff" text-anchor="middle">Ảnh mẫu</text>' +
      "</svg>",
  );

/**
 * Cạnh dài nhất của ảnh sau khi thu nhỏ để gửi (điểm ảnh), cùng định dạng và
 * mức nén. 1600px đủ để cán bộ đọc được biển số, mặt đường, vết nứt trên màn
 * hình Web Quản trị; giữ nguyên ảnh gốc 12MP chỉ làm người dân tốn 4G.
 */
const IMAGE_MAX_EDGE = 1600;
const IMAGE_MIME = "image/jpeg";
const IMAGE_QUALITY = 0.85;

/** Kết quả quét — mang theo lỗi để màn hình nói được vì sao hỏng */
export interface ScanResult {
  content: string | null;
  error?: string;
}

/**
 * Đọc lỗi của zmp-sdk ra chuỗi người đọc được.
 *
 * SDK ném `AppError { code, message }`, trong đó `message` có thể là mảng.
 * `String(err)` với vật thể đó ra "[object Object]" — vô dụng đúng lúc cần nhất.
 */
/**
 * Chặn treo. Lệnh zmp-sdk không được hỗ trợ có thể KHÔNG resolve mà cũng không
 * reject — lúc đó `await` đứng mãi, nút chỉ quay, và không lỗi nào hiện ra để
 * lần. Mọi lệnh SDK phải đi qua đây.
 */
function withTimeout<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} không phản hồi sau ${ms / 1000}s`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(errText(err)));
      },
    );
  });
}

function errText(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: number; message?: unknown };
    const raw = Array.isArray(e.message) ? e.message.join("; ") : e.message;
    const msg = typeof raw === "string" && raw ? raw : JSON.stringify(err);
    return e.code === undefined ? msg : `[${e.code}] ${msg}`;
  }
  return String(err);
}

function delay(ms: number = appConfig.api.mockDelayMs): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let sdkPromise: Promise<ZmpSdk | null> | null = null;

/** Nạp zmp-sdk một lần rồi dùng lại; null khi đang chạy mock hoặc nạp hỏng */
function loadSdk(): Promise<ZmpSdk | null> {
  if (appConfig.zalo.useMockSdk) return Promise.resolve(null);
  sdkPromise ??= import("zmp-sdk")
    .then((m) => m as ZmpSdk)
    .catch((err: unknown) => {
      console.warn("[zalo] không nạp được zmp-sdk", err);
      return null;
    });
  return sdkPromise;
}

/**
 * Gọi một lệnh SDK, nuốt lỗi và trả `fallback`.
 *
 * Ngoài Zalo mọi lệnh đều ném — đó là trạng thái bình thường của bản web tĩnh,
 * không phải sự cố, nên chỉ ghi log mức debug.
 */
async function attempt<T>(label: string, run: (sdk: ZmpSdk) => Promise<T>, fallback: T): Promise<T> {
  const sdk = await loadSdk();
  if (!sdk) return fallback;
  try {
    return await run(sdk);
  } catch (err: unknown) {
    console.debug(`[zalo] ${label} thất bại`, err);
    return fallback;
  }
}

/**
 * Quét QR thật.
 *
 * Xin quyền camera TRƯỚC khi gọi scanQRCode. Trên nhiều máy, scanQRCode hỏng
 * lặng lẽ khi ứng dụng Zalo chưa được hệ điều hành cấp quyền camera — không
 * ném lỗi rõ ràng, chỉ là màn quét không bao giờ mở. requestCameraPermission
 * hỏng thì vẫn quét tiếp: có máy đã cấp sẵn nên lệnh này thừa.
 *
 * Lỗi được trả NGUYÊN VĂN lên giao diện. Nuốt lỗi ở đây đồng nghĩa người thử
 * trên điện thoại không có cách nào biết vì sao camera không mở.
 */
async function runScan(): Promise<ScanResult> {
  const sdk = await loadSdk();
  if (!sdk) return { content: null, error: "Không nạp được zmp-sdk" };

  // Xin quyền là bước phụ: hỏng hay treo cũng KHÔNG được chặn việc quét, vì
  // nhiều máy đã cấp sẵn quyền và lệnh này chỉ là thừa.
  let camNote = "";
  try {
    await withTimeout("xin quyền camera", 6000, sdk.requestCameraPermission());
  } catch (err: unknown) {
    camNote = ` · xin quyền camera: ${errText(err)}`;
  }

  try {
    // 60s: người dùng cần thời gian chĩa máy vào mã, nhưng không để treo mãi
    const { content } = await withTimeout("scanQRCode", 60000, sdk.scanQRCode());
    return { content };
  } catch (err: unknown) {
    return { content: null, error: errText(err) + camNote };
  }
}

/** Một lần đọc vị trí từ thiết bị, kèm sai số do chính thiết bị khai */
interface BrowserFix {
  lat: number;
  lng: number;
  /** Bán kính sai số (mét) — GPS thường 5-20m, wifi/cell hàng trăm mét tới hàng km */
  accuracy: number;
}

/**
 * Đủ chính xác để ghim đúng ngõ, đúng nhà. Đạt ngưỡng này là nhận luôn, không
 * chờ thêm — chờ nữa chỉ làm người dùng ngồi nhìn vòng xoay.
 */
const GOOD_ACCURACY_M = 30;

/** Thời gian tối đa dành cho việc chờ GPS ổn định */
const GEOLOCATE_WINDOW_MS = 15000;

/**
 * Sai số vượt ngưỡng này thì toạ độ VÔ DỤNG — dứt khoát không ghim lên phiếu.
 *
 * VÌ SAO CẦN NGƯỠNG CHẶN, không chỉ cảnh báo: khi webview không được hệ điều
 * hành cấp một điểm định vị thật, nó rơi về ước lượng theo địa chỉ mạng. Với
 * nhà mạng Việt Nam, dải IP di động phần lớn đăng ký ở Hà Nội, nên người dùng
 * ở Tuy Hoà vẫn ra một điểm giữa Hà Nội — lệch cả nghìn kilômét mà `accuracy`
 * khai đúng là hàng chục nghìn mét.
 *
 * Một điểm như thế trên phiếu phản ánh còn TỆ HƠN không có điểm nào: cán bộ
 * tin vào cái ghim rồi tới nhầm nơi, còn người dân thì tưởng đã báo đúng chỗ.
 * Thà bắt nhập địa chỉ bằng tay.
 *
 * 500m: đủ rộng để nhận điểm GPS yếu trong nhà hay điểm wifi trong khu dân cư
 * (vẫn khoanh đúng thôn), đủ hẹp để loại mọi ước lượng theo mạng.
 */
const MAX_USABLE_ACCURACY_M = 500;

/**
 * Vị trí hiện tại của THIẾT BỊ, qua `navigator.geolocation`.
 *
 * VÌ SAO `watchPosition` CHỨ KHÔNG `getCurrentPosition`: trên Android, lần đọc
 * đầu tiên gần như luôn là điểm thô từ wifi/trạm phát sóng — sai số hàng trăm
 * mét tới hàng chục km, đủ để ghim sang xã khác. `getCurrentPosition` trả đúng
 * cái điểm thô đó rồi kết thúc, GPS có bắt được tín hiệu sau đó cũng vô ích.
 * `watchPosition` cho nhiều lần đọc liên tiếp, mỗi lần một chính xác hơn, nên
 * ở đây giữ lấy lần đọc TỐT NHẤT và dừng ngay khi đạt GOOD_ACCURACY_M.
 *
 * `maximumAge: 0` để không nhận điểm cũ trong bộ đệm: người dùng đang đứng ở
 * hiện trường và cần vị trí LÚC NÀY, không phải chỗ họ mở máy lần trước.
 *
 * Hết thời gian mà chưa có điểm nào đủ tốt thì vẫn trả điểm tốt nhất đã đọc
 * được — điểm thô kèm sai số hiển thị rõ còn hơn không có gì. Chỉ khi không đọc
 * được lần nào mới coi là thất bại.
 */
function browserGeolocate(): Promise<BrowserFix> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;
    if (!geo) {
      reject(new Error("webview không có navigator.geolocation"));
      return;
    }

    let best: BrowserFix | null = null;
    let watchId: number | null = null;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function finish(err?: Error): void {
      if (done) return;
      done = true;
      if (timer !== null) clearTimeout(timer);
      if (watchId !== null) geo.clearWatch(watchId);
      // Có điểm nào là dùng điểm đó, kể cả khi lần đọc cuối báo lỗi
      if (best) resolve(best);
      else reject(err ?? new Error("không đọc được vị trí nào"));
    }

    timer = setTimeout(
      () => finish(new Error(`không phản hồi sau ${GEOLOCATE_WINDOW_MS / 1000}s (webview có thể không được cấp quyền vị trí)`)),
      GEOLOCATE_WINDOW_MS,
    );

    watchId = geo.watchPosition(
      (pos) => {
        const fix: BrowserFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= GOOD_ACCURACY_M) finish();
      },
      (err) => finish(new Error(`[${err.code}] ${err.message || "không lấy được vị trí"}`)),
      { enableHighAccuracy: true, timeout: GEOLOCATE_WINDOW_MS, maximumAge: 0 },
    );
  });
}

/**
 * Lấy vị trí thật — hai đường, thử lần lượt.
 *
 * 1. `sdk.getLocation()` là đường chính thức, nhưng chỉ trả `token`: KHÔNG có
 *    toạ độ, nên không vẽ được bản đồ xem trước chừng nào backend chưa làm bước
 *    đổi token + reverse geocode (P3-26). Và quyền API này (ID 38) hiện đang bị
 *    Zalo chặn ở tầng nền tảng — cùng nhóm với scanQRCode/chooseImage.
 * 2. `navigator.geolocation` — Mini App vẫn chạy trong webview. Nếu Zalo chuyển
 *    tiếp quyền vị trí của hệ điều hành xuống webview thì đường này cho TOẠ ĐỘ
 *    NGAY, tức bản đồ hiện được mà không phải chờ Zalo cấp quyền API lẫn chờ
 *    backend. Đây là đường duy nhất có thể ra bản đồ ở thời điểm này.
 *
 * Mọi lý do thất bại được gom lại và trả nguyên văn lên giao diện, giống luồng
 * quét QR: nuốt lỗi ở đây là bắt người thử đoán.
 */
async function runLocate(): Promise<LocationResult> {
  const notes: string[] = [];

  // Đường 1 — mã định vị của Zalo. Lấy trước vì nếu có thì backend đổi được ra
  // toạ độ do chính Zalo xác định, không phụ thuộc webview có được cấp GPS hay không.
  let token: string | undefined;
  const sdk = await loadSdk();
  if (!sdk) {
    notes.push("không nạp được zmp-sdk");
  } else {
    try {
      token = (await withTimeout("getLocation", 15000, sdk.getLocation())).token;
      if (!token) notes.push("getLocation không trả token");
    } catch (err: unknown) {
      notes.push(`getLocation — ${errText(err)}`);
    }
  }

  // Đường 2 — thiết bị tự đo
  let fix: BrowserFix | null = null;
  try {
    fix = await browserGeolocate();
  } catch (err: unknown) {
    notes.push(`navigator.geolocation — ${errText(err)}`);
  }

  /* Loại điểm quá thô TRƯỚC khi nó chạm tới giao diện. Đây là chỗ chặn cái
     điểm-giữa-Hà-Nội do ước lượng theo địa chỉ mạng: nó là một toạ độ hoàn
     toàn hợp lệ về mặt kiểu dữ liệu, chỉ sai chỗ. */
  if (fix && fix.accuracy > MAX_USABLE_ACCURACY_M) {
    notes.push(
      `toạ độ đo được lệch tới ±${Math.round(fix.accuracy)}m — dáng của ước lượng theo địa chỉ mạng ` +
        "chứ không phải GPS, đã bỏ",
    );
    fix = null;
  }

  if (fix) {
    return { granted: true, token, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, source: "browser" };
  }

  /* Không đo được nhưng còn mã định vị: chưa kết luận là thất bại. Nơi gọi sẽ
     nhờ máy chủ đổi mã — Zalo có thể biết vị trí thật. Trả granted:false để
     giao diện bắt nhập địa chỉ ngay, rồi nâng cấp nếu máy chủ trả về toạ độ. */
  return { granted: false, token, error: notes.join(" · ") };
}

/**
 * Ảnh chụp trạng thái tích hợp, hiển thị ngay trong app.
 *
 * Người thử cầm điện thoại không mở được console, nên mọi phán đoán về "vì sao
 * camera không lên" đều là mò. Hàm này trả về đủ thứ cần để kết luận: SDK có
 * nạp không, đang chạy trong Zalo hay trình duyệt, phiên bản Zalo, và quyền
 * camera hiện ra sao.
 */
export async function zaloDiagnostics(): Promise<Array<[string, string]>> {
  const rows: Array<[string, string]> = [["Cờ mock SDK", String(appConfig.zalo.useMockSdk)]];

  const sdk = await loadSdk();
  rows.push(["Nạp zmp-sdk", sdk ? "được" : "KHÔNG"]);
  if (!sdk) return rows;

  // Chứng minh module đúng hình dạng, không phải bản vỏ bị tree-shake
  rows.push(["scanQRCode là", typeof sdk.scanQRCode]);
  rows.push(["Số API xuất ra", String(Object.keys(sdk).length)]);
  rows.push(["Cầu native", typeof (window as { ZaloJavaScriptInterface?: unknown }).ZaloJavaScriptInterface]);

  try {
    const info = sdk.getSystemInfo();
    rows.push(["Nền tảng", info.platform || "(rỗng)"]);
    rows.push(["Phiên bản Zalo", info.zaloVersion || "(rỗng)"]);
    rows.push(["Phiên bản SDK", info.apiVersion || "(rỗng)"]);
    rows.push(["Phiên bản Mini App", info.version || "(rỗng)"]);
  } catch (err: unknown) {
    rows.push(["getSystemInfo", `lỗi — ${errText(err)}`]);
  }

  // Timeout ở đây quan trọng không kém: bảng chẩn đoán mà treo thì cũng vô dụng
  try {
    const cam = await withTimeout("checkZaloCameraPermission", 6000, sdk.checkZaloCameraPermission());
    rows.push(["Quyền camera của Zalo", JSON.stringify(cam)]);
  } catch (err: unknown) {
    rows.push(["Quyền camera của Zalo", `lỗi — ${errText(err)}`]);
  }

  try {
    const asked = await withTimeout("requestCameraPermission", 6000, sdk.requestCameraPermission());
    rows.push(["Xin quyền camera", JSON.stringify(asked)]);
  } catch (err: unknown) {
    rows.push(["Xin quyền camera", `lỗi — ${errText(err)}`]);
  }

  // Hai đường lấy vị trí, đo riêng từng đường. Đặt TRƯỚC scanQRCode vì cả hai
  // chạy không cần người dùng chạm gì, còn scanQRCode thì mở màn quét và chặn.
  try {
    const loc = await withTimeout("getLocation (thử 10s)", 10000, sdk.getLocation());
    rows.push(["Gọi getLocation", loc.token ? "có token" : "không token"]);
  } catch (err: unknown) {
    rows.push(["Gọi getLocation", errText(err)]);
  }

  try {
    const pos = await browserGeolocate();
    rows.push(["navigator.geolocation", `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (±${Math.round(pos.accuracy)}m)`]);
  } catch (err: unknown) {
    rows.push(["navigator.geolocation", errText(err)]);
  }

  // Gọi thẳng scanQRCode với thời gian chờ ngắn: nếu quyền API bị Zalo chặn thì
  // đây là chỗ lỗi đó lộ ra nguyên văn, kèm mã lỗi.
  try {
    await withTimeout("scanQRCode (thử 8s)", 8000, sdk.scanQRCode());
    rows.push(["Gọi scanQRCode", "mở được"]);
  } catch (err: unknown) {
    rows.push(["Gọi scanQRCode", errText(err)]);
  }

  return rows;
}

export const zaloService = {
  /** Thông tin hiển thị của người dùng Zalo */
  async getUserProfile(): Promise<ZaloUserProfile | null> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      return { id: "mock-user", name: "Người dùng Zalo" };
    }
    return attempt(
      "getUserInfo",
      async (sdk) => {
        // Tên và ảnh đại diện thuộc dữ liệu cá nhân theo NĐ 13/2023 — phải xin phép,
        // `autoRequestPermission` bật form xác nhận thay cho việc gọi authorize() riêng.
        const { userInfo } = await sdk.getUserInfo({ autoRequestPermission: true });
        return { id: userInfo.id, name: userInfo.name, avatar: userInfo.avatar };
      },
      null,
    );
  },

  /**
   * Số điện thoại người dùng.
   *
   * SDK chỉ trả `token`; đổi ra số thật là việc của backend (cần ZALO_APP_SECRET,
   * mà cái đó phụ thuộc Zalo OA/Business khách chưa đăng ký — câu hỏi mở #3).
   * Trường `number` đã bị SDK đánh dấu deprecated, chỉ đọc phòng khi máy cũ còn trả.
   */
  async requestPhoneNumber(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      return "0987654321";
    }
    return attempt("getPhoneNumber", async (sdk) => (await sdk.getPhoneNumber()).number ?? null, null);
  },

  /**
   * Token định danh do Zalo cấp, gửi lên POST /auth/citizen/zalo/identify để
   * backend đổi lấy số điện thoại thật. Token dùng một lần, hết hạn sau 2 phút.
   *
   * Trả null khi chạy ngoài Zalo — lúc đó SessionContext rơi về luồng OTP.
   */
  async requestPhoneToken(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) return null;
    return attempt("getPhoneNumber(token)", async (sdk) => (await sdk.getPhoneNumber()).token ?? null, null);
  },

  /**
   * Phiên đăng nhập Zalo của người dùng.
   *
   * Máy chủ cần token này ĐỒNG THỜI với mã của getPhoneNumber để đổi lấy số
   * điện thoại — Zalo bắt gửi cả hai, thiếu một là từ chối. Bản thân nó không
   * phải số điện thoại và không dùng được một mình.
   */
  async getAccessToken(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) return null;
    return attempt("getAccessToken", async (sdk) => (await sdk.getAccessToken()) ?? null, null);
  },

  /** Quét mã QR hồ sơ một cửa */
  async scanQrCode(): Promise<ScanResult> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      return { content: "HS-2026-04182" };
    }
    return runScan();
  },

  /**
   * Quét mã QR in trên mặt trước thẻ CCCD gắn chip (P5-11, tầng 2).
   *
   * Tách riêng khỏi scanQrCode() dù cùng gọi một API SDK: hai luồng nghiệp vụ
   * khác nhau, chuỗi trả về khác định dạng, và tách ra thì bản mock mới trả
   * được dữ liệu mẫu đúng kiểu cho từng luồng.
   *
   * Chuỗi trả về CHƯA được kiểm tra — nơi gọi phải đưa qua parseCccdQr().
   * Người dùng hoàn toàn có thể chĩa máy vào một QR bất kỳ.
   */
  async scanCccdQr(): Promise<ScanResult> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      // Dữ liệu mẫu, KHÔNG phải người thật — số CCCD và địa chỉ đều bịa
      return {
        content:
          "001099012345|123456789|Nguyễn Văn An|01011990|Nam|Số 1, Thôn Đông, Xã Đại Thắng, Huyện Phú Xuyên, Thành phố Hà Nội|15062021",
      };
    }
    return runScan();
  },

  /**
   * Vị trí hiện tại.
   *
   * Xem runLocate() để biết thứ tự hai đường và vì sao cần đường thứ hai.
   * `address` vẫn bỏ trống ở bản thật — điền tự động được sau khi backend làm
   * bước đổi token + reverse geocode (P3-26); trước đó người dùng tự nhập.
   */
  async getLocation(): Promise<LocationResult> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      if (zaloMockFlags.denyLocation) return { granted: false };
      return {
        granted: true,
        lat: appConfig.map.center.lat,
        lng: appConfig.map.center.lng,
        /*
         * KHÔNG trả địa chỉ, kể cả ở nhánh mock.
         *
         * Trường này là đường duy nhất lọt qua được `usableAddress` — nơi gọi
         * dùng thẳng `res.address` để hiện bản đồ ngay, không chờ máy chủ. Một
         * địa chỉ bịa gắn lên toạ độ thật thì người dân đọc tưởng thật rồi gửi
         * phiếu sai chỗ, mà lúc chạy mock thì trông y như bản thật nên không ai
         * phát hiện. Địa chỉ chỉ được đến từ provider GIS thật.
         */
        accuracy: 12,
        source: "mock",
      };
    }
    return runLocate();
  },

  /**
   * Mở cửa sổ chat Zalo.
   *
   * CHẶN: openChat cần ID Zalo của người nhận (`type: 'user'`) hoặc ID Official
   * Account (`type: 'oa'`) — KHÔNG nhận số điện thoại. Danh bạ cán bộ chỉ có số
   * điện thoại, nên đường duy nhất là chat qua OA của xã, mà khách chưa đăng ký
   * Zalo OA (VITE_ZALO_OA_ID còn rỗng). Chừng nào chưa có OA thì hàm này trả
   * false và giao diện phải nói thật là chưa dùng được.
   */
  async openChat(phone: string): Promise<boolean> {
    if (appConfig.zalo.useMockSdk) {
      await delay(120);
      return true;
    }
    const oaId = appConfig.zalo.oaId;
    if (!oaId) {
      console.debug("[zalo] openChat bỏ qua: chưa cấu hình VITE_ZALO_OA_ID", { phone });
      return false;
    }
    return attempt(
      "openChat",
      async (sdk) => {
        await sdk.openChat({ type: "oa", id: oaId });
        return true;
      },
      false,
    );
  },

  /** Gọi điện — trong Zalo dùng openPhone, ngoài Zalo rơi về liên kết tel: */
  async call(phone: string): Promise<boolean> {
    if (appConfig.zalo.useMockSdk) {
      await delay(120);
      return true;
    }
    const ok = await attempt(
      "openPhone",
      async (sdk) => {
        await sdk.openPhone({ phoneNumber: phone });
        return true;
      },
      false,
    );
    if (ok) return true;
    // Trình duyệt thường: để hệ điều hành tự chọn ứng dụng gọi
    window.location.href = `tel:${phone}`;
    return true;
  },

  /**
   * Mở trình chọn ảnh của Zalo (album hoặc camera), trả về đường dẫn các tệp
   * đã chọn. Mảng rỗng nghĩa là người dùng huỷ hoặc không gọi được.
   *
   * `filePaths` của zmp-sdk dùng trực tiếp làm `src` của thẻ `<img>` để xem
   * trước. Đây là tệp TẠM trong webview, hết hiệu lực khi đóng app — muốn lưu
   * lại thì phải đọc thành Blob rồi tải lên kho tệp ngay trong lúc soạn phiếu
   * (xem `filesService.uploadFeedbackImages`).
   *
   * Nhánh mock trả về một data-URI SVG thật, không phải chuỗi giả: chuỗi giả
   * làm thẻ img hỏng ảnh khi phát triển trên trình duyệt thường.
   */
  async chooseImage(count = 1): Promise<string[]> {
    if (appConfig.zalo.useMockSdk) {
      await delay(200);
      return [MOCK_IMAGE_URI];
    }
    return attempt(
      "chooseImage",
      async (sdk) => (await sdk.chooseImage({ count, sourceType: ["album", "camera"] })).filePaths,
      [],
    );
  },

  /**
   * Đọc một đường dẫn ảnh của Zalo thành Blob để gửi lên `/files/upload`.
   *
   * VÌ SAO CẦN HAI ĐƯỜNG: `filePaths` không phải URL http — tuỳ phiên bản
   * Zalo và hệ điều hành, nó là `blob:`, `file://` hay một scheme riêng của
   * webview. `fetch` đọc được `blob:` và data-URI, nhưng nhiều webview chặn
   * `fetch` trên `file://` (trả TypeError) trong khi thẻ `<img>` vẫn tải được
   * chính đường dẫn đó. Nên khi `fetch` trượt thì vẽ ảnh qua canvas rồi lấy
   * Blob — đường này chạy được với mọi thứ `<img>` hiển thị nổi.
   *
   * Canvas làm ảnh mất dữ liệu EXIF và mã lại thành JPEG. Đổi lại là ảnh gửi
   * được; và với ảnh phản ánh thì bỏ EXIF là điều NÊN làm — thẻ EXIF chứa toạ
   * độ GPS nơi chụp, dữ liệu cá nhân theo NĐ 13/2023 mà người gửi không biết
   * mình đang gửi.
   *
   * Ném lỗi khi cả hai đường đều trượt — nơi gọi phải nói cho người dùng biết
   * ảnh nào không gửi được, không được lặng lẽ bỏ ảnh.
   */
  async readImageBlob(uri: string): Promise<Blob> {
    try {
      const res = await fetch(uri);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return blob;
      }
      console.debug(`[zalo] fetch ảnh trả ${res.status}, chuyển sang canvas`);
    } catch (err: unknown) {
      console.debug("[zalo] fetch ảnh thất bại, chuyển sang canvas", err);
    }
    return drawToBlob(uri);
  },
};

/**
 * Nạp ảnh bằng thẻ `<img>` rồi vẽ lên canvas để lấy Blob.
 *
 * Đồng thời THU NHỎ ảnh về `IMAGE_MAX_EDGE`: ảnh camera điện thoại nay 4–12MB,
 * vượt hạn mức tệp của máy chủ và tốn dữ liệu di động của người dân, trong khi
 * cán bộ xem trên màn hình chỉ cần cỡ 1600px là rõ mọi chi tiết cần thiết.
 */
async function drawToBlob(uri: string): Promise<Blob> {
  const image = await loadImageElement(uri);

  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Thiết bị không dựng được ảnh để gửi");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    /*
     * `toBlob` gọi lại với `null` khi canvas bị "nhiễm" (tainted) vì ảnh đến từ
     * nguồn khác gốc mà không có CORS. Không bắt trường hợp này thì lời hứa
     * treo mãi và người dùng thấy vòng xoay không bao giờ dừng.
     */
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error("Không đọc được ảnh đã chọn trên thiết bị này"));
      },
      IMAGE_MIME,
      IMAGE_QUALITY,
    );
  });
}

/** Nạp một đường dẫn ảnh thành thẻ `<img>` đã sẵn kích thước */
function loadImageElement(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Xin CORS để canvas không bị nhiễm nếu nguồn ảnh có trả header phù hợp
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không mở được ảnh đã chọn"));
    image.src = uri;
  });
}
