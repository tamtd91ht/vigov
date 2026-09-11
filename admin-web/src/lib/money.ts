/**
 * Tiền Việt Nam ở Web Quản trị — ĐƠN VỊ LÀ ĐỒNG, SỐ NGUYÊN.
 *
 * Bản sao đúng quy ước của `backend/libs/shared/src/money/vnd.ts`. Giao diện
 * KHÔNG tự đổi đơn vị và KHÔNG tự tính tỷ lệ: mọi con số tổng hợp do máy chủ
 * tính rồi trả về. Tính ở hai nơi là sớm muộn lệch nhau, và con số trên màn hình
 * khác con số trong tệp xuất thì không ai tin số liệu nữa.
 *
 * Vì sao không lưu "tỷ đồng" số thực: mô hình cũ làm tròn 2 chữ số thập phân của
 * tỷ đồng, tức làm tròn tới 10 triệu đồng — nhập 823 triệu lưu thành 820 triệu.
 */

const TY = 1_000_000_000;
const TRIEU = 1_000_000;
const NGHIN = 1_000;

/** `1.234.567.890 đồng` — dùng ở chứng từ, bảng đối chiếu, ô nhập */
export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "0 đồng";
  return `${Math.trunc(amount).toLocaleString("vi-VN")} đồng`;
}

/** `1.234.567.890` — không có chữ "đồng", dùng trong ô nhập số */
export function formatVndNumber(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  return Math.trunc(amount).toLocaleString("vi-VN");
}

/**
 * `1,23 tỷ đồng` — CHỈ để hiển thị tổng quan (thẻ số liệu, nhãn biểu đồ).
 * Không dùng ở chỗ cần đối chiếu chứng từ: hàm này làm tròn.
 */
export function formatVndShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "0 đồng";
  const value = Math.trunc(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  if (value === 0) return "0 đồng";
  if (value >= TY) return `${sign}${trimZero(value / TY)} tỷ đồng`;
  if (value >= TRIEU) return `${sign}${trimZero(value / TRIEU)} triệu đồng`;
  if (value >= NGHIN) return `${sign}${trimZero(value / NGHIN)} nghìn đồng`;
  return `${sign}${value} đồng`;
}

function trimZero(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

/**
 * Đọc số tiền người dùng gõ vào ô nhập về SỐ NGUYÊN ĐỒNG.
 *
 * Chỉ nhận chữ số và dấu phân cách nghìn — KHÔNG nhận đơn vị dạng chữ ("1,25
 * tỷ"). Đó là cách nhập của mô hình cũ và là nguồn của lỗi sai 1000 lần: "1,200
 * triệu" bị hiểu thành 1,2 triệu thay vì 1.200 triệu. Nay cán bộ gõ đủ số 0, và
 * giao diện hiện lại số đã tách nhóm nghìn kèm cách đọc để tự kiểm.
 *
 * @returns số nguyên đồng, hoặc `null` nếu ô trống / không đọc được
 */
export function parseVndInput(raw: string): number | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Đọc số tiền thành chữ theo bậc, để cán bộ tự kiểm số 0 đã gõ đủ chưa.
 * Ví dụ 1.200.000.000 → "một tỷ hai trăm triệu đồng".
 *
 * Chỉ đọc tới bậc triệu — đủ để phát hiện nhập thiếu hoặc thừa một số 0, mà
 * không phải viết cả bộ đọc số tiếng Việt.
 */
export function readVndRough(amount: number | null | undefined): string {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return "";
  const value = Math.trunc(amount);
  const ty = Math.floor(value / TY);
  const trieu = Math.floor((value % TY) / TRIEU);
  const conLai = value % TRIEU;

  const parts: string[] = [];
  if (ty > 0) parts.push(`${ty} tỷ`);
  if (trieu > 0) parts.push(`${trieu} triệu`);
  if (conLai > 0) parts.push(`${conLai.toLocaleString("vi-VN")}`);
  return parts.length > 0 ? `${parts.join(" ")} đồng` : "";
}
