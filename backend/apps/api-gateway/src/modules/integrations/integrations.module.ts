import { Module } from '@nestjs/common';
import { MockOcrProvider } from './ocr/ocr.provider';
import { OcrService } from './ocr/ocr.service';
import { GeoController } from './geo/geo.controller';
import { MockGeoProvider } from './geo/geo.provider';
import { GeoService } from './geo/geo.service';

/**
 * Module Integrations — gom các đầu nối bên thứ 3 (OCR, GIS/geocoding, ...).
 * Provider thật chờ khách chốt nhà cung cấp (câu hỏi mở #1, #2).
 */
@Module({
  controllers: [GeoController],
  providers: [MockOcrProvider, OcrService, MockGeoProvider, GeoService],
  exports: [OcrService, GeoService],
})
export class IntegrationsModule {}
