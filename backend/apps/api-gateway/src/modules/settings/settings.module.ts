import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OrgNode,
  OrgNodeSchema,
  type OrgNodeDocument, Feedback, FeedbackSchema, SlaRule, SlaRuleSchema
} from '@vigov/shared';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { IntegrationSettingsService } from './integration-settings.service';
import { IssuingAgenciesService } from './issuing-agencies.service';
import {
  FeedbackCategory,
  FeedbackCategorySchema,
} from './schemas/feedback-category.schema';
import {
  IntegrationSettings,
  IntegrationSettingsSchema,
} from './schemas/integration-settings.schema';
import { IssuingAgency, IssuingAgencySchema } from './schemas/issuing-agency.schema';

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
      { name: IssuingAgency.name, schema: IssuingAgencySchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, IntegrationSettingsService, IssuingAgenciesService],
  exports: [SettingsService, IntegrationSettingsService, IssuingAgenciesService],
})
export class SettingsModule {}
