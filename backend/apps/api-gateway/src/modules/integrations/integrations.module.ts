import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { MockOcrProvider } from './ocr/ocr.provider';
import { OcrService } from './ocr/ocr.service';
import { OcrSpaceProvider } from './ocr/ocrspace.provider';
import { MockIdCardProvider } from './idcard/idcard.provider';
import { IdCardService } from './idcard/idcard.service';
import { GeoController } from './geo/geo.controller';
import { MockGeoProvider } from './geo/geo.provider';
import { GeoService } from './geo/geo.service';
import { ZaloLocationService } from './geo/zalo-location.service';

/**
 * Module Integrations — gom các đầu nối bên thứ 3 (OCR văn bản, đọc thẻ căn
 * cước, GIS/geocoding, ...). Provider thật chờ khách chốt (câu hỏi mở #1, #2).
 */
@Module({
  // FilesModule: provider OCR thật cần đọc nội dung bản scan qua FilesService
  imports: [FilesModule],
  controllers: [GeoController],
  providers: [
    MockOcrProvider,
    OcrSpaceProvider,
    OcrService,
    MockIdCardProvider,
    IdCardService,
    MockGeoProvider,
    GeoService,
    ZaloLocationService,
  ],
  exports: [OcrService, IdCardService, GeoService],
})
export class IntegrationsModule {}
