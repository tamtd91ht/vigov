import { Module } from '@nestjs/common';
import { MockOcrProvider } from './ocr/ocr.provider';
import { OcrService } from './ocr/ocr.service';
import { MockIdCardProvider } from './idcard/idcard.provider';
import { IdCardService } from './idcard/idcard.service';
import { GeoController } from './geo/geo.controller';
import { MockGeoProvider } from './geo/geo.provider';
import { GeoService } from './geo/geo.service';

/**
 * Module Integrations — gom các đầu nối bên thứ 3 (OCR văn bản, đọc thẻ căn
 * cước, GIS/geocoding, ...). Provider thật chờ khách chốt (câu hỏi mở #1, #2).
 */
@Module({
  controllers: [GeoController],
  providers: [
    MockOcrProvider,
    OcrService,
    MockIdCardProvider,
    IdCardService,
    MockGeoProvider,
    GeoService,
  ],
  exports: [OcrService, IdCardService, GeoService],
})
export class IntegrationsModule {}
