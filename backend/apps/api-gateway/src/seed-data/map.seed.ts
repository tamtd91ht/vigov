/**
 * Dữ liệu seed phân hệ Bản đồ kinh tế số (WBS #7)
 * — port từ admin-web/src/mocks/map.ts (8 lớp dữ liệu, 22 ghim).
 *
 * Khoá tự nhiên khi upsert: lớp theo `key`, ghim theo `name`.
 * Toạ độ x/y là phần trăm trong khung bản đồ mô phỏng; lat/lng sinh tất định
 * từ x/y qua pinToLatLng() để adapter bản đồ thật dùng được ngay.
 */
import { pinToLatLng, unmaskPhone } from './seed.util';

/** Một lớp dữ liệu bật/tắt trên bản đồ */
export interface MapLayerSeed {
  key: string;
  label: string;
  color: string;
  defaultOn: boolean;
  order: number;
}

/** Một ghim cơ sở kinh tế / hạ tầng */
export interface MapPinSeed {
  layerKey: string;
  name: string;
  industry: string;
  address: string;
  workers: number;
  representative: string;
  phone: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export const MAP_LAYER_SEED: MapLayerSeed[] = [
  { key: 'dn', label: 'Doanh nghiệp', color: '#3B82C4', defaultOn: true, order: 1 },
  { key: 'hkd', label: 'Hộ kinh doanh', color: '#E91E8C', defaultOn: true, order: 2 },
  { key: 'cho', label: 'Chợ', color: '#E67E22', defaultOn: true, order: 3 },
  { key: 'th', label: 'Trường học', color: '#8E44AD', defaultOn: true, order: 4 },
  { key: 'yt', label: 'Cơ sở y tế', color: '#E74C3C', defaultOn: true, order: 5 },
  { key: 'dt', label: 'Di tích', color: '#17A2A2', defaultOn: true, order: 6 },
  { key: 'htcc', label: 'Hạ tầng công cộng', color: '#27AE60', defaultOn: true, order: 7 },
  { key: 'dtc', label: 'Công trình đầu tư công', color: '#5B6C8F', defaultOn: true, order: 8 },
];

/** Ghim gốc (chưa có lat/lng) — lat/lng được bổ sung bên dưới */
const RAW_PINS: Omit<MapPinSeed, 'lat' | 'lng'>[] = [
  {
    layerKey: 'dn',
    x: 30,
    y: 30,
    name: 'Công ty TNHH May Đại Thắng',
    industry: 'May mặc xuất khẩu',
    address: 'Thôn Đông, Xã Đại Thắng',
    workers: 186,
    representative: 'Nguyễn Văn Thịnh',
    phone: '024 3378 4412',
  },
  {
    layerKey: 'dn',
    x: 37,
    y: 22,
    name: 'Công ty CP Cơ khí Phú Thành',
    industry: 'Gia công cơ khí',
    address: 'Thôn Trung, Xã Đại Thắng',
    workers: 64,
    representative: 'Trần Quốc Toản',
    phone: '024 3378 5120',
  },
  {
    layerKey: 'dn',
    x: 63,
    y: 41,
    name: 'Công ty TNHH Thực phẩm Hoà Bình',
    industry: 'Chế biến nông sản',
    address: 'Thôn Đoài, Xã Đại Thắng',
    workers: 42,
    representative: 'Lê Thị Bình',
    phone: '024 3378 6033',
  },
  {
    layerKey: 'dn',
    x: 74,
    y: 64,
    name: 'Công ty CP Thương mại Đại Việt',
    industry: 'Bán buôn vật liệu xây dựng',
    address: 'Tổ dân phố số 5, Xã Đại Thắng',
    workers: 28,
    representative: 'Phạm Văn Kiên',
    phone: '024 3378 7715',
  },
  {
    layerKey: 'hkd',
    x: 29,
    y: 52,
    name: 'Hộ kinh doanh Nguyễn Thị Lan',
    industry: 'Tạp hoá tổng hợp',
    address: 'Tổ dân phố số 1, Xã Đại Thắng',
    workers: 3,
    representative: 'Nguyễn Thị Lan',
    phone: unmaskPhone('098•••221'),
  },
  {
    layerKey: 'hkd',
    x: 47,
    y: 57,
    name: 'Hộ kinh doanh Trần Văn Hùng',
    industry: 'Cơ khí, sửa chữa xe máy',
    address: 'Thôn Đông, Xã Đại Thắng',
    workers: 5,
    representative: 'Trần Văn Hùng',
    phone: unmaskPhone('091•••554'),
  },
  {
    layerKey: 'hkd',
    x: 56,
    y: 28,
    name: 'Hộ kinh doanh Đỗ Thị Nhung',
    industry: 'Chế biến bún, bánh',
    address: 'Thôn Đoài, Xã Đại Thắng',
    workers: 7,
    representative: 'Đỗ Thị Nhung',
    phone: unmaskPhone('094•••108'),
  },
  {
    layerKey: 'hkd',
    x: 18,
    y: 68,
    name: 'Hộ kinh doanh Vũ Đình Nam',
    industry: 'Ăn uống, giải khát',
    address: 'Tổ dân phố số 3, Xã Đại Thắng',
    workers: 6,
    representative: 'Vũ Đình Nam',
    phone: unmaskPhone('097•••390'),
  },
  {
    layerKey: 'cho',
    x: 42,
    y: 44,
    name: 'Chợ Đại Thắng',
    industry: 'Chợ hạng 3, 214 điểm kinh doanh',
    address: 'Tổ dân phố số 1, Xã Đại Thắng',
    workers: 214,
    representative: 'Ban Quản lý chợ',
    phone: '024 3378 2200',
  },
  {
    layerKey: 'cho',
    x: 69,
    y: 26,
    name: 'Chợ đầu mối nông sản Thôn Đoài',
    industry: 'Chợ nông sản, họp buổi sáng',
    address: 'Thôn Đoài, Xã Đại Thắng',
    workers: 86,
    representative: 'Hợp tác xã Đại Thắng',
    phone: '024 3378 2318',
  },
  {
    layerKey: 'th',
    x: 33,
    y: 38,
    name: 'Trường Tiểu học Đại Thắng',
    industry: 'Giáo dục tiểu học · 642 học sinh',
    address: 'Thôn Trung, Xã Đại Thắng',
    workers: 38,
    representative: 'Hiệu trưởng Nguyễn Thị Thu',
    phone: '024 3378 3010',
  },
  {
    layerKey: 'th',
    x: 52,
    y: 70,
    name: 'Trường Trung học cơ sở Đại Thắng',
    industry: 'Giáo dục trung học cơ sở · 518 học sinh',
    address: 'Thôn Đông, Xã Đại Thắng',
    workers: 34,
    representative: 'Hiệu trưởng Lê Văn Quang',
    phone: '024 3378 3125',
  },
  {
    layerKey: 'yt',
    x: 45,
    y: 34,
    name: 'Trạm Y tế xã Đại Thắng',
    industry: 'Y tế cơ sở · 8 giường bệnh',
    address: 'Tổ dân phố số 2, Xã Đại Thắng',
    workers: 9,
    representative: 'Trạm trưởng Bùi Thị Hương',
    phone: '024 3378 4001',
  },
  {
    layerKey: 'yt',
    x: 69,
    y: 48,
    name: 'Phòng khám đa khoa Thành An',
    industry: 'Khám chữa bệnh ngoài công lập',
    address: 'Tổ dân phố số 5, Xã Đại Thắng',
    workers: 12,
    representative: 'Bác sĩ Trần Thành An',
    phone: '024 3378 4188',
  },
  {
    layerKey: 'dt',
    x: 25,
    y: 20,
    name: 'Đình làng Thôn Đông',
    industry: 'Di tích lịch sử cấp Thành phố',
    address: 'Thôn Đông, Xã Đại Thắng',
    workers: 2,
    representative: 'Ban Khánh tiết',
    phone: unmaskPhone('098•••640'),
  },
  {
    layerKey: 'dt',
    x: 61,
    y: 76,
    name: 'Chùa Đại Thắng',
    industry: 'Di tích kiến trúc nghệ thuật',
    address: 'Thôn Trung, Xã Đại Thắng',
    workers: 3,
    representative: 'Ban Trị sự',
    phone: unmaskPhone('091•••702'),
  },
  {
    layerKey: 'htcc',
    x: 39,
    y: 62,
    name: 'Nhà văn hoá Thôn Trung',
    industry: 'Thiết chế văn hoá cơ sở · 180 chỗ',
    address: 'Thôn Trung, Xã Đại Thắng',
    workers: 2,
    representative: 'Trưởng thôn Đặng Văn Tú',
    phone: unmaskPhone('090•••415'),
  },
  {
    layerKey: 'htcc',
    x: 66,
    y: 55,
    name: 'Sân thể thao Thôn Đoài',
    industry: 'Hạ tầng thể dục thể thao',
    address: 'Thôn Đoài, Xã Đại Thắng',
    workers: 1,
    representative: 'Trưởng thôn Ngô Văn Hải',
    phone: unmaskPhone('093•••228'),
  },
  {
    layerKey: 'htcc',
    x: 9,
    y: 64,
    name: 'Điểm tập kết rác Thôn Đông',
    industry: 'Hạ tầng môi trường',
    address: 'Thôn Đông, Xã Đại Thắng',
    workers: 4,
    representative: 'Hợp tác xã Môi trường',
    phone: unmaskPhone('094•••860'),
  },
  {
    layerKey: 'dtc',
    x: 50,
    y: 48,
    name: 'Công trình Nhà văn hoá xã',
    industry: 'Đầu tư công · Kế hoạch 4,2 tỷ đồng',
    address: 'Tổ dân phố số 2, Xã Đại Thắng',
    workers: 0,
    representative: 'Phụ trách: Đỗ Thanh Hà',
    phone: '024 3378 2001',
  },
  {
    layerKey: 'dtc',
    x: 31,
    y: 72,
    name: 'Đường giao thông Thôn Đông',
    industry: 'Đầu tư công · Kế hoạch 3,7 tỷ đồng',
    address: 'Thôn Đông, Xã Đại Thắng',
    workers: 0,
    representative: 'Phụ trách: Lê Minh Tuấn',
    phone: '024 3378 2002',
  },
  {
    layerKey: 'dtc',
    x: 88,
    y: 68,
    name: 'Kênh mương nội đồng Thôn Đoài',
    industry: 'Đầu tư công · Kế hoạch 1,0 tỷ đồng',
    address: 'Thôn Đoài, Xã Đại Thắng',
    workers: 0,
    representative: 'Phụ trách: Đỗ Thanh Hà',
    phone: '024 3378 2003',
  },
];

export const MAP_PIN_SEED: MapPinSeed[] = RAW_PINS.map((pin) => ({ ...pin, ...pinToLatLng(pin) }));
