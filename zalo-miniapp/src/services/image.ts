/**
 * Xử lý ảnh trước khi tải lên — NGUỒN CHUẨN DUY NHẤT cho hằng số và phép nén.
 *
 * VÌ SAO CÓ TỆP NÀY: trước đây `zalo.ts` (đường dự phòng đọc ảnh) và
 * `files.service.ts` (đường nén trước khi tải lên) mỗi nơi tự khai một bộ hằng
 * số riêng — 1600px/0.85 và 1600px/0.8. Hai bản đó vừa lệch nhau, vừa khiến ảnh
 * đi qua đường dự phòng bị THU NHỎ HAI LẦN và NÉN JPEG HAI LẦN: chất lượng mất
 * thêm một nấc mà không ai thấy, vì mỗi lần nén đều "trông vẫn ổn".
 */

/**
 * Cạnh dài tối đa sau khi nén. Ảnh điện thoại thường 3000–4000px / 3–8MB; cán
 * bộ chỉ cần nhìn rõ hiện trường nên 1600px là đủ, mà mỗi ảnh còn ~200–500KB.
 * Người dân gửi phản ánh phần lớn bằng 3G/4G ngoài đường.
 */
export const MAX_EDGE_PX = 1600;

/** Chất lượng JPEG khi nén — 0.85 gần như không thấy khác bằng mắt */
export const JPEG_QUALITY = 0.85;

/** Kiểu ảnh sau khi nén; backend chấp nhận image/jpeg cho purpose 'feedback' */
export const OUTPUT_MIME = "image/jpeg";

/** Ảnh đã là JPEG và không vượt cạnh dài tối đa thì KHÔNG nén lại */
function alreadyWithinBudget(blob: Blob, width: number, height: number): boolean {
  return blob.type === OUTPUT_MIME && Math.max(width, height) <= MAX_EDGE_PX;
}

/**
 * Giải mã ảnh thành khung vẽ được, ĐÃ ÁP DỤNG hướng EXIF.
 *
 * VÌ SAO PHẢI TRUYỀN `imageOrientation: "from-image"`: ảnh dọc chụp bằng điện
 * thoại thực chất được lưu NGANG kèm một cờ EXIF "hãy quay 90°". Thẻ `<img>`
 * luôn đọc cờ đó, nên ảnh xem trước trong lúc soạn phiếu hiện ĐÚNG. Nhưng
 * `createImageBitmap` thì tuỳ phiên bản trình duyệt: mặc định cũ là BỎ QUA cờ.
 * Bỏ qua cờ rồi vẽ sang canvas là ảnh nằm ngang, và bản JPEG xuất ra KHÔNG còn
 * EXIF để ai sửa lại nữa — nên trên Web Quản trị ảnh hiện xoay 90°, lại bị ô
 * `object-fit` cắt tiếp, thành ra "méo mó". Truyền tường minh thì mọi trình
 * duyệt xử sự như nhau.
 *
 * Đường dự phòng dùng `<img>` + object URL cho webview không có
 * `createImageBitmap` (WKWebView cũ) — thẻ `<img>` áp dụng hướng EXIF sẵn.
 */
async function decode(blob: Blob): Promise<{ draw: CanvasImageSource; width: number; height: number; release: () => void } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return {
        draw: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Rơi xuống đường <img> bên dưới
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("không giải mã được ảnh"));
      el.src = url;
    });
    return {
      draw: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * Thu nhỏ ảnh về `MAX_EDGE_PX` rồi xuất JPEG, giữ nguyên tỉ lệ.
 *
 * Trả `null` khi KHÔNG cần (hoặc không thể) nén, để bên gọi tải nguyên bản:
 *  - ảnh đã là JPEG và trong hạn mức → nén lại chỉ làm mất thêm chất lượng
 *  - giải mã / canvas thất bại → thà ảnh nặng còn hơn mất ảnh minh chứng
 *
 * Ảnh nhỏ hơn ngưỡng KHÔNG bị phóng to (tỉ lệ chặn ở 1) — phóng to chỉ làm tệp
 * nặng thêm mà không rõ hơn.
 */
export async function compressImage(blob: Blob): Promise<Blob | null> {
  const decoded = await decode(blob);
  if (!decoded) return null;

  try {
    if (alreadyWithinBudget(blob, decoded.width, decoded.height)) return null;

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(decoded.draw, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((out) => resolve(out), OUTPUT_MIME, JPEG_QUALITY);
    });
  } catch {
    return null;
  } finally {
    // Giải phóng bộ nhớ ảnh ngay: gửi 3 ảnh 4000px liên tiếp trên máy yếu dễ tràn
    decoded.release();
  }
}
