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

/** Giá trị một tham số truy vấn nhận được */
export type QueryValue = string | number | boolean | undefined | null | string[];

/**
 * Ghép tham số truy vấn, bỏ giá trị rỗng/undefined.
 *
 * Mảng được gửi thành tham số LẶP LẠI (`?status=moi&status=dang`), không ghép
 * bằng dấu phẩy: tên cán bộ có thể chứa dấu phẩy, ghép rồi tách ở máy chủ sẽ
 * cắt sai tên. Mảng rỗng coi như chưa lọc gì.
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") search.append(key, String(item));
      }
      continue;
    }
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Tên tệp trong header Content-Disposition; rỗng thì dùng tên mặc định */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

/**
 * Tải một tệp nhị phân (Excel) từ backend và lưu về máy.
 *
 * Không dùng `apiClient` được vì client đó chỉ đọc JSON. Ở đây gọi `fetch`
 * trực tiếp, tự gắn Authorization, và đọc thông báo lỗi dạng JSON của backend
 * khi thất bại — nếu không cán bộ chỉ thấy "mã lỗi 400" mà không biết vì sao
 * (thường là bộ lọc quá rộng, vượt giới hạn số dòng mỗi tệp).
 */
export async function downloadFile(path: string, fallbackName: string): Promise<string> {
  const token = authService.getAccessToken();

  let res: Response;
  try {
    res = await fetch(`${appConfig.api.baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại.", 0);
  }

  if (!res.ok) {
    let message = `Không tải được tệp (mã lỗi ${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      const raw = Array.isArray(body.message) ? body.message[0] : body.message;
      if (raw) message = raw;
    } catch {
      // Phản hồi lỗi không phải JSON — giữ thông báo mặc định
    }
    throw new ApiError(message, res.status);
  }

  const fileName = fileNameFrom(res.headers.get("Content-Disposition"), fallbackName);
  /* Thẻ <a> tạm KHÔNG gắn vào DOM: mọi trình duyệt hiện hành đều kích hoạt
     được click trên thẻ rời, nên không phải thêm rồi dọn khỏi cây DOM. */
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return fileName;
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
