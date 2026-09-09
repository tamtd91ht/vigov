import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { DisbursementService } from './disbursement.service';
import {
  CreateBudgetItemDto,
  CreateCommentDto,
  CreateDisbursementRequestDto,
  CreateEntryDto,
  CreateObstacleDto,
  DeleteBudgetItemDto,
  DisburseRequestDto,
  ListBudgetQueryDto,
  ListRequestQueryDto,
  RejectRequestDto,
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

  /**
   * Danh sách đề nghị giải ngân toàn xã (màn hình quản lý đề nghị).
   *
   * PHẢI khai TRƯỚC `@Get(':code')`, nếu không Nest khớp "requests" thành mã
   * hạng mục và trả 404.
   */
  @Get('requests')
  @RequirePermission('disbursement', 'view')
  listRequests(@Query() query: ListRequestQueryDto) {
    return this.disbursement.listRequests(query);
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
   * Gửi đề nghị giải ngân đợt tiếp theo (bước 1 của luồng một cấp duyệt).
   * Quyền `edit` — kế toán gửi, lãnh đạo duyệt ở endpoint riêng bên dưới.
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

  /** Duyệt đề nghị — quyền `approve`, dành cho lãnh đạo */
  @Patch(':code/requests/:requestCode/approve')
  @RequirePermission('disbursement', 'approve')
  approveRequest(
    @Param('code') code: string,
    @Param('requestCode') requestCode: string,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.approveRequest(code, requestCode, req.user);
  }

  /** Từ chối đề nghị kèm lý do — quyền `approve` */
  @Patch(':code/requests/:requestCode/reject')
  @RequirePermission('disbursement', 'approve')
  rejectRequest(
    @Param('code') code: string,
    @Param('requestCode') requestCode: string,
    @Body() dto: RejectRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.rejectRequest(code, requestCode, dto, req.user);
  }

  /**
   * Ghi nhận đề nghị đã chi thật — quyền `edit` vì đây là việc của kế toán
   * sau khi kho bạc chuyển tiền, không phải một lần duyệt nữa.
   */
  @Patch(':code/requests/:requestCode/disburse')
  @RequirePermission('disbursement', 'edit')
  disburseRequest(
    @Param('code') code: string,
    @Param('requestCode') requestCode: string,
    @Body() dto: DisburseRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.disburseRequest(code, requestCode, dto, req.user);
  }

  /** Xoá mềm hạng mục — quyền `admin`, dữ liệu vẫn giữ và khôi phục được */
  @Patch(':code/delete')
  @RequirePermission('disbursement', 'admin')
  softDelete(
    @Param('code') code: string,
    @Body() dto: DeleteBudgetItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.softDelete(code, dto, req.user);
  }

  /** Khôi phục hạng mục đã xoá mềm — quyền `admin` */
  @Patch(':code/restore')
  @RequirePermission('disbursement', 'admin')
  restore(@Param('code') code: string) {
    return this.disbursement.restore(code);
  }
}
