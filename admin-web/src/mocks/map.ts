import type { MapLayer, MapPin } from "@/types";

/**
 * Dữ liệu mock phân hệ Bản đồ kinh tế số (port từ prototype MOCK_DATA.banDo).
 * Nguồn thật: API GIS / CSDL kinh tế số cấp xã.
 * Toạ độ ghim đang là % khung mô phỏng (x, y); provider thật sẽ dùng lat/lng.
 */

/** 8 lớp dữ liệu bản đồ */
export const mapLayers: MapLayer[] = [
  { id: "dn", label: "Doanh nghiệp", count: 247, color: "#3B82C4", defaultOn: true },
  { id: "hkd", label: "Hộ kinh doanh", count: 1812, color: "#E91E8C", defaultOn: true },
  { id: "cho", label: "Chợ", count: 3, color: "#E67E22", defaultOn: true },
  { id: "th", label: "Trường học", count: 11, color: "#8E44AD", defaultOn: true },
  { id: "yt", label: "Cơ sở y tế", count: 4, color: "#E74C3C", defaultOn: true },
  { id: "dt", label: "Di tích", count: 6, color: "#17A2A2", defaultOn: true },
  { id: "htcc", label: "Hạ tầng công cộng", count: 28, color: "#27AE60", defaultOn: true },
  { id: "dtc", label: "Công trình đầu tư công", count: 9, color: "#5B6C8F", defaultOn: true },
];

