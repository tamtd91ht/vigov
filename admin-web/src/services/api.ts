import { appConfig } from "@/config/app.config";
import { authService } from "./auth";

/** Lỗi API kèm mã HTTP để giao diện phân biệt 403 / 404 / 409 … */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thân lỗi backend trả về (NestJS exception filter) */
interface ApiErrorBody {
  message?: string | string[];
  error?: string;
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

/** HTTP client cho backend NestJS — tự gắn JWT, tự đăng xuất khi token hết hạn */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authService.getAccessToken();
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
    // Token hết hạn hoặc bị thu hồi — buộc đăng nhập lại
    authService.logout();
    throw new ApiError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", 401);
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
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Dạng phản hồi phân trang dùng chung của backend */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
