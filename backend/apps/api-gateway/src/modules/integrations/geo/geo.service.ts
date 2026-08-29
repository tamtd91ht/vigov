import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockGeoProvider, type GeoPoint, type GeoProvider } from './geo.provider';

/** Nhà cung cấp GIS đã tích hợp — Phase 1 mới chỉ có bản giả lập */
const SUPPORTED_PROVIDERS = ['mock'] as const;
const DEFAULT_PROVIDER = 'mock';

/** Giới hạn toạ độ hợp lệ */
const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/** Độ dài tối đa của chuỗi địa chỉ nhận từ client */
const MAX_ADDRESS_LENGTH = 300;

/**
 * Dịch vụ bản đồ / geocoding dùng chung (WBS #26 — task P3-26).
 * Chọn provider theo cấu hình `geo.provider`; module Feedback và app công dân
 * chỉ gọi geocode()/reverse().
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mockProvider: MockGeoProvider,
  ) {}

  /** Địa chỉ → toạ độ (dùng khi cán bộ nhập địa chỉ phản ánh bằng tay) */
  async geocode(address: string): Promise<GeoPoint | null> {
    const query = (address ?? '').trim();
    if (!query) {
      throw new BadRequestException('Vui lòng nhập địa chỉ cần tra cứu');
    }
    if (query.length > MAX_ADDRESS_LENGTH) {
      throw new BadRequestException(`Địa chỉ tối đa ${MAX_ADDRESS_LENGTH} ký tự`);
    }

    const provider = this.resolveProvider();
    this.logger.log(`Geocoding "${query}" bằng provider "${this.providerName}"`);
    return provider.geocode(query);
  }

  /** Toạ độ → địa chỉ (app công dân ghim vị trí khi gửi phản ánh) */
  async reverse(lat: number, lng: number): Promise<string | null> {
    this.assertCoordinates(lat, lng);
    const provider = this.resolveProvider();
    this.logger.log(`Reverse geocoding (${lat}, ${lng}) bằng provider "${this.providerName}"`);
    return provider.reverse(lat, lng);
  }

  private get providerName(): string {
    return (this.config.get<string>('geo.provider') ?? DEFAULT_PROVIDER).trim().toLowerCase();
  }

  /** Kiểm tra toạ độ nằm trong miền hợp lệ */
  private assertCoordinates(lat: number, lng: number): void {
    if (!Number.isFinite(lat) || lat < LAT_MIN || lat > LAT_MAX) {
      throw new BadRequestException('Vĩ độ (lat) không hợp lệ');
    }
    if (!Number.isFinite(lng) || lng < LNG_MIN || lng > LNG_MAX) {
      throw new BadRequestException('Kinh độ (lng) không hợp lệ');
    }
  }

  /**
   * Ánh xạ tên cấu hình sang lớp provider.
   * Provider thật chờ khách chốt (câu hỏi mở #2: VietMap / Goong / MapLibre —
   * Google Maps bị loại vì không có giấy phép tại Việt Nam). Khách tự đăng ký
   * tài khoản và cung cấp GEO_API_KEY, khi đó bổ sung nhánh tương ứng tại đây.
   */
  private resolveProvider(): GeoProvider {
    const name = this.providerName;
    if (name === 'mock') return this.mockProvider;

    throw new ServiceUnavailableException(
      `Chưa tích hợp provider bản đồ: ${name}. Hiện chỉ hỗ trợ: ${SUPPORTED_PROVIDERS.join(', ')}.`,
    );
  }
}
