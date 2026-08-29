import { Injectable } from '@nestjs/common';

/**
 * Hợp đồng provider bản đồ / geocoding (WBS #26 — task P3-26).
 * Mọi nhà cung cấp (VietMap, Goong, MapLibre + Nominatim...) đều bọc lại theo
 * interface này để module Feedback và app công dân không phụ thuộc nhà cung cấp.
 */

/** Một điểm toạ độ kèm địa chỉ đọc được */
export interface GeoPoint {
  lat: number;
  lng: number;
  address: string;
}

export interface GeoProvider {
  /** Địa chỉ → toạ độ; không tìm thấy thì trả null */
  geocode(address: string): Promise<GeoPoint | null>;
  /** Toạ độ → địa chỉ; không tìm thấy thì trả null */
  reverse(lat: number, lng: number): Promise<string | null>;
}

/** Token DI cho provider GIS đang được chọn */
export const GEO_PROVIDER = 'VIGOV_GEO_PROVIDER';

/** Tâm xã Đại Thắng — mốc để bản mock sinh toạ độ mẫu */
export const DAI_THANG_CENTER: Readonly<{ lat: number; lng: number }> = { lat: 20.74, lng: 105.92 };

/** Bán kính giả lập quanh tâm xã (độ) — xấp xỉ 1.1km */
const MOCK_RADIUS_DEG = 0.01;

/** Số chữ số thập phân của toạ độ giả lập (~1m) */
const MOCK_COORD_PRECISION = 5;

/** Đơn vị hành chính cấp trên dùng trong địa chỉ giả lập */
const MOCK_ADMIN_SUFFIX = 'xã Đại Thắng, thành phố Hà Nội';

/** Các thôn/khu dân cư mẫu của xã — dùng dựng địa chỉ mô phỏng */
const MOCK_HAMLETS = [
  'Thôn Phú Nhiêu',
  'Thôn Kim Long',
  'Thôn Đại Nghiệp',
  'Thôn Tạ Xá',
  'Khu dân cư Chợ Trung',
] as const;

/** Các tuyến đường mẫu — ghép với số nhà cho địa chỉ chi tiết hơn */
const MOCK_ROADS = ['Đường Tỉnh lộ 428', 'Đường liên thôn', 'Đường đê Sông Nhuệ'] as const;

/**
 * Provider GIS giả lập dùng cho Phase 1.
 *
 * LƯU Ý: provider bản đồ THẬT đang CHỜ KHÁCH CHỐT (câu hỏi mở #2) — ứng viên là
 * VietMap, Goong hoặc MapLibre + nguồn nền mở; Google Maps BỊ LOẠI vì không có
 * giấy phép cung cấp dịch vụ bản đồ tại Việt Nam. Khách hàng tự đăng ký tài
 * khoản/API key với nhà cung cấp, hệ thống chỉ đọc qua ConfigService
 * (`geo.provider`, `geo.apiKey`). Khi có nhà cung cấp chính thức, bổ sung một
 * lớp implements GeoProvider tương tự và đăng ký trong GeoService.
 */
@Injectable()
export class MockGeoProvider implements GeoProvider {
  async geocode(address: string): Promise<GeoPoint | null> {
    const query = address.trim();
    if (!query) return null;

    // Sinh toạ độ ổn định theo chuỗi địa chỉ để gọi lại nhiều lần cho kết quả giống nhau
    const seed = hashCode(query);
    const lat = round(DAI_THANG_CENTER.lat + offset(seed), MOCK_COORD_PRECISION);
    const lng = round(DAI_THANG_CENTER.lng + offset(seed >> 3), MOCK_COORD_PRECISION);
    return { lat, lng, address: `${query} (${MOCK_ADMIN_SUFFIX})` };
  }

  async reverse(lat: number, lng: number): Promise<string | null> {
    const seed = hashCode(`${round(lat, MOCK_COORD_PRECISION)},${round(lng, MOCK_COORD_PRECISION)}`);
    const hamlet = MOCK_HAMLETS[seed % MOCK_HAMLETS.length];
    const road = MOCK_ROADS[seed % MOCK_ROADS.length];
    const houseNo = (seed % 200) + 1;
    return `Số ${houseNo}, ${road}, ${hamlet}, ${MOCK_ADMIN_SUFFIX}`;
  }
}

/** Băm chuỗi thành số nguyên dương — chỉ dùng để sinh dữ liệu giả lập ổn định */
function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash);
}

/** Quy seed về độ lệch trong khoảng [-MOCK_RADIUS_DEG, +MOCK_RADIUS_DEG] */
function offset(seed: number): number {
  const steps = 2000;
  return ((Math.abs(seed) % (steps + 1)) / steps) * 2 * MOCK_RADIUS_DEG - MOCK_RADIUS_DEG;
}

/** Làm tròn tới n chữ số thập phân */
function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
