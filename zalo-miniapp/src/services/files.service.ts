import { appConfig } from "@/config/app.config";
import { ApiError, getAccessToken } from "./api";

/**
 * Tải ảnh hiện trường của phản ánh lên kho tệp dùng chung (WBS #24 — `/files`).
 *
 * Không dùng `apiClient`: client đó luôn đặt `Content-Type: application/json`,
 * còn multipart bắt buộc để trình duyệt tự sinh header kèm `boundary`.
 *
 * Trình chọn ảnh của Zalo trả về ĐƯỜNG DẪN tệp tạm trong webview (`filePaths`),
 * không phải đối tượng File. Đường dẫn đó chỉ sống trong lúc soạn phiếu, nên
 * phải `fetch` về thành Blob rồi tải lên máy chủ ngay — đó là lý do luồng gửi
 * phản ánh tải ảnh trước, lấy `imageFileIds`, mới tạo phiếu.
 */

/** Mục đích tệp — khớp enum FILE_PURPOSES của backend */
const FEEDBACK_PURPOSE = "feedback";

/**
 * Ảnh hiện trường là dữ liệu cá nhân (có thể lộ mặt người, biển số, địa chỉ nhà)
 * nên BẮT BUỘC tải lên ở chế độ riêng tư theo quy ước TB-09 trong SECURITY.md:
 * chỉ mở được bằng link có chữ ký, không để lộ qua `GET /files/:id` công khai.
 */
const FEEDBACK_IS_PRIVATE = true;

/**
 * Cạnh dài tối đa sau khi nén. Ảnh điện thoại thường 3000–4000px / 3–8MB; cán
 * bộ chỉ cần nhìn rõ hiện trường nên 1600px là đủ, mà mỗi ảnh còn ~200–500KB.
 * Người dân gửi phản ánh phần lớn bằng 3G/4G ngoài đường.
 */
const MAX_EDGE_PX = 1600;

/** Chất lượng JPEG khi nén — 0.8 là mức gần như không thấy khác bằng mắt */
const JPEG_QUALITY = 0.8;

/** Kiểu ảnh sau khi nén; backend chấp nhận image/jpeg cho purpose 'feedback' */
const OUTPUT_MIME = "image/jpeg";

/** Phản hồi của POST /files/upload (FilesService.UploadedFileResult) */
interface UploadedFileResult {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Nén một ảnh bằng canvas: thu nhỏ về `MAX_EDGE_PX` rồi xuất JPEG.
 *
 * Ảnh nhỏ hơn ngưỡng thì KHÔNG phóng to (tỉ lệ chặn ở 1) — phóng to chỉ làm
 * tệp nặng thêm mà không rõ hơn.
 *
 * Nén thất bại (canvas bị chặn, ảnh hỏng, hết bộ nhớ) thì trả về `null` để bên
 * gọi tải nguyên bản Blob gốc: thà ảnh nặng còn hơn mất ảnh minh chứng.
 */
async function compress(blob: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((out) => resolve(out), OUTPUT_MIME, JPEG_QUALITY);
    });
  } catch {
    return null;
  } finally {
    // Giải phóng bộ nhớ ảnh ngay: gửi 3 ảnh 4000px liên tiếp trên máy yếu dễ tràn
    bitmap?.close();
  }
}

/** Đọc đường dẫn tệp tạm của Zalo (hoặc data-URI ở chế độ mock) thành Blob */
async function readAsBlob(filePath: string): Promise<Blob> {
  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`đọc tệp trả về ${res.status}`);
    return await res.blob();
  } catch {
    throw new ApiError("Không đọc được ảnh vừa chọn. Chọn lại ảnh rồi thử lại.", 0);
  }
}

/** Đặt tên tệp có ý nghĩa khi cán bộ tải về: anh-hien-truong-<mốc>-<số>.jpg */
function buildFileName(index: number): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `anh-hien-truong-${stamp}-${index + 1}.jpg`;
}

/**
 * Tải MỘT ảnh lên và trả về mã tệp.
 *
 * Dùng `fetch` chứ không phải XMLHttpRequest như admin-web: Mini App không vẽ
 * thanh tiến trình theo phần trăm (chỉ hiện trạng thái "Đang tải ảnh…") nên
 * không cần sự kiện `progress`.
 */
async function uploadOne(blob: Blob, index: number): Promise<string> {
  const form = new FormData();
  form.append("file", blob, buildFileName(index));
  form.append("purpose", FEEDBACK_PURPOSE);
  form.append("isPrivate", String(FEEDBACK_IS_PRIVATE));

  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${appConfig.api.baseUrl}/files/upload`, {
      method: "POST",
      // KHÔNG đặt Content-Type: trình duyệt phải tự sinh kèm boundary của multipart
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError("Không tải được ảnh lên. Kiểm tra đường truyền rồi thử lại.", 0);
  }

  if (!res.ok) {
    let message = `Máy chủ trả về lỗi ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.message) message = body.message;
    } catch {
      // Thân phản hồi không phải JSON — giữ thông báo mặc định
    }
    throw new ApiError(message, res.status);
  }

  const uploaded = (await res.json()) as UploadedFileResult;
  return uploaded.id;
}

export const filesService = {
  /**
   * Tải toàn bộ ảnh hiện trường lên, trả về danh sách mã tệp theo ĐÚNG thứ tự
   * người dân đã chọn.
   *
   * Tải TUẦN TỰ chứ không song song: gửi 3 ảnh cùng lúc trên 3G hay làm nghẽn
   * rồi timeout cả ba, mà thứ tự trả về cũng không còn bảo đảm.
   *
   * Một ảnh lỗi là ném lỗi cho cả lượt — phiếu phản ánh thiếu ảnh minh chứng
   * thì cán bộ không xác minh được, nên để người dân biết và thử lại tốt hơn là
   * gửi phiếu thiếu ảnh trong im lặng.
   */
  async uploadFeedbackImages(filePaths: string[]): Promise<string[]> {
    const fileIds: string[] = [];
    for (const [index, filePath] of filePaths.entries()) {
      const original = await readAsBlob(filePath);
      const compressed = await compress(original);
      fileIds.push(await uploadOne(compressed ?? original, index));
    }
    return fileIds;
  },
};
