import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Article,
  ArticleSchema,
  BudgetItem,
  BudgetItemSchema,
  CitizenUser,
  CitizenUserSchema,
  IncomingDocument,
  IncomingDocumentSchema,
  StaffUser,
  StaffUserSchema,
} from '@vigov/shared';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { OrgNode, OrgNodeSchema } from '../settings/schemas/org-node.schema';
import { RadioBulletin, RadioBulletinSchema, Video, VideoSchema } from '../content/content.schema';

/**
 * Danh mục dùng chung (WBS #9) — chỉ ĐỌC dữ liệu của các phân hệ khác để dựng
 * danh mục cho dropdown, nên chỉ đăng ký model, không sở hữu collection nào.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrgNode.name, schema: OrgNodeSchema },
      { name: StaffUser.name, schema: StaffUserSchema },
      { name: CitizenUser.name, schema: CitizenUserSchema },
      { name: IncomingDocument.name, schema: IncomingDocumentSchema },
      { name: Article.name, schema: ArticleSchema },
      { name: Video.name, schema: VideoSchema },
      { name: RadioBulletin.name, schema: RadioBulletinSchema },
      { name: BudgetItem.name, schema: BudgetItemSchema },
    ]),
  ],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
