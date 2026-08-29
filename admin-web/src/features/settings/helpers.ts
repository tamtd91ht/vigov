/** Tiện ích riêng của phân hệ Cấu hình */

/** Nền chip nhạt 12% suy ra từ màu chữ (hỗ trợ cả CSS var) */
export function chipTint(color: string): string {
  return `color-mix(in srgb, ${color} 12%, transparent)`;
}

/** Slug hoá tên tiếng Việt làm key danh mục: "Vệ sinh môi trường" -> "ve-sinh-moi-truong" */
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Sinh mật khẩu tạm cho thao tác đặt lại mật khẩu cán bộ.
 *
 * Dùng `crypto.getRandomValues` chứ không phải `Math.random` — mật khẩu này
 * mở được tài khoản quản trị nên phải khó đoán thật sự.
 *
 * Bộ ký tự bỏ các chữ dễ nhìn nhầm (0/O, 1/l/I) vì mật khẩu sẽ được đọc hoặc
 * chép tay khi bàn giao. Độ dài 12, thoả ràng buộc tối thiểu 8 của máy chủ.
 */
export function generateTempPassword(length = 12): string {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
}
