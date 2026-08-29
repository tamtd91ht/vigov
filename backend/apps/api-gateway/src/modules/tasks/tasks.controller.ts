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
  CreateCommentDto,
  CreateTaskDto,
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

  /** Chi tiết nhiệm vụ theo mã NV-xxxx */
  @RequirePermission('tasks', 'view')
  @Get(':code')
  detail(@Param('code') code: string) {
    return this.tasks.findByCode(code);
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

  /** Xoá nhiệm vụ — chỉ quản trị hệ thống */
  @RequirePermission('tasks', 'admin')
  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.tasks.remove(code);
  }
}
