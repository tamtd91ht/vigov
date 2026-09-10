import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema, SlaRule, SlaRuleSchema } from '@vigov/shared';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { IntegrationSettingsService } from './integration-settings.service';
import { OrgNode, OrgNodeSchema } from './schemas/org-node.schema';
import {
  FeedbackCategory,
  FeedbackCategorySchema,
} from './schemas/feedback-category.schema';
import {
  IntegrationSettings,
  IntegrationSettingsSchema,
} from './schemas/integration-settings.schema';

/**
 * Module Cấu hình — SLA, cây tổ chức, danh mục vai trò, nhà cung cấp bên thứ 3.
 *
 * `IntegrationSettingsService` được export để module Integrations đọc cấu hình
 * nhà cung cấp. Phụ thuộc đi MỘT chiều (integrations → settings) để không có
 * vòng lặp import.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SlaRule.name, schema: SlaRuleSchema },
      { name: OrgNode.name, schema: OrgNodeSchema },
      { name: FeedbackCategory.name, schema: FeedbackCategorySchema },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: IntegrationSettings.name, schema: IntegrationSettingsSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, IntegrationSettingsService],
  exports: [SettingsService, IntegrationSettingsService],
})
export class SettingsModule {}
