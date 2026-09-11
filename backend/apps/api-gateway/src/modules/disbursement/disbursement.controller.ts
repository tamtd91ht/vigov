import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  BUDGET_APPROVAL_LABELS,
  RequirePermission,
  SCHEDULE_STATE_LABELS,
  dateRangeLabel,
  findRole,
  hasPermission,
  type AuthedRequest,
  type BudgetApprovalStatus,
} from '@vigov/shared';
import { AuditService } from '../audit/audit.service';
import {
  buildListWorkbook,
  describeFilters,
  listExportFileName,
} from '../reports/exporters/list-workbook';
import { streamExcelExport } from '../reports/exporters/stream-export';
import { BUDGET_EXPORT_COLUMNS } from './disbursement.export';
import { DisbursementService } from './disbursement.service';
import {
  AddBudgetDocumentDto,
  ChangeBudgetStatusDto,
  CreateAdjustmentDto,
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
  UpdateBudgetItemDto,
} from './dto/disbursement.dto';

/** Ngân sách – Giải ngân (WBS #5) */
@Controller('disbursement')
export class DisbursementController {
  constructor(
    private readonly disbursement: DisbursementService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Kiểm mức quyền của phiên đăng nhập cho một bước chuyển trạng thái.
   *
   * Danh tính và vai trò lấy từ `req.user` do `JwtAuthGuard` gán, KHÔNG nhận từ
   * body — xem `rules/critical/phan-quyen-rbac.md` MUST #3.
   */
  private assertLevel(
    req: AuthedRequest,
    level: 'edit' | 'approve' | 'admin',
    target: BudgetApprovalStatus,
  ): void {
    const roleKey = req.user?.roleKey ?? '';
    if (!hasPermission(roleKey, 'disbursement', level)) {
      const roleLabel = findRole(roleKey)?.label ?? 'Vai trò hiện tại';
      throw new ForbiddenException(
        `${roleLabel} không có quyền chuyển hạng mục sang trạng thái này. ` +
          `Bước chuyển "${target}" cần quyền "${level}" ở phân hệ Giải ngân.`,
      );
    }
  }

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

  /**
   * Số liệu bảng điều khiển giải ngân: tổng quan, tiến độ, kế hoạch–thực tế theo
   * quý, và các nhóm cảnh báo cần xử trước.
   *
   * PHẢI khai TRƯỚC `@Get(':code')` — nếu không "dashboard" bị hiểu là mã hạng mục.
   */
  @Get('dashboard')
  @RequirePermission('disbursement', 'view')
  dashboard(@Query('year') year?: string) {
    const parsed = Number.parseInt(year ?? '', 10);
    return this.disbursement.dashboard(Number.isFinite(parsed) ? parsed : undefined);
  }

  /**
   * Xuất Excel danh sách hạng mục theo ĐÚNG bộ lọc đang áp dụng.
   *
   * PHẢI khai TRƯỚC `@Get(':code')` — nếu không "export" bị hiểu là mã hạng mục.
   */
  @Get('export/excel')
  @RequirePermission('disbursement', 'view')
  async exportExcel(
    @Query() query: ListBudgetQueryDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    const rows = await this.disbursement.listForExport(query);
    const year = query.year ?? new Date().getFullYear();
    const workbook = buildListWorkbook(rows, BUDGET_EXPORT_COLUMNS, {
      title: query.deleted
        ? 'Danh sách hạng mục giải ngân đã xoá'
        : 'Danh sách hạng mục giải ngân',
      orgName: this.config.get<string>('org.name') ?? 'UBND xã',
      orgParent: this.config.get<string>('org.parent') ?? '',
      periodLabel: `năm ngân sách ${year}`,
      filterLabel: describeFilters({
        'Đơn vị thực hiện': query.owner,
        'Loại chi': query.expenseType,
        'Nguồn vốn': query.fundingSource,
        'Dự án / chương trình': query.program,
        'Trạng thái hồ sơ': query.approvalStatus?.map(
          (s) => BUDGET_APPROVAL_LABELS[s] ?? s,
        ),
        'Tình trạng tiến độ': query.scheduleState?.map(
          (s) => SCHEDULE_STATE_LABELS[s as never] ?? s,
        ),
        'Tỷ lệ giải ngân':
          query.minPercent !== undefined || query.maxPercent !== undefined
            ? `${query.minPercent ?? 0}% – ${query.maxPercent ?? 100}%`
            : undefined,
        'Sắp hết hạn': query.dueSoon ? 'có' : undefined,
        'Từ khoá': query.q,
      }),
      exportedBy: req.user?.username ?? 'không rõ',
      sheetName: 'Hạng mục giải ngân',
    });

    await streamExcelExport({
      res,
      workbook,
      fileName: listExportFileName('danh-sach-giai-ngan'),
      audit: this.audit,
      actor: req.user,
      resource: 'disbursement/export',
      rowCount: rows.length,
      filters: { ...query },
      ip: req.ip,
    });
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

  /**
   * Sửa thông tin hạng mục.
   * KHÔNG sửa được dự toán qua đường này — đổi dự toán phải đi qua điều chỉnh.
   */
  @Patch(':code')
  @RequirePermission('disbursement', 'edit')
  update(
    @Param('code') code: string,
    @Body() dto: UpdateBudgetItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.update(code, dto, req.user);
  }

  /**
   * Đổi trạng thái hồ sơ theo workflow.
   *
   * Quyền kiểm HAI TẦNG: `@RequirePermission('disbursement', 'edit')` chặn người
   * không có quyền ghi, rồi kiểm tiếp mức quyền theo ĐÚNG bước chuyển — gửi
   * duyệt cần `edit`, duyệt / từ chối / quyết toán cần `approve`, huỷ cần
   * `admin`. Gác một mức chung cho cả bảy bước là hoặc kế toán duyệt được hồ sơ
   * của chính mình, hoặc lãnh đạo không gửi duyệt được.
   */
  @Patch(':code/status')
  @RequirePermission('disbursement', 'edit')
  async changeStatus(
    @Param('code') code: string,
    @Body() dto: ChangeBudgetStatusDto,
    @Req() req: AuthedRequest,
  ) {
    const current = await this.disbursement.detail(code);
    const level = this.disbursement.requiredLevelFor(
      current.approvalStatus as BudgetApprovalStatus,
      dto.status,
    );
    if (level) this.assertLevel(req, level, dto.status);
    return this.disbursement.changeStatus(code, dto, req.user);
  }

  /**
   * Điều chỉnh dự toán — đường duy nhất để đổi kế hoạch vốn.
   * Quyền `approve`: điều chỉnh dự toán luôn dựa trên một quyết định hành chính,
   * không phải việc kế toán tự làm.
   */
  @Post(':code/adjustments')
  @RequirePermission('disbursement', 'approve')
  addAdjustment(
    @Param('code') code: string,
    @Body() dto: CreateAdjustmentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.addAdjustment(code, dto, req.user);
  }

  /** Gắn một văn bản / hồ sơ vào hạng mục */
  @Post(':code/documents')
  @RequirePermission('disbursement', 'edit')
  addDocument(
    @Param('code') code: string,
    @Body() dto: AddBudgetDocumentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.addDocument(code, dto, req.user);
  }

  /** Gỡ liên kết một hồ sơ khỏi hạng mục — tệp vẫn còn trong kho tệp */
  @Delete(':code/documents/:fileId')
  @RequirePermission('disbursement', 'edit')
  removeDocument(
    @Param('code') code: string,
    @Param('fileId') fileId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.disbursement.removeDocument(code, fileId, req.user);
  }

  /** Ghi nhận một giao dịch chi trả hoặc hoàn trả cho hạng mục */
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
