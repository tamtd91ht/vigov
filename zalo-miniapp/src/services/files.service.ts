import { appConfig } from "@/config/app.config";
import { ApiError, apiClient, mockDelay } from "@/services/api";
import { zaloService } from "@/services/zalo";

/**
 * Tải ảnh hiện trường lên kho tệp dùng chung (`POST /files/upload`, WBS #24).
 *
 * Ảnh người dân chọn từ Zalo chỉ là tệp tạm của webview: xem trước được trong
 * lúc soạn phiếu, nhưng hết hiệu lực khi đóng app. Muốn ảnh còn lại trên phiếu
 * thì phải đẩy lên kho tệp trước, rồi gửi MÃ tệp kèm phiếu phản ánh.
 *
 * `isPrivate = true` là bắt buộc, không phải tuỳ chọn: backend từ chối 400 nếu
 * gắn tệp công khai vào phiếu (quy ước TB-09 trong SECURITY.md — ảnh hiện
 * trường có thể chứa mặt người, biển số, cửa nhà). Công dân vẫn xem lại được
 * ảnh của mình vì `/feedback/citizen/mine/**` trả kèm link đã ký.
 */

/** Mục đích tệp — khớp enum FILE_PURPOSES của backend */
const FEEDBACK_PURPOSE = "feedback";

/** MIME ảnh backend chấp nhận cho mục đích 'feedback' */
const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

/** Tên tệp mặc định khi Blob không mang tên (canvas, blob: URI) */
const DEFAULT_IMAGE_NAME = "anh-hien-truong.jpg";

/** Phản hồi của POST /files/upload */
interface UploadedFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/** Định dạng dung lượng cho thông báo lỗi tiếng Việt */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Suy phần mở rộng và tên tệp từ MIME.
 * Tên tệp không mang thông tin nghiệp vụ nào, nhưng phải có đuôi hợp lệ để
 * backend đặt đúng phần mở rộng khi lưu xuống ổ.
 */
function nameFor(mimeType: string): string {
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg");
  return ext ? `anh-hien-truong.${ext}` : DEFAULT_IMAGE_NAME;
}

/**
 * Kiểm tra trước khi gửi — trả thông báo lỗi tiếng Việt, `null` nếu hợp lệ.
 *
 * Bản sao ràng buộc của backend, chỉ để báo lỗi sớm bằng tiếng Việt trên máy
 * người dùng thay vì để họ chờ hết một lượt tải rồi mới nhận 413/415.
 */
export function validateImage(blob: Blob): string | null {
  if (blob.size === 0) return "Ảnh rỗng, vui lòng chọn ảnh khác";
  if (blob.size > appConfig.files.maxSize) {
    return `Ảnh ${formatSize(blob.size)} vượt quá dung lượng cho phép (${formatSize(appConfig.files.maxSize)})`;
  }
  const mimeType = (blob.type || "").toLowerCase();
  // Blob từ canvas luôn có type; blob rỗng type thì để máy chủ quyết định
  if (mimeType && !ALLOWED_IMAGE_MIME.includes(mimeType)) {
    return "Chỉ gửi được ảnh JPG, PNG, WEBP hoặc HEIC";
  }
  return null;
}

/**
 * Đọc một đường dẫn ảnh của Zalo rồi tải lên, trả về MÃ tệp.
 *
 * Ném `ApiError` kèm thông báo tiếng Việt ở mọi nhánh thất bại để màn hình gửi
 * phản ánh hiện được đúng lý do trên từng ô ảnh — người dân cầm điện thoại
 * không mở được console.
 */
export async function uploadFeedbackImage(uri: string): Promise<string> {
  if (appConfig.api.useMocks) {
    /* Demo offline: giữ nguyên đường dẫn tạm làm "mã tệp". Ảnh vẫn xem được
       trong phiên đang chạy, đủ để trình diễn luồng gửi phiếu. */
    await mockDelay();
    return uri;
  }

  let blob: Blob;
  try {
    blob = await zaloService.readImageBlob(uri);
  } catch (err: unknown) {
    throw new ApiError(err instanceof Error ? err.message : "Không đọc được ảnh đã chọn", 0);
  }

  const invalid = validateImage(blob);
  if (invalid) throw new ApiError(invalid, 400);

  const mimeType = blob.type || "image/jpeg";
  const form = new FormData();
  form.append("file", blob, nameFor(mimeType));
  form.append("purpose", FEEDBACK_PURPOSE);
  form.append("isPrivate", "true");

  const uploaded = await apiClient.upload<UploadedFile>("/files/upload", form);
  return uploaded.id;
}
