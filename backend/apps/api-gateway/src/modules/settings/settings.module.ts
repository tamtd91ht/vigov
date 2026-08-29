import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema, SlaRule, SlaRuleSchema } from '@vigov/shared';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { OrgNode, OrgNodeSchema } from './schemas/org-node.schema';
import {
  FeedbackCategory,
  FeedbackCategorySchema,
} from './schemas/feedback-category.schema';

/** Module Cấu hình — SLA, cây tổ chức, danh mục vai trò (WBS #9). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SlaRule.name, schema: SlaRuleSchema },
      { name: OrgNode.name, schema: OrgNodeSchema },
      { name: FeedbackCategory.name, schema: FeedbackCategorySchema },
      { name: Feedback.name, schema: FeedbackSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
