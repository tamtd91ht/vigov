import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Feedback,
  FeedbackSchema,
  IncomingDocument,
  IncomingDocumentSchema,
  Task,
  TaskSchema,
} from '@vigov/shared';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/** Module Tìm kiếm toàn cục — nhiệm vụ, văn bản đến, phản ánh (WBS #28, P3-28). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: IncomingDocument.name, schema: IncomingDocumentSchema },
      { name: Feedback.name, schema: FeedbackSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
