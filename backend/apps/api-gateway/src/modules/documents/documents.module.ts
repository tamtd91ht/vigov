import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomingDocument, IncomingDocumentSchema } from '@vigov/shared';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/** Phân hệ Văn bản đến & Đơn thư công dân (WBS #4) — dùng OcrService của Integrations */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: IncomingDocument.name, schema: IncomingDocumentSchema }]),
    IntegrationsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
