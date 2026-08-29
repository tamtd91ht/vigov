/**
 * Đọc siêu dữ liệu tệp media ngay tại trình duyệt.
 *
 * Backend lưu `duration` (video) và `durationSeconds` (bản tin truyền thanh)
 * nhưng không tự bóc tách từ tệp, nên Web Quản trị đo trước khi gửi.
 */

/** Giây → "mm:ss"; giá trị không hợp lệ trả về chuỗi rỗng */
export function toDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Thời lượng tệp media tính bằng giây.
 * Không đọc được (codec trình duyệt không hỗ trợ, tệp hỏng) thì trả về 0 —
 * thời lượng không bắt buộc nên chỉ bỏ qua chứ không chặn việc lưu.
 */
export function readMediaDuration(file: File, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(kind);
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) ? value : 0);
    };
    media.preload = "metadata";
    media.onloadedmetadata = () => done(media.duration);
    media.onerror = () => done(0);
    media.src = url;
  });
}
