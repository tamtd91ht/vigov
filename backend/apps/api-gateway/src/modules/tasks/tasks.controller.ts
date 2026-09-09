import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { TasksService } from './tasks.service';
import {
  AttachTaskFilesDto,
  CreateCommentDto,
  CreateTaskDto,
  DeleteTaskDto,
  QueryTasksDto,
  ToggleChecklistDto,
  UpdateTaskDto,
} from './dto/task.dto';

/**
 * Phân hệ Quản lý nhiệm vụ (WBS #3 — P3-21).
 * Toàn bộ endpoint đi qua JwtAuthGuard toàn cục + RBAC theo phân hệ 'tasks'.
 */
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** Danh sách nhiệm vụ có lọc + phân trang */
  @RequirePermission('tasks', 'view')
  @Get()
  list(@Query() query: QueryTasksDto) {
    return this.tasks.list(query);
  }

  /** Chi tiết nhiệm vụ theo mã NV-xxxx, kèm siêu dữ liệu tệp minh chứng */
  @RequirePermission('tasks', 'view')
  @Get(':code')
  detail(@Param('code') code: string) {
    return this.tasks.detail(code);
  }

  /** Giao nhiệm vụ mới */
  @RequirePermission('tasks', 'edit')
  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: AuthedRequest) {
    return this.tasks.create(dto, req.user);
  }

  /** Cập nhật thông tin / trạng thái / tiến độ nhiệm vụ */
  @RequirePermission('tasks', 'edit')
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateTaskDto, @Req() req: AuthedRequest) {
    return this.tasks.update(code, dto, req.user);
  }

  /** Tick / bỏ tick một việc con trong checklist */
  @RequirePermission('tasks', 'edit')
  @Patch(':code/checklist/:index')
  toggleChecklist(
    @Param('code') code: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: ToggleChecklistDto,
    @Req() req: AuthedRequest,
  ) {
    return this.tasks.toggleChecklistItem(code, index, dto.done, req.user);
  }

  /** Thêm bình luận trao đổi */
  @RequirePermission('tasks', 'edit')
  @Post(':code/comments')
  addComment(@Param('code') code: string, @Body() dto: CreateCommentDto, @Req() req: AuthedRequest) {
    return this.tasks.addComment(code, dto, req.user);
  }

  /**
   * Gắn tệp minh chứng đã tải lên module Files vào nhiệm vụ (WBS #3).
   * Quyền `tasks:edit` — cùng mức với mọi thao tác sửa nhiệm vụ khác.
   */
  @RequirePermission('tasks', 'edit')
  @Post(':code/attachments')
  addAttachments(
    @Param('code') code: string,
    @Body() dto: AttachTaskFilesDto,
    @Req() req: AuthedRequest,
  ) {
    return this.tasks.addAttachments(code, dto.fileIds, req.user);
  }

  /** Gỡ một tệp minh chứng khỏi nhiệm vụ (tệp vẫn còn trong kho) */
  @RequirePermission('tasks', 'edit')
  @Delete(':code/attachments/:fileId')
  removeAttachment(
    @Param('code') code: string,
    @Param('fileId') fileId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.tasks.removeAttachment(code, fileId, req.user);
  }

  /**
   * Xoá MỀM nhiệm vụ: ẩn khỏi mọi danh sách và chặn mọi thao tác ghi, dữ liệu
   * vẫn nằm nguyên trong CSDL. Dùng PATCH chứ không phải DELETE để nói đúng việc
   * đang làm (đổi trạng thái bản ghi) và để mang được lý do xoá trong body —
   * cùng quy ước với xoá tài khoản công dân ở phân hệ Người dùng.
   */
  @RequirePermission('tasks', 'admin')
  @Patch(':code/delete')
  remove(@Param('code') code: string, @Body() dto: DeleteTaskDto, @Req() req: AuthedRequest) {
    return this.tasks.remove(code, req.user, dto.reason);
  }

  /** Khôi phục nhiệm vụ đã xoá mềm — chỉ quản trị hệ thống */
  @RequirePermission('tasks', 'admin')
  @Patch(':code/restore')
  restore(@Param('code') code: string, @Req() req: AuthedRequest) {
    return this.tasks.restore(code, req.user);
  }
}
