/** Tiện ích hiển thị dùng chung */

/** Màu progress bar theo % tiến độ (đồng bộ mockup) */
export function progressColor(pct: number): string {
  if (pct >= 80) return "var(--green)";
  if (pct >= 50) return "var(--blue)";
  if (pct >= 30) return "var(--orange)";
  return "var(--red)";
}

/** Nhãn hạn xử lý theo số ngày còn lại */
export function deadlineLabel(daysLeft: number): { text: string; color: string; late: boolean } {
  if (daysLeft < 0) return { text: `Quá hạn ${-daysLeft} ngày`, color: "var(--red)", late: true };
  if (daysLeft === 0) return { text: "Đến hạn hôm nay", color: "var(--orange)", late: false };
  if (daysLeft <= 3) return { text: `Còn ${daysLeft} ngày`, color: "var(--orange)", late: false };
  return { text: `Còn ${daysLeft} ngày`, color: "var(--green)", late: false };
}

/** Nhãn SLA theo số giờ còn lại (âm = quá hạn) */
export function slaLabel(hoursLeft: number, resolved: boolean): { text: string; color: string } {
  if (resolved) return { text: "Hoàn thành", color: "var(--green)" };
  if (hoursLeft < 0) return { text: `Quá hạn ${-hoursLeft} giờ`, color: "var(--red)" };
  if (hoursLeft <= 12) return { text: `Còn ${hoursLeft} giờ`, color: "var(--orange)" };
  return { text: `Còn ${hoursLeft} giờ`, color: "var(--green)" };
}

/** Viết tắt tên: "Nguyễn Văn Bình" -> "NB" (chữ đầu của họ + chữ đầu của tên) */
export function nameInitials(fullName: string): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words[words.length - 1][0];
  return (words.length === 1 ? first : `${first}${last}`).toUpperCase();
}

/** Định dạng số theo locale VN: 1204 -> "1.204" */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

/** Định dạng tỷ đồng: 8.5 -> "8,5 tỷ" */
export function formatBillion(n: number): string {
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
}
