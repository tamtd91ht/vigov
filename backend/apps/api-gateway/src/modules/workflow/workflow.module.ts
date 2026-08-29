import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema, IncomingDocument, IncomingDocumentSchema } from '@vigov/shared';
import { MessagingModule } from '../messaging/messaging.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

/**
 * Module Workflow (WBS #30 — P3-30): luồng xuyên phân hệ
 * (văn bản/phản ánh → nhiệm vụ, đồng bộ ngược trạng thái) và CronJob nhắc hạn.
 * ScheduleModule.forRoot() đã bật ở AppModule.
 *
 * P5-04: MessagingModule cung cấp MessagingService để phát sự kiện sang hàng đợi
 * RabbitMQ — kênh PHỤ bên cạnh lời gọi trực tiếp, hỏng cũng không ảnh hưởng nghiệp vụ.
 */
@Module({
  imports: [
    TasksModule,
    MessagingModule,
    MongooseModule.forFeature([
      { name: IncomingDocument.name, schema: IncomingDocumentSchema },
      { name: Feedback.name, schema: FeedbackSchema },
    ]),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
