import { appConfig } from "@/config/app.config";
import { ApiError, apiClient } from "./api";
import { authService } from "./auth";

/**
 * Kho tệp dùng chung (WBS #24 — API `/files`).
 *
 * Không dùng `apiClient` cho việc tải lên: client đó luôn đặt
 * `Content-Type: application/json`, còn multipart bắt buộc để trình duyệt tự
 * sinh header kèm `boundary`. Vì vậy hàm upload gọi thẳng `XMLHttpRequest`
 * (cần sự kiện `progress` để vẽ thanh tiến trình) và tự gắn `Authorization`.
 *
 * Mọi ràng buộc dưới đây là bản sao của `files.service.ts` phía backend — kiểm
 * tra trước ở trình duyệt chỉ để báo lỗi sớm bằng tiếng Việt, máy chủ vẫn là
 * nơi quyết định cuối cùng.
 */

/** Mục đích sử dụng tệp — khớp enum FILE_PURPOSES của backend */
export const FILE_PURPOSES = ["scan", "feedback", "audio", "video", "cover", "other"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** Nhóm MIME ảnh dùng lại cho phản ánh, ảnh bìa bài viết và bản scan */
const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

/** MIME được phép theo mục đích; mảng rỗng = không giới hạn (chỉ 'other') */
export const ALLOWED_MIME_BY_PURPOSE: Record<FilePurpose, readonly string[]> = {
  scan: ["application/pdf", ...IMAGE_MIME_TYPES],
  feedback: [...IMAGE_MIME_TYPES],
  cover: [...IMAGE_MIME_TYPES],
  audio: [
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/x-m4a",
  ],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/3gpp"],
  other: [],
};

/** Giá trị cho thuộc tính `accept` của thẻ input, suy ra từ bảng MIME */
export const ACCEPT_BY_PURPOSE: Record<FilePurpose, string> = {
  scan: "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif",
  feedback: "image/jpeg,image/png,image/webp,image/heic,image/heif",
  cover: "image/jpeg,image/png,image/webp",
  audio: "audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,.mp3,.m4a,.wav,.ogg",
  video: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
  other: "",
};

/** Mô tả ngắn định dạng chấp nhận, hiện dưới ô kéo-thả */
export const FORMAT_HINT_BY_PURPOSE: Record<FilePurpose, string> = {
  scan: "PDF hoặc ảnh JPG, PNG, WEBP, HEIC",
  feedback: "Ảnh JPG, PNG, WEBP, HEIC",
  cover: "Ảnh JPG, PNG, WEBP",
  audio: "Âm thanh MP3, M4A, AAC, WAV, OGG",
  video: "Video MP4, MOV, WEBM, MKV",
  other: "Mọi định dạng trừ tệp có thể thực thi mã",
};

/**
 * MIME bị chặn với mọi mục đích — trình duyệt sẽ thực thi mã khi mở trực tiếp.
 * Sao chép BLOCKED_MIME_TYPES của backend.
 */
const BLOCKED_MIME_TYPES: readonly string[] = [
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "text/xml",
  "application/xml",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-httpd-php",
];

/** Dung lượng tối đa mỗi tệp (byte) — khớp STORAGE_MAX_FILE_SIZE của backend */
export const MAX_FILE_SIZE = appConfig.files.maxSize;

/** Kết quả POST /files/upload */
export interface UploadedFile {
  id: string;
  /** Đường dẫn đọc tệp dạng `/api/v1/files/<id>` do máy chủ trả về */
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  purpose: FilePurpose;
  isPrivate: boolean;
}

/** Kết quả GET /files/:id/signed-url */
export interface SignedUrl {
  /** Đường dẫn tương đối kèm `?exp=&sig=` */
  url: string;
  expiresAt: number;
  ttlSeconds: number;
}

/** Thân lỗi backend trả về (NestJS exception filter) */
interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

/** Định dạng dung lượng cho nhãn hiển thị và thông báo lỗi */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Kiểm tra tệp trước khi gửi. Trả về thông báo lỗi tiếng Việt, hoặc `null` nếu hợp lệ.
 *
 * Chỉ xét `file.type` — đó chính là MIME trình duyệt sẽ ghi vào phần multipart
 * và cũng là giá trị backend đọc, nên đoán theo phần mở rộng sẽ cho kết quả
 * "hợp lệ" giả trong khi máy chủ vẫn từ chối.
 */
export function validateFile(file: File, purpose: FilePurpose): string | null {
  if (file.size === 0) return "Tệp rỗng, vui lòng chọn tệp khác";
  if (file.size > MAX_FILE_SIZE) {
    return `Tệp ${formatFileSize(file.size)} vượt quá dung lượng cho phép (${formatFileSize(MAX_FILE_SIZE)})`;
  }

  const mimeType = file.type.toLowerCase();
  if (BLOCKED_MIME_TYPES.includes(mimeType)) {
    return "Định dạng tệp này không được phép tải lên vì có thể thực thi mã trong trình duyệt";
  }

  const allowed = ALLOWED_MIME_BY_PURPOSE[purpose];
  if (allowed.length === 0) return null;
  if (!mimeType) {
    return `Không xác định được định dạng tệp. Vui lòng chọn ${FORMAT_HINT_BY_PURPOSE[purpose].toLowerCase()}`;
  }
  if (!allowed.includes(mimeType)) {
    return `Định dạng "${mimeType}" không được chấp nhận. Chỉ nhận ${FORMAT_HINT_BY_PURPOSE[purpose].toLowerCase()}`;
  }
  return null;
}

/** Đường dẫn tuyệt đối để đọc một tệp công khai */
export function fileUrl(id: string): string {
  return `${appConfig.api.baseUrl}/files/${encodeURIComponent(id)}`;
}

/**
 * Đường dẫn tuyệt đối từ `url` backend trả về.
 * Backend trả đường dẫn tương đối (`/api/v1/files/…`) trong khi Web Quản trị
 * chạy ở cổng khác, nên phải ghép lại theo gốc của API.
 */
export function absoluteFileUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = appConfig.api.baseUrl;
  // baseUrl có dạng "http://host:port/api/v1"; bỏ phần tiền tố API trùng nhau
  const origin = /^https?:\/\//i.test(base) ? new URL(base).origin : "";
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Cấp link ký sẵn để mở tệp riêng tư (ảnh phản ánh, bản scan văn bản) */
export async function getSignedUrl(id: string, ttlSeconds = appConfig.files.signedUrlTtl): Promise<SignedUrl> {
  const signed = await apiClient.get<SignedUrl>(
    `/files/${encodeURIComponent(id)}/signed-url?ttl=${ttlSeconds}`,
  );
  return { ...signed, url: absoluteFileUrl(signed.url) };
}

/** Lấy thông điệp lỗi từ thân phản hồi của XHR */
function readErrorMessage(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as ApiErrorBody;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
    if (body.error) return body.error;
  } catch {
    // Thân phản hồi không phải JSON — dùng thông báo mặc định bên dưới
  }
  return `Máy chủ trả về lỗi ${xhr.status}`;
}

