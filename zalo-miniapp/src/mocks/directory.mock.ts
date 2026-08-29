import type { GovContact } from "@/types";

/**
 * Danh bạ chính quyền mẫu — port từ app Flutter (mocks/directory_mock.dart),
 * đồng bộ danh bạ cán bộ của Web Quản trị.
 * Nguồn thật: API danh bạ (P3).
 */
export const mockGovContacts: GovContact[] = [
  // ── Lãnh đạo UBND xã ────────────────────────────────────────────────
  {
    name: "Nguyễn Văn Bình",
    title: "Chủ tịch UBND xã",
    department: "UBND xã",
    phone: "024 3378 2001",
    group: "leader",
  },
  {
    name: "Trần Thị Hạnh",
    title: "Phó Chủ tịch UBND xã",
    department: "UBND xã",
    phone: "024 3378 2002",
    group: "leader",
  },

  // ── Bộ phận chuyên môn ──────────────────────────────────────────────
  {
    name: "Trần Thị Hạnh",
    title: "Phó Chủ tịch UBND xã · phụ trách",
    department: "Văn phòng UBND",
    phone: "024 3378 4001",
    group: "department",
  },
  {
    name: "Lê Minh Tuấn",
    title: "Công chức Địa chính – Xây dựng",
    department: "Địa chính – Xây dựng",
    phone: "024 3378 4002",
    group: "department",
  },
  {
    name: "Phạm Thị Ngọc",
    title: "Công chức Tư pháp – Hộ tịch",
    department: "Tư pháp – Hộ tịch",
    phone: "024 3378 4003",
    group: "department",
  },
  {
    name: "Vũ Đức Anh",
    title: "Công chức Văn hoá – Xã hội",
    department: "Văn hoá – Xã hội",
    phone: "024 3378 4004",
    group: "department",
  },
  {
    name: "Đỗ Thanh Hà",
    title: "Công chức Tài chính – Kế toán",
    department: "Tài chính – Kế toán",
    phone: "024 3378 4005",
    group: "department",
  },
  {
    name: "Ngô Thị Lan",
    title: "Giám đốc Trung tâm",
    department: "Trung tâm Phục vụ hành chính công",
    phone: "024 3378 4006",
    group: "department",
  },
  {
    name: "Hoàng Văn Sơn",
    title: "Trưởng Công an xã",
    department: "Công an xã",
    phone: "024 3378 4007",
    group: "department",
  },
  {
    name: "Bùi Quang Khải",
    title: "Chỉ huy trưởng Quân sự xã",
    department: "Quân sự xã",
    phone: "024 3378 4008",
    group: "department",
  },
];
