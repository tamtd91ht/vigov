import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '@vigov/shared';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { RadioBulletin, RadioBulletinSchema, Video, VideoSchema } from './content.schema';

/**
 * CMS nội dung (WBS #10) — bài viết, video, bản tin truyền thanh.
 * Video/RadioBulletin là schema cục bộ của phân hệ này (khai báo tại content.schema.ts).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: Video.name, schema: VideoSchema },
      { name: RadioBulletin.name, schema: RadioBulletinSchema },
    ]),
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
