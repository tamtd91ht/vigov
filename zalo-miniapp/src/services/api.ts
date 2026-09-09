import { appConfig } from "@/config/app.config";
import type { CitizenSession } from "@/types";

/**
 * HTTP client gọi backend NestJS (http://localhost:3001/api/v1).
 *
 * Cùng khuôn với admin-web/src/services/api.ts để hai front-end đồng nhất:
 * ApiError mang mã HTTP, buildQuery bỏ tham số rỗng, 401 thì xoá phiên.
 * Khác biệt duy nhất: Mini App lưu phiên công dân (kèm JWT) trong localStorage
 * theo appConfig.storageKeys.session.
 */

/** Lỗi API kèm mã HTTP để giao diện phân biệt 401 / 404 / 409 / 429 … */
export class ApiError extends Error {
  /** Mã HTTP; 0 = không kết nối được máy chủ */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Thân lỗi backend trả về (NestJS exception filter) */
interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

/**
 * Sự kiện phát ra khi máy chủ trả 401 — SessionContext lắng nghe để xoá
 * phiên trong React state, router tự đưa người dùng về màn định danh.
 */
export const SESSION_EXPIRED_EVENT = "vigov:session-expired";

/** Đọc phiên công dân đang lưu; hỏng dữ liệu thì coi như chưa định danh */
export function readStoredSession(): CitizenSession | null {
  try {
    const raw = localStorage.getItem(appConfig.storageKeys.session);
    return raw ? (JSON.parse(raw) as CitizenSession) : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: CitizenSession): void {
  localStorage.setItem(appConfig.storageKeys.session, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(appConfig.storageKeys.session);
}

/** JWT của công dân đang đăng nhập; null khi chạy mock hoặc chưa định danh */
export function getAccessToken(): string | null {
  return readStoredSession()?.accessToken ?? null;
}

/** Đường dẫn nhóm xác thực — 401 ở đây KHÔNG được kích hoạt luồng refresh */
const AUTH_PATH_PREFIX = "/auth/";

/** Phản hồi của POST /auth/refresh */
interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/**
 * Một lời gọi refresh ĐANG chạy, dùng chung cho mọi yêu cầu gặp 401 cùng lúc.
 *
 * VÌ SAO CẦN: màn hình mở lên thường bắn 2–3 lời gọi song song. Nếu mỗi lời gọi
 * tự refresh thì lời gọi thứ hai gửi refresh token vừa bị xoay vòng — backend
 * coi đó là dấu hiệu token bị lộ và THU HỒI cả phiên. Nghĩa là chính cơ chế
 * gia hạn lại đá người dùng ra ngoài. Gộp về một lượt là bắt buộc, không phải
 * tối ưu hoá.
 */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Xin cặp token mới bằng refresh token đang lưu.
 * Trả access token mới, hoặc null nếu không gia hạn được (hết hạn, bị thu hồi,
 * chưa từng có refresh token — ví dụ phiên tạo từ bản demo offline).
 *
 * Gọi `fetch` trực tiếp thay vì `request()` để không quay lại chính nhánh xử lý
 * 401 và tạo đệ quy.
 */
async function requestNewTokens(): Promise<string | null> {
  const session = readStoredSession();
  if (!session?.refreshToken) return null;

  try {
    const res = await fetch(`${appConfig.api.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as RefreshResponse;
    if (!body.accessToken || !body.refreshToken) return null;

    // Ghi CẢ hai token: backend xoay vòng nên refresh token cũ đã hết hiệu lực
    writeStoredSession({ ...session, accessToken: body.accessToken, refreshToken: body.refreshToken });
    return body.accessToken;
  } catch {
    return null;
  }
}

/** Gộp mọi yêu cầu refresh đồng thời về đúng một lời gọi */
function refreshOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = requestNewTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Đóng phiên tại chỗ và báo cho SessionContext đưa người dùng về màn định danh */
function endSession(): void {
  clearStoredSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
    if (body.error) return body.error;
  } catch {
    // Thân phản hồi không phải JSON — dùng thông báo mặc định bên dưới
  }
  return `Máy chủ trả về lỗi ${res.status}`;
}

/** Ghép tham số truy vấn, bỏ giá trị rỗng/undefined */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Một lượt gửi yêu cầu với token cho trước */
async function send(path: string, token: string | null, init?: RequestInit): Promise<Response> {
  /*
   * Thân multipart PHẢI để trình duyệt tự đặt Content-Type, vì chỉ nó biết
   * chuỗi `boundary` ngăn các phần. Đặt "application/json" như mặc định bên
   * dưới là máy chủ không tách được phần tệp và trả 400.
   */
  const isMultipart = init?.body instanceof FormData;
  try {
    return await fetch(`${appConfig.api.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(isMultipart ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại.", 0);
  }
}

/**
 * Gọi API — tự gắn JWT; gặp 401 thì THỬ REFRESH MỘT LẦN rồi mới huỷ phiên.
 *
 * Access token sống 8 giờ, nên trước đây mở app sau một đêm là rơi thẳng về màn
 * liên kết số điện thoại. Nay thử gia hạn trước; chỉ khi gia hạn cũng trượt
 * (refresh token hết hạn, phiên bị thu hồi, tài khoản bị khoá) mới bắt định
 * danh lại. Đúng MỘT lần thử — refresh trượt rồi thì thử lại cũng trượt, mà
 * vòng lặp ở đây sẽ treo màn hình.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  let res = await send(path, token, init);

  if (res.status === 401 && token && !path.startsWith(AUTH_PATH_PREFIX)) {
    const renewed = await refreshOnce();
    if (renewed) {
      res = await send(path, renewed, init);
    } else {
      endSession();
      throw new ApiError("Phiên định danh đã hết hạn, vui lòng liên kết lại số điện thoại", 401);
    }
  }

  if (res.status === 401) {
    const message = await readErrorMessage(res);
    /* Chỉ huỷ phiên khi đang CÓ token — 401 của màn định danh (sai OTP, chưa
       cấu hình OA) không được phép xoá phiên đang dùng. Tới nhánh này với token
       trong tay nghĩa là gia hạn xong vẫn bị từ chối: phiên hết đường cứu. */
    if (token) {
      endSession();
      throw new ApiError("Phiên định danh đã hết hạn, vui lòng liên kết lại số điện thoại", 401);
    }
    throw new ApiError(message, 401);
  }
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  /**
   * Gửi multipart/form-data (tải tệp lên `/files/upload`).
   *
   * Đi qua đúng `request()` như mọi lời gọi khác để dùng lại cơ chế gia hạn
   * token: tải ảnh là việc người dùng làm sau khi app đã mở một lúc, đúng lúc
   * access token dễ hết hạn nhất.
   */
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Dạng phản hồi phân trang dùng chung của backend */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Độ trễ giả lập cho nhánh mock, giúp thấy được trạng thái đang tải */
export function mockDelay(ms: number = appConfig.api.mockDelayMs): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
