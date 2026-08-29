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

/** Gọi API — tự gắn JWT, tự xoá phiên khi token hết hạn */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${appConfig.api.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại.", 0);
  }

  if (res.status === 401) {
    const message = await readErrorMessage(res);
    // Chỉ huỷ phiên khi đang CÓ token — 401 của màn định danh (sai OTP, chưa
    // cấu hình OA) không được phép xoá phiên đang dùng.
    if (token) {
      clearStoredSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
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
