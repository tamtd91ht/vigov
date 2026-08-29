import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermission } from '@vigov/shared';
import { MapService } from './map.service';
import { CreateLayerDto, CreatePinDto, ListPinQueryDto, UpdateLayerDto, UpdatePinDto } from './dto/map.dto';

/**
 * Bản đồ kinh tế số (WBS #7) — lớp dữ liệu, ghim cơ sở kinh tế/hạ tầng
 * và số liệu tổng hợp cho panel phân tích của Web Quản trị.
 */
@Controller('map')
export class MapController {
  constructor(private readonly map: MapService) {}

  /** Số liệu cho panel phân tích: lớp + cơ cấu ngành + chỉ số tổng hợp */
  @Get('overview')
  @RequirePermission('map', 'view')
  overview() {
    return this.map.overview();
  }

  /** Danh sách lớp dữ liệu kèm số ghim thuộc lớp */
  @Get('layers')
  @RequirePermission('map', 'view')
  listLayers() {
    return this.map.listLayers();
  }

  /** Thêm lớp dữ liệu mới */
  @Post('layers')
  @RequirePermission('map', 'edit')
  createLayer(@Body() dto: CreateLayerDto) {
    return this.map.createLayer(dto);
  }

  /** Cập nhật lớp dữ liệu */
  @Patch('layers/:id')
  @RequirePermission('map', 'edit')
  updateLayer(@Param('id') id: string, @Body() dto: UpdateLayerDto) {
    return this.map.updateLayer(id, dto);
  }

  /** Danh sách ghim, lọc theo lớp và từ khoá */
  @Get('pins')
  @RequirePermission('map', 'view')
  listPins(@Query() query: ListPinQueryDto) {
    return this.map.listPins(query);
  }

  /** Thêm ghim mới lên bản đồ */
  @Post('pins')
  @RequirePermission('map', 'edit')
  createPin(@Body() dto: CreatePinDto) {
    return this.map.createPin(dto);
  }

  /** Cập nhật thông tin ghim */
  @Patch('pins/:id')
  @RequirePermission('map', 'edit')
  updatePin(@Param('id') id: string, @Body() dto: UpdatePinDto) {
    return this.map.updatePin(id, dto);
  }

  /** Xoá ghim — chỉ quản trị hệ thống */
  @Delete('pins/:id')
  @RequirePermission('map', 'admin')
  removePin(@Param('id') id: string) {
    return this.map.removePin(id);
  }
}
