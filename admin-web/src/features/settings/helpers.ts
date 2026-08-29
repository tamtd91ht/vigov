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