/**
 * Tải một tệp lên kho tệp dùng chung.
 *
 * @param onProgress nhận phần trăm 0–100; chỉ được gọi khi trình duyệt biết
 *   tổng dung lượng cần gửi (`lengthComputable`).
 */
export function uploadFile(
  file: File,
  purpose: FilePurpose,
  isPrivate: boolean,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  const invalid = validateFile(file, purpose);
  if (invalid) return Promise.reject(new ApiError(invalid, 400));

  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  form.append("isPrivate", String(isPrivate));

  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${appConfig.api.baseUrl}/files/upload`);

    const token = authService.getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // KHÔNG đặt Content-Type — trình duyệt tự thêm boundary của multipart

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }

    xhr.onerror = () => reject(new ApiError("Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại.", 0));
    xhr.onabort = () => reject(new ApiError("Đã huỷ tải tệp lên", 0));

    xhr.onload = () => {
      if (xhr.status === 401) {
        // Token hết hạn hoặc bị thu hồi — buộc đăng nhập lại, giống apiClient
        authService.logout();
        reject(new ApiError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", 401));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(readErrorMessage(xhr), xhr.status));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as UploadedFile);
      } catch {
        reject(new ApiError("Máy chủ trả về dữ liệu không hợp lệ sau khi tải tệp", xhr.status));
      }
    };

    xhr.send(form);
  });
}