/** 22 ghim cơ sở kinh tế / hạ tầng trên bản đồ */
export const mapPins: MapPin[] = [
  { layerId: "dn", x: 30, y: 30, name: "Công ty TNHH May Đại Thắng", industry: "May mặc xuất khẩu", address: "Thôn Đông, Xã Đại Thắng", workers: 186, representative: "Nguyễn Văn Thịnh", phone: "024 3378 4412" },
  { layerId: "dn", x: 37, y: 22, name: "Công ty CP Cơ khí Phú Thành", industry: "Gia công cơ khí", address: "Thôn Trung, Xã Đại Thắng", workers: 64, representative: "Trần Quốc Toản", phone: "024 3378 5120" },
  { layerId: "dn", x: 63, y: 41, name: "Công ty TNHH Thực phẩm Hoà Bình", industry: "Chế biến nông sản", address: "Thôn Đoài, Xã Đại Thắng", workers: 42, representative: "Lê Thị Bình", phone: "024 3378 6033" },
  { layerId: "dn", x: 74, y: 64, name: "Công ty CP Thương mại Đại Việt", industry: "Bán buôn vật liệu xây dựng", address: "Tổ dân phố số 5, Xã Đại Thắng", workers: 28, representative: "Phạm Văn Kiên", phone: "024 3378 7715" },
  { layerId: "hkd", x: 29, y: 52, name: "Hộ kinh doanh Nguyễn Thị Lan", industry: "Tạp hoá tổng hợp", address: "Tổ dân phố số 1, Xã Đại Thắng", workers: 3, representative: "Nguyễn Thị Lan", phone: "098•••221" },
  { layerId: "hkd", x: 47, y: 57, name: "Hộ kinh doanh Trần Văn Hùng", industry: "Cơ khí, sửa chữa xe máy", address: "Thôn Đông, Xã Đại Thắng", workers: 5, representative: "Trần Văn Hùng", phone: "091•••554" },
  { layerId: "hkd", x: 56, y: 28, name: "Hộ kinh doanh Đỗ Thị Nhung", industry: "Chế biến bún, bánh", address: "Thôn Đoài, Xã Đại Thắng", workers: 7, representative: "Đỗ Thị Nhung", phone: "094•••108" },
  { layerId: "hkd", x: 18, y: 68, name: "Hộ kinh doanh Vũ Đình Nam", industry: "Ăn uống, giải khát", address: "Tổ dân phố số 3, Xã Đại Thắng", workers: 6, representative: "Vũ Đình Nam", phone: "097•••390" },
  { layerId: "cho", x: 42, y: 44, name: "Chợ Đại Thắng", industry: "Chợ hạng 3, 214 điểm kinh doanh", address: "Tổ dân phố số 1, Xã Đại Thắng", workers: 214, representative: "Ban Quản lý chợ", phone: "024 3378 2200" },
  { layerId: "cho", x: 69, y: 26, name: "Chợ đầu mối nông sản Thôn Đoài", industry: "Chợ nông sản, họp buổi sáng", address: "Thôn Đoài, Xã Đại Thắng", workers: 86, representative: "Hợp tác xã Đại Thắng", phone: "024 3378 2318" },
  { layerId: "th", x: 33, y: 38, name: "Trường Tiểu học Đại Thắng", industry: "Giáo dục tiểu học · 642 học sinh", address: "Thôn Trung, Xã Đại Thắng", workers: 38, representative: "Hiệu trưởng Nguyễn Thị Thu", phone: "024 3378 3010" },
  { layerId: "th", x: 52, y: 70, name: "Trường Trung học cơ sở Đại Thắng", industry: "Giáo dục trung học cơ sở · 518 học sinh", address: "Thôn Đông, Xã Đại Thắng", workers: 34, representative: "Hiệu trưởng Lê Văn Quang", phone: "024 3378 3125" },
  { layerId: "yt", x: 45, y: 34, name: "Trạm Y tế xã Đại Thắng", industry: "Y tế cơ sở · 8 giường bệnh", address: "Tổ dân phố số 2, Xã Đại Thắng", workers: 9, representative: "Trạm trưởng Bùi Thị Hương", phone: "024 3378 4001" },
  { layerId: "yt", x: 69, y: 48, name: "Phòng khám đa khoa Thành An", industry: "Khám chữa bệnh ngoài công lập", address: "Tổ dân phố số 5, Xã Đại Thắng", workers: 12, representative: "Bác sĩ Trần Thành An", phone: "024 3378 4188" },
  { layerId: "dt", x: 25, y: 20, name: "Đình làng Thôn Đông", industry: "Di tích lịch sử cấp Thành phố", address: "Thôn Đông, Xã Đại Thắng", workers: 2, representative: "Ban Khánh tiết", phone: "098•••640" },
  { layerId: "dt", x: 61, y: 76, name: "Chùa Đại Thắng", industry: "Di tích kiến trúc nghệ thuật", address: "Thôn Trung, Xã Đại Thắng", workers: 3, representative: "Ban Trị sự", phone: "091•••702" },
  { layerId: "htcc", x: 39, y: 62, name: "Nhà văn hoá Thôn Trung", industry: "Thiết chế văn hoá cơ sở · 180 chỗ", address: "Thôn Trung, Xã Đại Thắng", workers: 2, representative: "Trưởng thôn Đặng Văn Tú", phone: "090•••415" },
  { layerId: "htcc", x: 66, y: 55, name: "Sân thể thao Thôn Đoài", industry: "Hạ tầng thể dục thể thao", address: "Thôn Đoài, Xã Đại Thắng", workers: 1, representative: "Trưởng thôn Ngô Văn Hải", phone: "093•••228" },
  { layerId: "htcc", x: 9, y: 64, name: "Điểm tập kết rác Thôn Đông", industry: "Hạ tầng môi trường", address: "Thôn Đông, Xã Đại Thắng", workers: 4, representative: "Hợp tác xã Môi trường", phone: "094•••860" },
  { layerId: "dtc", x: 50, y: 48, name: "Công trình Nhà văn hoá xã", industry: "Đầu tư công · Kế hoạch 4,2 tỷ đồng", address: "Tổ dân phố số 2, Xã Đại Thắng", workers: 0, representative: "Phụ trách: Đỗ Thanh Hà", phone: "024 3378 2001" },
  { layerId: "dtc", x: 31, y: 72, name: "Đường giao thông Thôn Đông", industry: "Đầu tư công · Kế hoạch 3,7 tỷ đồng", address: "Thôn Đông, Xã Đại Thắng", workers: 0, representative: "Phụ trách: Lê Minh Tuấn", phone: "024 3378 2002" },
  { layerId: "dtc", x: 88, y: 68, name: "Kênh mương nội đồng Thôn Đoài", industry: "Đầu tư công · Kế hoạch 1,0 tỷ đồng", address: "Thôn Đoài, Xã Đại Thắng", workers: 0, representative: "Phụ trách: Đỗ Thanh Hà", phone: "024 3378 2003" },
];

/** Một lát cắt cơ cấu kinh tế theo ngành (pie chart) */
export interface IndustryShare {
  label: string;
  percent: number;
  color: string;
}

/** Cơ cấu doanh nghiệp theo ngành nghề (%) */
export const industryStructure: IndustryShare[] = [
  { label: "Thương mại – dịch vụ", percent: 38, color: "#3B82C4" },
  { label: "Công nghiệp – xây dựng", percent: 27, color: "#E91E8C" },
  { label: "Chế biến nông sản", percent: 18, color: "#27AE60" },
  { label: "Vận tải – kho bãi", percent: 11, color: "#E67E22" },
  { label: "Lĩnh vực khác", percent: 6, color: "#8E44AD" },
];

/** Một chỉ số tổng hợp kinh tế trên panel phân tích */
export interface EconomySummaryItem {
  value: string;
  label: string;
}

/** 4 chỉ số tổng hợp kinh tế toàn xã */
export const economySummary: EconomySummaryItem[] = [
  { value: "2.059", label: "Cơ sở kinh tế" },
  { value: "6.412", label: "Lao động" },
  { value: "94,7 tỷ", label: "Doanh thu ước năm" },
  { value: "12,4 tỷ", label: "Nộp ngân sách" },
];
