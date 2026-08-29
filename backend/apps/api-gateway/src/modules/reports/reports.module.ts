import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BudgetItem,
  BudgetItemSchema,
  Feedback,
  FeedbackSchema,
  IncomingDocument,
  IncomingDocumentSchema,
  Task,
  TaskSchema,
} from '@vigov/shared';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DashboardService } from './dashboard.service';

/**
 * Kết xuất báo cáo (WBS #27) — tổng hợp số liệu từ Nhiệm vụ, Phản ánh, Giải ngân
 * và xuất Excel nhiều sheet.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: IncomingDocument.name, schema: IncomingDocumentSchema },
      { name: BudgetItem.name, schema: BudgetItemSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, DashboardService],
  exports: [ReportsService, DashboardService],
})
export class ReportsModule {}
