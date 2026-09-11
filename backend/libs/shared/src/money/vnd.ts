/**
 * Tiền Việt Nam trong ViGov — ĐƠN VỊ LƯU LÀ ĐỒNG, SỐ NGUYÊN.
 *
 * VÌ SAO KHÔNG LƯU "TỶ ĐỒNG" DẠNG SỐ THỰC: bản đầu của phân hệ Giải ngân lưu
 * `planned`/`actual` là số thực đơn vị tỷ đồng và làm tròn 2 chữ số thập phân —
 * tức là làm tròn tới 10 triệu đồng. Hậu quả đo được:
 *
 *   nhập 823 triệu        → lưu 820.000.000 đồng   (mất 3.000.000 đồng)
 *   nhập 1.234.567.890 đ  → lưu 1.230.000.000 đồng (mất 4.567.890 đồng)
 *   nhập 55 triệu         → lưu 60.000.000 đồng    (THỪA 5.000.000 đồng)
 *
 * Số quyết toán ngân sách phải đúng tới đồng và phải cộng lại đúng bằng tổng
 * các chứng từ. Sai một đồng là bảng đối chiếu với kế toán không khớp, và người
 * lập báo cáo phải giải trình.
 *
 * VÌ SAO `number` LÀ ĐỦ, KHÔNG CẦN BigInt: `Number.MAX_SAFE_INTEGER` ≈ 9,007 ×
 * 10¹⁵ đồng ≈ 9 triệu tỷ đồng. Ngân sách một xã cỡ chục tỷ mỗi năm, còn cách
 * ngưỡng đó nhiều bậc. Điều kiện là MỌI phép tính chỉ dùng số nguyên: cộng, trừ
 * và nhân — không chia rồi cộng lại.
 */

/** Số đồng lớn nhất một trường tiền được nhận — chặn lỗi nhập thừa số 0 */
export const MAX_VND = 1_000_000_000_000_000; // một triệu tỷ đồng

const TY = 1_000_000_000;
const TRIEU = 1_000_000;
const NGHIN = 1_000;

/** Giá trị có phải số tiền hợp lệ: số nguyên, không âm, trong ngưỡng */
export function isValidVnd(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_VND
  );
}

/**
 * Định dạng đầy đủ: `1.234.567.890 đồng`.
 *
 * Dùng cho chứng từ, bảng đối chiếu, tệp xuất — mọi chỗ con số phải khớp từng
 * đồng với kế toán. Không viết tắt, không làm tròn.
 */
export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) return '0 đồng';
  return `${Math.trunc(amount).toLocaleString('vi-VN')} đồng`;
}

/**
 * Định dạng gọn cho thẻ tổng quan và biểu đồ: `1,23 tỷ đồng`, `850 triệu đồng`.
 *
 * CHỈ dùng để HIỂN THỊ TỔNG QUAN. Không bao giờ dùng ở chỗ cần đối chiếu chứng
 * từ — nó làm tròn, và đó là cái đã gây ra lỗi mất tiền nói ở đầu tệp.
 */
export function formatVndShort(amount: number): string {
  const value = Math.trunc(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  if (value === 0) return '0 đồng';
  if (value >= TY) return `${sign}${trimZero(value / TY)} tỷ đồng`;
  if (value >= TRIEU) return `${sign}${trimZero(value / TRIEU)} triệu đồng`;
  if (value >= NGHIN) return `${sign}${trimZero(value / NGHIN)} nghìn đồng`;
  return `${sign}${value} đồng`;
}

/** Hai chữ số thập phân, bỏ số 0 vô nghĩa, dùng dấu phẩy thập phân kiểu Việt Nam */
function trimZero(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
}

/**
 * Tỷ lệ phần trăm, 2 chữ số thập phân, tính TRÊN SỐ NGUYÊN.
 *
 * Mẫu số bằng 0 trả `null` chứ không trả 0: "chưa có kế hoạch vốn" khác hẳn
 * "giải ngân 0%". Nơi gọi hiển thị `—` cho `null`.
 * → `skills/bao-cao-va-xuat-file` MUST NOT #1
 */
export function percentOf(part: number, total: number): number | null {
  if (!total || total <= 0) return null;
  return Math.round((part * 10_000) / total) / 100;
}

/**
 * Cộng danh sách số tiền. Cộng số nguyên nên tổng luôn khớp từng đồng với các
 * số hạng — không có sai số tích luỹ như khi cộng số thực.
 */
export function sumVnd(amounts: number[]): number {
  return amounts.reduce((sum, value) => sum + Math.trunc(value || 0), 0);
}

/**
 * Quy đổi số tiền đơn vị TỶ ĐỒNG (số thực, mô hình cũ) sang ĐỒNG (số nguyên).
 *
 * Chỉ dùng trong script di trú dữ liệu cũ. Làm tròn tới đồng gần nhất: dữ liệu
 * cũ vốn đã bị làm tròn tới 10 triệu, ở đây không phục hồi được phần đã mất —
 * chỉ chuyển đúng những gì còn lưu, và script phải in ra cảnh báo về việc này.
 */
export function tyDongToVnd(tyDong: number): number {
  return Math.round((tyDong || 0) * TY);
}
