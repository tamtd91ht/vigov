import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from '@vigov/shared';
import { RealtimeModule } from '../realtime/realtime.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/**
 * Module Nhiệm vụ (WBS #3 — P3-21).
 * Export TasksService để WorkflowModule tạo nhiệm vụ từ văn bản / phản ánh.
 *
 * P5-05: phát task.changed khi nhiệm vụ được tạo mới hoặc đổi trạng thái.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    RealtimeModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
