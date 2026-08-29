/**
 * Dữ liệu seed cây tổ chức UBND xã (WBS #9)
 * — làm phẳng orgTree của admin-web/src/mocks/settings.ts.
 *
 * Schema OrgNode dựng cây bằng `parentId` (ObjectId dạng chuỗi) nên bản ghi ở đây
 * chỉ khai báo `key` / `parentKey` logic; seed.ts sẽ tra `_id` thật của nút cha
 * sau khi chèn. Mảng đã sắp xếp theo thứ tự cha trước – con sau.
 */

export interface OrgNodeSeed {
  /** Khoá logic dùng để nối cha – con trong lúc seed */
  key: string;
  /** Khoá logic của nút cha; bỏ trống là nút gốc */
  parentKey?: string;
  name: string;
  subtitle: string;
  color: string;
  order: number;
}

export const ORG_NODE_SEED: OrgNodeSeed[] = [
  {
    key: 'ubnd',
    name: 'UBND Xã Đại Thắng',
    subtitle: 'Cơ quan hành chính nhà nước cấp xã',
    color: '#1B3A5C',
    order: 0,
  },

  // ── Cấp 2: lãnh đạo UBND ────────────────────────────────────────────────
  { key: 'chu-tich', parentKey: 'ubnd', name: 'Chủ tịch UBND xã', subtitle: 'Nguyễn Văn Bình', color: '#E91E8C', order: 1 },
  {
    key: 'pct-kinh-te',
    parentKey: 'ubnd',
    name: 'Phó Chủ tịch UBND xã (Kinh tế)',
    subtitle: 'Trần Thị Hạnh',
    color: '#8E44AD',
    order: 2,
  },
  {
    key: 'pct-van-xa',
    parentKey: 'ubnd',
    name: 'Phó Chủ tịch UBND xã (Văn xã)',
    subtitle: 'Vũ Đức Anh phụ trách chuyên môn',
    color: '#27AE60',
    order: 3,
  },

  // ── Cấp 3: bộ phận chuyên môn ───────────────────────────────────────────
  { key: 'van-phong', parentKey: 'chu-tich', name: 'Văn phòng UBND', subtitle: 'Trần Thị Hạnh · 6 cán bộ', color: '#3B82C4', order: 1 },
  { key: 'cong-an', parentKey: 'chu-tich', name: 'Công an xã', subtitle: 'Hoàng Văn Sơn · 9 cán bộ', color: '#E74C3C', order: 2 },
  { key: 'quan-su', parentKey: 'chu-tich', name: 'Quân sự xã', subtitle: 'Bùi Quang Khải · 4 cán bộ', color: '#5B6C8F', order: 3 },

  { key: 'dia-chinh', parentKey: 'pct-kinh-te', name: 'Địa chính – Xây dựng', subtitle: 'Lê Minh Tuấn · 5 cán bộ', color: '#3B82C4', order: 1 },
  { key: 'tai-chinh', parentKey: 'pct-kinh-te', name: 'Tài chính – Kế toán', subtitle: 'Đỗ Thanh Hà · 3 cán bộ', color: '#E67E22', order: 2 },

  { key: 'tu-phap', parentKey: 'pct-van-xa', name: 'Tư pháp – Hộ tịch', subtitle: 'Phạm Thị Ngọc · 3 cán bộ', color: '#8E44AD', order: 1 },
  { key: 'van-hoa', parentKey: 'pct-van-xa', name: 'Văn hoá – Xã hội', subtitle: 'Vũ Đức Anh · 4 cán bộ', color: '#27AE60', order: 2 },
  {
    key: 'hanh-chinh-cong',
    parentKey: 'pct-van-xa',
    name: 'Trung tâm Phục vụ hành chính công',
    subtitle: 'Ngô Thị Lan · 5 cán bộ',
    color: '#17A2A2',
    order: 3,
  },
];
