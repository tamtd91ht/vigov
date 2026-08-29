import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { MapLayer, MapLayerSchema, MapPin, MapPinSchema } from './map.schema';

/**
 * Bản đồ kinh tế số (WBS #7) — lớp dữ liệu và ghim cơ sở kinh tế/hạ tầng.
 * MapLayer/MapPin là schema cục bộ của phân hệ này (khai báo tại map.schema.ts).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MapLayer.name, schema: MapLayerSchema },
      { name: MapPin.name, schema: MapPinSchema },
    ]),
  ],
  controllers: [MapController],
  providers: [MapService],
  exports: [MapService],
})
export class MapModule {}
