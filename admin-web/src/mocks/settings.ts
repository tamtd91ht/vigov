import type { InternalUser, OrgNode } from "@/types";

/**
 * Mock phân hệ Cấu hình — port từ MOCK_DATA.cauHinh (vigov-prototype.html).
 * Nguồn thật: API tổ chức + API quản trị tài khoản (P3).
 */

/** Sơ đồ tổ chức UBND xã (cây 3 cấp) */
export const orgTree: OrgNode = {
  name: "UBND Xã Đại Thắng",
  subtitle: "Cơ quan hành chính nhà nước cấp xã",
  color: "#1B3A5C",
  children: [
    {
      name: "Chủ tịch UBND xã",
      subtitle: "Nguyễn Văn Bình",
      color: "#E91E8C",
      children: [
        { name: "Văn phòng UBND", subtitle: "Trần Thị Hạnh · 6 cán bộ", color: "#3B82C4" },
        { name: "Công an xã", subtitle: "Hoàng Văn Sơn · 9 cán bộ", color: "#E74C3C" },
        { name: "Quân sự xã", subtitle: "Bùi Quang Khải · 4 cán bộ", color: "#5B6C8F" },
      ],
    },
    {
      name: "Phó Chủ tịch UBND xã (Kinh tế)",
      subtitle: "Trần Thị Hạnh",
      color: "#8E44AD",
      children: [
        { name: "Địa chính – Xây dựng", subtitle: "Lê Minh Tuấn · 5 cán bộ", color: "#3B82C4" },
        { name: "Tài chính – Kế toán", subtitle: "Đỗ Thanh Hà · 3 cán bộ", color: "#E67E22" },
      ],
    },
    {
      name: "Phó Chủ tịch UBND xã (Văn xã)",
      subtitle: "Vũ Đức Anh phụ trách chuyên môn",
      color: "#27AE60",
      children: [
        { name: "Tư pháp – Hộ tịch", subtitle: "Phạm Thị Ngọc · 3 cán bộ", color: "#8E44AD" },
        { name: "Văn hoá – Xã hội", subtitle: "Vũ Đức Anh · 4 cán bộ", color: "#27AE60" },
        { name: "Trung tâm Phục vụ hành chính công", subtitle: "Ngô Thị Lan · 5 cán bộ", color: "#17A2A2" },
      ],
    },
  ],
};

/** Trạng thái tài khoản nội bộ */
export const USER_STATUS_ACTIVE = "Đang hoạt động";
export const USER_STATUS_LOCKED = "Tạm khoá";

/** Tài khoản người dùng nội bộ (9 tài khoản) */
export const internalUsers: InternalUser[] = [
  { name: "Nguyễn Văn Bình", initials: "NB", color: "#1B3A5C", department: "Văn phòng UBND", roleLabel: "Quản trị hệ thống", username: "binh.nv", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 07:42" },
  { name: "Trần Thị Hạnh", initials: "TH", color: "#E91E8C", department: "Văn phòng UBND", roleLabel: "Lãnh đạo phê duyệt", username: "hanh.tt", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 08:05" },
  { name: "Lê Minh Tuấn", initials: "LT", color: "#3B82C4", department: "Địa chính – Xây dựng", roleLabel: "Chuyên viên xử lý", username: "tuan.lm", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 07:58" },
  { name: "Phạm Thị Ngọc", initials: "PN", color: "#8E44AD", department: "Tư pháp – Hộ tịch", roleLabel: "Chuyên viên xử lý", username: "ngoc.pt", status: USER_STATUS_ACTIVE, lastLogin: "Hôm qua 16:30" },
  { name: "Vũ Đức Anh", initials: "VA", color: "#27AE60", department: "Văn hoá – Xã hội", roleLabel: "Chuyên viên xử lý", username: "anh.vd", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 08:12" },
  { name: "Đỗ Thanh Hà", initials: "ĐH", color: "#E67E22", department: "Tài chính – Kế toán", roleLabel: "Kế toán – giải ngân", username: "ha.dt", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 07:35" },
  { name: "Hoàng Văn Sơn", initials: "HS", color: "#17A2A2", department: "Công an xã", roleLabel: "Chuyên viên xử lý", username: "son.hv", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 06:50" },
  { name: "Ngô Thị Lan", initials: "NL", color: "#E74C3C", department: "Trung tâm Phục vụ hành chính công", roleLabel: "Tiếp nhận một cửa", username: "lan.nt", status: USER_STATUS_ACTIVE, lastLogin: "Hôm nay 07:20" },
  { name: "Bùi Quang Khải", initials: "BK", color: "#5B6C8F", department: "Quân sự xã", roleLabel: "Chuyên viên xử lý", username: "khai.bq", status: USER_STATUS_LOCKED, lastLogin: "12/08/2026 15:10" },
];
