import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { GeoService } from './geo.service';
import { ZaloLocationService } from './zalo-location.service';

/** Giới hạn toạ độ và độ dài địa chỉ nhận từ client */
const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;
const ADDRESS_MIN_LENGTH = 2;
const ADDRESS_MAX_LENGTH = 300;

/** Tham số tra cứu địa chỉ từ toạ độ */
export class ReverseGeoQueryDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Vĩ độ (lat) phải là số' })
  @Min(LAT_MIN)
  @Max(LAT_MAX)
  lat: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Kinh độ (lng) phải là số' })
  @Min(LNG_MIN)
  @Max(LNG_MAX)
  lng: number;
}

/** Tham số tra cứu toạ độ từ địa chỉ */
export class GeocodeQueryDto {
  @IsString()
  @Length(ADDRESS_MIN_LENGTH, ADDRESS_MAX_LENGTH, { message: 'Vui lòng nhập địa chỉ cần tra cứu' })
  address: string;
}

/**
 * Giới hạn độ dài mã Zalo. Không phải để đoán đúng định dạng — Zalo không công
 * bố — mà để chặn ai đó nhồi một chuỗi khổng lồ vào header của lệnh gọi ra ngoài.
 */
const ZALO_TOKEN_MIN_LENGTH = 8;
const ZALO_TOKEN_MAX_LENGTH = 4096;

/** Thân yêu cầu đổi mã định vị Zalo lấy toạ độ */
export class ZaloLocationBodyDto {
  /** Mã dùng một lần từ getLocation() của zmp-sdk */
  @IsString()
  @Length(ZALO_TOKEN_MIN_LENGTH, ZALO_TOKEN_MAX_LENGTH, { message: 'Thiếu mã định vị của Zalo' })
  token: string;

  /** Phiên đăng nhập Zalo của chính người dùng, từ getAccessToken() */
  @IsString()
  @Length(ZALO_TOKEN_MIN_LENGTH, ZALO_TOKEN_MAX_LENGTH, { message: 'Thiếu access_token của Zalo' })
  accessToken: string;
}

/**
 * API bản đồ / geocoding (WBS #26 — task P3-26).
 * Mọi tài khoản đã đăng nhập đều gọi được, kể cả công dân (roleKey 'citizen'),
 * vì app công dân cần ghim vị trí khi gửi phản ánh — không gắn @RequirePermission.
 */
@Controller('geo')
export class GeoController {
  constructor(
    private readonly geo: GeoService,
    private readonly zaloLocation: ZaloLocationService,
  ) {}

  /**
   * Toạ độ → địa chỉ.
   *
   * Trả kèm `addressProvider` để nơi gọi biết địa chỉ do provider nào sinh ra:
   * bản "mock" BỊA địa chỉ từ toạ độ, hiện thẳng lên cho công dân là mời họ gửi
   * phiếu sai địa chỉ.
   */
  @Get('reverse')
  async reverse(@Query() query: ReverseGeoQueryDto) {
    const address = await this.geo.reverse(query.lat, query.lng);
    return { lat: query.lat, lng: query.lng, address, addressProvider: this.geo.providerName };
  }

  /** Địa chỉ → toạ độ */
  @Get('geocode')
  async geocode(@Query() query: GeocodeQueryDto) {
    const point = await this.geo.geocode(query.address);
    return { query: query.address, point };
  }

  /**
   * Mã định vị Zalo → toạ độ + địa chỉ (P3-26).
   *
   * POST chứ không GET: mã là bí mật dùng một lần, để nó vào query string là
   * để nó vào access log của nginx và lịch sử của mọi proxy trên đường.
   */
  @Post('zalo-location')
  async zaloLocationResolve(@Body() body: ZaloLocationBodyDto) {
    return this.zaloLocation.resolve(body.token, body.accessToken);
  }
}
