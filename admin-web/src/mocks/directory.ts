import type { Staff } from "@/types";

/** Danh sách bộ phận chuyên môn — sẽ lấy từ API cấu hình tổ chức */
export const departments: string[] = [
  "Văn phòng UBND",
  "Địa chính – Xây dựng",
  "Tư pháp – Hộ tịch",
  "Văn hoá – Xã hội",
  "Tài chính – Kế toán",
  "Trung tâm Phục vụ hành chính công",
  "Công an xã",
  "Quân sự xã",
];

/** Danh bạ cán bộ (mock — nguồn thật: API tổ chức) */
export const staffDirectory: Staff[] = [
  { name: "Nguyễn Văn Bình", initials: "NB", color: "#1B3A5C", department: "Văn phòng UBND", title: "Chủ tịch UBND" },
  { name: "Trần Thị Hạnh", initials: "TH", color: "#E91E8C", department: "Văn phòng UBND", title: "Phó Chủ tịch UBND" },
  { name: "Lê Minh Tuấn", initials: "LT", color: "#3B82C4", department: "Địa chính – Xây dựng", title: "Công chức Địa chính" },
  { name: "Phạm Thị Ngọc", initials: "PN", color: "#8E44AD", department: "Tư pháp – Hộ tịch", title: "Công chức Tư pháp" },
  { name: "Vũ Đức Anh", initials: "VA", color: "#27AE60", department: "Văn hoá – Xã hội", title: "Công chức Văn hoá" },
  { name: "Đỗ Thanh Hà", initials: "ĐH", color: "#E67E22", department: "Tài chính – Kế toán", title: "Kế toán trưởng" },
  { name: "Hoàng Văn Sơn", initials: "HS", color: "#17A2A2", department: "Công an xã", title: "Trưởng Công an xã" },
  { name: "Ngô Thị Lan", initials: "NL", color: "#E74C3C", department: "Trung tâm Phục vụ hành chính công", title: "Chuyên viên tiếp nhận" },
  { name: "Bùi Quang Khải", initials: "BK", color: "#5B6C8F", department: "Quân sự xã", title: "Chỉ huy trưởng" },
];

const FALLBACK_COLOR = "#8896A6";

export function findStaff(name: string): Staff | undefined {
  return staffDirectory.find((s) => s.name === name);
}

export function staffColor(name: string): string {
  return findStaff(name)?.color ?? FALLBACK_COLOR;
}

/** Số đếm badge sidebar (mock — nguồn thật: API thống kê) */
export const navBadges: Record<string, number> = {
  tasks: 124,
  documents: 31,
  feedback: 41,
};

/** Số thông báo chưa đọc (mock) */
export const unreadNotifications = 5;
