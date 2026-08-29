/**
 * Tiện ích dùng chung cho bộ dữ liệu seed nghiệp vụ.
 * Mọi hàm ở đây phải cho kết quả TẤT ĐỊNH (chạy lại nhiều lần ra cùng giá trị)
 * để `npm run seed` lần hai không tạo ra dữ liệu khác lần đầu.
 */

/** Số mili-giây của một ngày */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Chuỗi dd/MM/yyyy → Date cuối ngày (23:59:59.999) — dùng cho mốc hạn xử lý */
export function endOfVnDay(value: string): Date {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** Chuỗi "dd/MM/yyyy HH:mm" (hoặc "dd/MM/yyyy") → Date */
export function parseVnDateTime(value: string): Date {
  const [datePart, timePart = '00:00'] = value.trim().split(/\s+/);
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
}

/** Cộng thêm số ngày vào một mốc thời gian */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Số điện thoại che dấu của mock ("098•••432") → số 10 chữ số hợp lệ.
 * Giữ nguyên 3 số đầu và 3 số cuối, 4 số giữa sinh tất định từ chuỗi gốc
 * nên cùng một chuỗi che dấu luôn cho ra cùng một số — nhờ đó công dân
 * trong users.seed.ts và người gửi trong feedback.seed.ts khớp nhau.
 */
export function unmaskPhone(masked: string): string {
  const digits = masked.replace(/\D/g, '');
  const head = digits.slice(0, 3);
  const tail = digits.slice(-3);
  let hash = 0;
  for (let i = 0; i < masked.length; i++) hash = (hash * 31 + masked.charCodeAt(i)) >>> 0;
  const middle = String(hash % 10_000).padStart(4, '0');
  return `${head}${middle}${tail}`;
}

/** "12:30" → 750 giây */
export function durationToSeconds(value: string): number {
  const [minutes, seconds] = value.split(':').map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}

/**
 * Toạ độ ghim trên bản đồ mini của mock là phần trăm trong khung ảnh.
 * Quy đổi sang lat/lng quanh trung tâm xã Đại Thắng (Phú Xuyên, Hà Nội)
 * để bản đồ phản ánh có điểm hiển thị thật.
 */
const MAP_CENTER = { lat: 20.6935, lng: 105.9285 };
/** Bán kính khung bản đồ quy ước (độ) */
const MAP_SPAN = 0.02;

export function pinToLatLng(pin: { x: number; y: number }): { lat: number; lng: number } {
  const lat = MAP_CENTER.lat + ((50 - pin.y) / 100) * MAP_SPAN;
  const lng = MAP_CENTER.lng + ((pin.x - 50) / 100) * MAP_SPAN;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}
