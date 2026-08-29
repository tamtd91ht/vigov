import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { GeoService } from './geo.service';

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
 * API bản đồ / geocoding (WBS #26 — task P3-26).
 * Mọi tài khoản đã đăng nhập đều gọi được, kể cả công dân (roleKey 'citizen'),
 * vì app công dân cần ghim vị trí khi gửi phản ánh — không gắn @RequirePermission.
 */
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  /** Toạ độ → địa chỉ */
  @Get('reverse')
  async reverse(@Query() query: ReverseGeoQueryDto) {
    const address = await this.geo.reverse(query.lat, query.lng);
    return { lat: query.lat, lng: query.lng, address };
  }

  /** Địa chỉ → toạ độ */
  @Get('geocode')
  async geocode(@Query() query: GeocodeQueryDto) {
    const point = await this.geo.geocode(query.address);
    return { query: query.address, point };
  }
}
