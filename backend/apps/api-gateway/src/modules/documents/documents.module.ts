import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomingDocument, IncomingDocumentSchema } from '@vigov/shared';
import { FilesModule } from '../files/files.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/** Phân hệ Văn bản đến & Đơn thư công dân (WBS #4) — dùng OcrService của Integrations */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: IncomingDocument.name, schema: IncomingDocumentSchema }]),
    IntegrationsModule,
    // TB-09: bản scan văn bản phải là tệp riêng tư — kiểm qua FilesService
    FilesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
