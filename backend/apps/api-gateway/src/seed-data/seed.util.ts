/**
 * Tiện ích dùng chung cho bộ dữ liệu seed nghiệp vụ.
 * Mọi hàm ở đây phải cho kết quả TẤT ĐỊNH (chạy lại nhiều lần ra cùng giá trị)
 * để `npm run seed` lần hai không tạo ra dữ liệu khác lần đầu.
 */

/** Số mili-giây của một ngày */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Vì sao seed vẫn viết ngày dạng chuỗi `'19/08/2026'`.
 *
 * Cơ sở dữ liệu v2 lưu mốc thời gian dạng SỐ, nhưng tệp seed là tệp **người
 * đọc và sửa tay**: `1786...` thì không ai soát được, còn `'19/08/2026'` thì
 * nhìn là biết. Nên seed giữ chuỗi ở phần khai báo, rồi quy đổi sang số ở đúng
 * một bước dựng dữ liệu, bằng ba hàm dưới đây.
 *
 * Cả ba đều neo vào **giờ Việt Nam**, không phụ thuộc giờ máy chủ.
 */

/** Lệch giờ Việt Nam so với UTC */
const VN_OFFSET_MS = 7 * 60 * 60_000;

/** `dd/MM/yyyy` → mốc HẾT ngày giờ Việt Nam (23:59:59.999) — dùng cho hạn xử lý */
export function endOfVnDay(value: string): number {
  const [day, month, year] = value.split('/').map(Number);
  return Date.UTC(year, month - 1, day, 23, 59, 59, 999) - VN_OFFSET_MS;
}

/** `dd/MM/yyyy` → mốc 00:00 giờ Việt Nam — dùng cho ngày ghi trên văn bản */
export function vnDay(value: string): number {
  const [day, month, year] = value.split('/').map(Number);
  return Date.UTC(year, month - 1, day) - VN_OFFSET_MS;
}

/** `dd/MM/yyyy HH:mm` (hoặc `dd/MM/yyyy`) → mốc theo giờ Việt Nam */
export function parseVnDateTime(value: string): number {
  const [datePart, timePart = '00:00'] = value.trim().split(/\s+/);
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour || 0, minute || 0) - VN_OFFSET_MS;
}

/** Cộng thêm số ngày vào một mốc thời gian */
export function addDays(at: number, days: number): number {
  return at + days * DAY_MS;
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

/* ─────────────────── Nhật ký và bình luận cho dữ liệu seed ─────────────────── */

/**
 * Dựng một mốc nhật ký cho dữ liệu seed theo khuôn `ActivityEntry` của v2.
 *
 * Dữ liệu seed là nội dung DEMO: mỗi mốc là một câu tường thuật riêng, không
 * quy về một tập hành động đóng như mã nghiệp vụ. Nên seed dùng một khoá chung
 * `<phân hệ>.note` và đặt cả câu vào `detail` — đúng vai của `detail` là phần
 * biến của hành động.
 *
 * `actorId` để rỗng (hệ thống): seed chưa tra được id cán bộ, vì tài khoản cán
 * bộ do `users.seed.ts` chèn ở một bước khác. Khi P7-02 chặng 2c đổi `assignee`
 * sang id, bộ seeder sẽ có sẵn bản đồ tên → id và chỗ này nối vào đó.
 *
 * @param action khoá dạng `<phân hệ>.note`
 * @param detail câu tường thuật của mốc
 * @param when   chuỗi `dd/MM/yyyy HH:mm` lấy từ dữ liệu mock; phần chữ đứng
 *               trước (ví dụ "Từ 14/08/2026") được bỏ qua
 */
export function seedActivity(
  action: string,
  detail: string,
  when?: string,
  state: 'ok' | 'cur' = 'ok',
): { at: number; actorId: string; action: string; detail: string; state: 'ok' | 'cur' } {
  return { at: seedMoment(when), actorId: '', action, detail, state };
}

/** Như `seedActivity` nhưng nhận sẵn mốc dạng số, không phải chuỗi mô tả */
export function seedActivityAt(
  action: string,
  detail: string,
  at: number,
  state: 'ok' | 'cur' = 'ok',
): { at: number; actorId: string; action: string; detail: string; state: 'ok' | 'cur' } {
  return { at, actorId: '', action, detail, state };
}

/** Bình luận cho dữ liệu seed theo khuôn `Comment` của v2 */
export function seedComment(
  content: string,
  when?: string,
): { at: number; authorId: string; content: string } {
  return { at: seedMoment(when), authorId: '', content };
}

/** Mốc dự phòng khi chuỗi thời gian của mock không đọc được — tất định */
const SEED_FALLBACK_AT = Date.UTC(2026, 7, 1, 8, 0, 0) - VN_OFFSET_MS;

/**
 * Bóc mốc `dd/MM/yyyy HH:mm` ra khỏi một chuỗi mô tả của mock.
 * Không đọc được thì trả mốc dự phòng cố định — seed phải tất định, và một mốc
 * đoán sai trong dữ liệu demo còn hơn `NaN` lọt vào cơ sở dữ liệu.
 */
function seedMoment(when?: string): number {
  if (!when) return SEED_FALLBACK_AT;
  const matched = /(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/.exec(when);
  if (!matched) return SEED_FALLBACK_AT;
  return parseVnDateTime(`${matched[1]} ${matched[2] ?? '00:00'}`);
}
