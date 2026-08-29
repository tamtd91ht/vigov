/**
 * Dữ liệu mock phân hệ Báo cáo — port từ MOCK_DATA.baoCao (vigov-prototype.html).
 * Nguồn thật: API dịch vụ báo cáo (P3). Tên bộ phận đồng bộ với `departments` ở @/mocks/directory.
 */

/** Số nhiệm vụ theo bộ phận (biểu đồ thanh ngang) */
export interface DeptTaskStat {
  /** Tên bộ phận (khớp departments trong @/mocks/directory) */
  name: string;
  /** Số nhiệm vụ trong kỳ */
  count: number;
  /** Màu nhận diện bộ phận — CSS variable toàn cục */
  color: string;
}

/** Chuỗi tỷ lệ xử lý đúng hạn theo tháng (%, so sánh 2 năm) */
export interface OnTimeSeries {
  /** Nhãn tháng: T3…T8 */
  months: string[];
  /** Tỷ lệ đúng hạn năm 2026 (%) */
  year2026: number[];
  /** Tỷ lệ đúng hạn cùng kỳ năm 2025 (%) */
  year2025: number[];
}

/** Số lượt phản ánh theo lĩnh vực (màu lấy từ findCategory — không hardcode) */
export interface CategoryStat {
  /** Nhãn lĩnh vực (khớp label trong feedbackCategories) */
  name: string;
  /** Số lượt phản ánh */
  count: number;
}

/** Giải ngân theo nguồn vốn (đơn vị: tỷ đồng) */
export interface FundingStat {
  /** Tên đầy đủ nguồn vốn */
  name: string;
  /** Nhãn rút gọn hiển thị dưới cột */
  shortName: string;
  /** Kế hoạch giao (tỷ đồng) */
  planned: number;
  /** Đã giải ngân thực tế (tỷ đồng) */
  actual: number;
}

/** Xếp hạng bộ phận theo tỷ lệ xử lý đúng hạn */
export interface DeptRanking {
  /** Tên bộ phận */
  department: string;
  /** Tổng nhiệm vụ */
  total: number;
  /** Số việc đúng hạn */
  onTime: number;
  /** Số việc trễ hạn */
  late: number;
  /** Thời gian xử lý trung bình (đã định dạng) */
  avgTime: string;
}

export const deptTaskStats: DeptTaskStat[] = [
  { name: "Văn phòng UBND", count: 48, color: "var(--navy)" },
  { name: "Địa chính – Xây dựng", count: 42, color: "var(--blue)" },
  { name: "Văn hoá – Xã hội", count: 31, color: "var(--green)" },
  { name: "Tư pháp – Hộ tịch", count: 27, color: "var(--purple)" },
  { name: "Tài chính – Kế toán", count: 24, color: "var(--orange)" },
  { name: "Trung tâm Phục vụ hành chính công", count: 22, color: "var(--teal)" },
  { name: "Công an xã", count: 19, color: "var(--red)" },
  { name: "Quân sự xã", count: 11, color: "var(--pink)" },
];

export const onTimeSeries: OnTimeSeries = {
  months: ["T3", "T4", "T5", "T6", "T7", "T8"],
  year2026: [78, 81, 84, 83, 86, 87],
  year2025: [71, 74, 73, 77, 79, 80],
};

export const feedbackCategoryStats: CategoryStat[] = [
  { name: "Rác thải", count: 74 },
  { name: "Giao thông", count: 61 },
  { name: "Vệ sinh môi trường", count: 52 },
  { name: "Trật tự đô thị", count: 43 },
  { name: "An ninh", count: 31 },
  { name: "Xây dựng", count: 26 },
  { name: "Cán bộ", count: 14 },
  { name: "Khác", count: 11 },
];

export const fundingStats: FundingStat[] = [
  { name: "Ngân sách xã", shortName: "NS xã", planned: 4.9, actual: 4.3 },
  { name: "Ngân sách huyện", shortName: "NS huyện", planned: 4.2, actual: 1.1 },
  { name: "Chương trình mục tiêu quốc gia", shortName: "CTMT quốc gia", planned: 2.4, actual: 2.1 },
  { name: "Vốn sự nghiệp nông nghiệp", shortName: "Vốn SN nông nghiệp", planned: 1.0, actual: 0.2 },
];

export const deptRankings: DeptRanking[] = [
  { department: "Văn phòng UBND", total: 48, onTime: 45, late: 3, avgTime: "1,8 ngày" },
  { department: "Trung tâm Phục vụ hành chính công", total: 22, onTime: 21, late: 1, avgTime: "0,9 ngày" },
  { department: "Tư pháp – Hộ tịch", total: 27, onTime: 25, late: 2, avgTime: "1,4 ngày" },
  { department: "Công an xã", total: 19, onTime: 17, late: 2, avgTime: "2,1 ngày" },
  { department: "Văn hoá – Xã hội", total: 31, onTime: 27, late: 4, avgTime: "2,6 ngày" },
  { department: "Tài chính – Kế toán", total: 24, onTime: 20, late: 4, avgTime: "3,2 ngày" },
  { department: "Địa chính – Xây dựng", total: 42, onTime: 34, late: 8, avgTime: "4,1 ngày" },
  { department: "Quân sự xã", total: 11, onTime: 9, late: 2, avgTime: "2,4 ngày" },
];
