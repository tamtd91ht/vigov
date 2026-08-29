import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { WorkflowService } from './workflow.service';
import { DeadlineWarningQueryDto, DocumentToTaskDto, FeedbackToTaskDto } from './dto/workflow.dto';

/**
 * Luồng nghiệp vụ xuyên phân hệ (WBS #30 — P3-30):
 * nút "Chuyển thành công việc" và bảng cảnh báo hạn xử lý.
 */
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  /** Văn bản đến → nhiệm vụ theo dõi */
  @RequirePermission('tasks', 'edit')
  @Post('document-to-task')
  documentToTask(@Body() dto: DocumentToTaskDto, @Req() req: AuthedRequest) {
    return this.workflow.createTaskFromDocument(
      {
        documentId: dto.documentId,
        // Các trường còn lại để trống — service tự lấy theo bản ghi văn bản gốc
        arrivalNo: '',
        summary: '',
        department: dto.department ?? '',
        deadline: dto.deadline ?? '',
        assignedBy: req.user?.displayName ?? '',
      },
      dto.assignee,
    );
  }

  /** Phản ánh của công dân → nhiệm vụ xử lý */
  @RequirePermission('tasks', 'edit')
  @Post('feedback-to-task')
  feedbackToTask(@Body() dto: FeedbackToTaskDto) {
    return this.workflow.createTaskFromFeedback(
      {
        feedbackId: dto.feedbackId,
        // Các trường còn lại để trống — service tự lấy theo phiếu phản ánh gốc
        code: '',
        title: '',
        categoryKey: '',
        department: dto.department ?? '',
        assignee: dto.assignee ?? '',
      },
      dto.deadline,
    );
  }

  /** Danh sách nhiệm vụ sắp đến hạn / đã quá hạn */
  @RequirePermission('tasks', 'view')
  @Get('deadline-warnings')
  deadlineWarnings(@Query() query: DeadlineWarningQueryDto) {
    return this.workflow.listDeadlineWarnings(query.days);
  }
}
