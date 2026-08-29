import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { DisbursementService } from './disbursement.service';
import {
  CreateBudgetItemDto,
  CreateCommentDto,
  CreateDisbursementRequestDto,
  CreateEntryDto,
  CreateObstacleDto,
  ListBudgetQueryDto,
} from './dto/disbursement.dto';

/** Ngân sách – Giải ngân (WBS #5) */
@Controller('disbursement')
export class DisbursementController {
  constructor(private readonly disbursement: DisbursementService) {}

  /** Danh sách hạng mục theo năm/đơn vị + số liệu tổng hợp */
  @Get()
  @RequirePermission('disbursement', 'view')
  list(@Query() query: ListBudgetQueryDto) {
    return this.disbursement.list(query);
  }

  /** Chi tiết hạng mục theo mã HM-xx */
  @Get(':code')
  @RequirePermission('disbursement', 'view')
  detail(@Param('code') code: string) {
    return this.disbursement.detail(code);
  }

  /** Tạo hạng mục ngân sách mới */
  @Post()
  @RequirePermission('disbursement', 'edit')
  create(@Body() dto: CreateBudgetItemDto) {
    return this.disbursement.create(dto);
  }

  /** Ghi nhận một lần giải ngân cho hạng mục */
  @Post(':code/entries')
  @RequirePermission('disbursement', 'edit')
  addEntry(@Param('code') code: string, @Body() dto: CreateEntryDto, @Req() req: AuthedRequest) {
    return this.disbursement.addEntry(code, dto, req.user);
  }

  /** Thêm bình luận trao đổi trong hạng mục */
  @Post(':code/comments')
  @RequirePermission('disbursement', 'view')
  addComment(@Param('code') code: string, @Body() dto: CreateCommentDto, @Req() req: AuthedRequest) {
    return this.disbursement.addComment(code, dto, req.user);
  }

  /** Thêm vướng mắc cần tháo gỡ */
  @Post(':code/obstacles')
  @RequirePermission('disbursement', 'edit')
  addObstacle(@Param('code') code: string, @Body() dto: CreateObstacleDto) {
    return this.disbursement.addObstacle(code, dto);
  }

  /** Đánh dấu vướng mắc đã tháo gỡ (theo vị trí trong danh sách) */
  @Patch(':code/obstacles/:index/resolve')
  @RequirePermission('disbursement', 'edit')
  resolveObstacle(
    @Param('code') code: string,
    @Param('index', ParseIntPipe) index: number,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.resolveObstacle(code, index, req.user);
  }

  /**
   * Gửi đề nghị giải ngân.
   * Phase 1 mới ghi nhận đề nghị chờ duyệt — luồng duyệt chi tiết chờ khách chốt
   * (câu hỏi mở #8).
   */
  @Post(':code/requests')
  @RequirePermission('disbursement', 'edit')
  createRequest(
    @Param('code') code: string,
    @Body() dto: CreateDisbursementRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.createRequest(code, dto, req.user);
  }
}
