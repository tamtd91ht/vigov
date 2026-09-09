import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { callZaloMeInfo } from '@vigov/shared';
import { GeoService } from './geo.service';

/** Kết quả đổi mã vị trí Zalo — toạ độ luôn có, địa chỉ thì tuỳ provider GIS */
export interface ResolvedZaloLocation {
  lat: number;
  lng: number;
  /** Địa chỉ đọc được, null khi provider không tra được */
  address: string | null;
  /**
   * Provider GIS đã sinh ra `address`. Mini App PHẢI xem trường này: provider
   * "mock" bịa địa chỉ từ toạ độ (xem MockGeoProvider), mà một địa chỉ bịa gắn
   * lên toạ độ thật thì công dân đọc tưởng là thật và gửi phiếu sai địa chỉ.
   * Chừng nào chưa chốt nhà cung cấp bản đồ (câu hỏi mở #2) thì chỉ hiện toạ
   * độ + bản đồ, để người dân tự gõ địa chỉ.
   */
  addressProvider: string;
}

/**
 * Đổi mã định vị của Zalo lấy toạ độ thật (P3-26).
 *
 * VÌ SAO PHẢI QUA MÁY CHỦ: `getLocation()` của zmp-sdk KHÔNG trả toạ độ, chỉ
 * trả một mã dùng một lần. Toạ độ chỉ lấy được bằng cách gọi Zalo kèm
 * ZALO_APP_SECRET — thứ không được phép có trong bundle Mini App, vì bundle
 * nằm trên máy người dùng. Nên đây là việc của backend, không phải của client.
 *
 * Mã hết hạn sau 2 phút và dùng được một lần: gọi lại với cùng mã sẽ thất bại,
 * Mini App phải xin mã mới chứ không được thử lại mã cũ.
 */
@Injectable()
export class ZaloLocationService {
  private readonly logger = new Logger(ZaloLocationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly geo: GeoService,
  ) {}

  async resolve(token: string, accessToken: string): Promise<ResolvedZaloLocation> {
    const secret = this.config.get<string>('zalo.appSecret', '');
    const { data, error } = await callZaloMeInfo(token, accessToken, secret, this.logger);
    if (error) {
      /* 503 chứ không 400: lỗi nằm ở phía Zalo hoặc ở cấu hình máy chủ, không
         phải người dùng gửi sai. Mini App đọc thông điệp này để nói thật vì sao
         không định vị được, thay vì báo "bạn đã từ chối". */
      throw new ServiceUnavailableException(error);
    }

    const lat = Number(data?.latitude);
    const lng = Number(data?.longitude);
    // Zalo trả toạ độ dạng CHUỖI; chuỗi rỗng ép sang Number thành 0, mà 0,0 là
    // một điểm giữa Đại Tây Dương — phải loại bằng kiểm tra hữu hạn + khác 0.
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      throw new ServiceUnavailableException('Zalo không trả toạ độ cho mã định vị này');
    }

    const addressProvider = this.geo.providerName;
    let address: string | null = null;
    try {
      address = await this.geo.reverse(lat, lng);
    } catch (err) {
      // Tra địa chỉ hỏng KHÔNG được làm mất toạ độ: có toạ độ là đã vẽ được bản
      // đồ và cán bộ đã tới đúng nơi, địa chỉ chữ chỉ là tiện thêm.
      this.logger.warn(`Không tra được địa chỉ cho (${lat}, ${lng}): ${err instanceof Error ? err.message : err}`);
    }

    return { lat, lng, address, addressProvider };
  }
}
