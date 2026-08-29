/**
 * Hằng số bản đồ mô phỏng dùng chung.
 *
 * Bản đồ hiện tại là khung ảnh tĩnh, ghim đặt theo toạ độ phần trăm (x, y).
 * Dữ liệu thật trong database chỉ lưu `lat`/`lng` — phản ánh gửi từ Zalo Mini
 * App lấy thẳng GPS của điện thoại nên không bao giờ có sẵn x/y. Vì vậy phần
 * trăm được TÍNH RA từ toạ độ địa lý, không lưu song song trong database.
 *
 * Phép chiếu ở đây là nghịch đảo của `pinToLatLng` trong
 * `backend/apps/api-gateway/src/seed-data/seed.util.ts` — hai hằng số dưới đây
 * phải khớp với bên đó, đổi một bên thì phải đổi cả hai.
 *
 * Khi khách hàng chốt nhà cung cấp bản đồ thật (câu hỏi mở #2 — VietMap /
 * Goong / MapLibre), toàn bộ tệp này bị thay bằng adapter của nhà cung cấp và
 * `lat`/`lng` được dùng trực tiếp.
 */

/** Tâm khung bản đồ mô phỏng — khớp MAP_CENTER phía backend */
export const MAP_CENTER = { lat: 20.6935, lng: 105.9285 };

/** Độ rộng khung theo độ (lat/lng) — khớp MAP_SPAN phía backend */
export const MAP_SPAN = 0.02;

/** Vị trí ghim khi bản ghi chưa có toạ độ — đặt giữa khung, hơi lệch xuống */
export const DEFAULT_PIN = { x: 50, y: 52 };

export interface PinPosition {
  /** Phần trăm theo chiều ngang, 0 = mép trái */
  x: number;
  /** Phần trăm theo chiều dọc, 0 = mép trên */
  y: number;
}

/** Giới hạn giá trị vào khoảng [0, 100] để ghim không rơi ra ngoài khung */
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Chiếu toạ độ địa lý về phần trăm trong khung bản đồ mô phỏng.
 * Thiếu `lat` hoặc `lng` thì trả `DEFAULT_PIN`.
 */
export function latLngToPin(coords: { lat?: number; lng?: number } | null | undefined): PinPosition {
  if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
    return DEFAULT_PIN;
  }
  const x = 50 + ((coords.lng - MAP_CENTER.lng) / MAP_SPAN) * 100;
  const y = 50 - ((coords.lat - MAP_CENTER.lat) / MAP_SPAN) * 100;
  return { x: clampPercent(x), y: clampPercent(y) };
}
