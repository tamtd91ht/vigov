import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { RequirePermission, dateRangeLabel, type AuthedRequest } from '@vigov/shared';
import { AuditService } from '../audit/audit.service';
import {
  buildListWorkbook,
  describeFilters,
  listExportFileName,
} from '../reports/exporters/list-workbook';
import { streamExcelExport } from '../reports/exporters/stream-export';
import { DocumentsService } from './documents.service';
import {
  DOCUMENT_EXPORT_COLUMNS,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
} from './documents.export';
import {
  AttachDocumentFilesDto,
  ConfirmOcrFieldDto,
  CreateDocumentDto,
  DeleteDocumentDto,
  PreviewOcrDto,
  QueryDocumentsDto,
  UpdateDocumentDto,
} from './dto/document.dto';

/** Phân hệ Văn bản & Đơn thư (WBS #4) */
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Danh sách văn bản đến / đơn thư (lọc + phân trang) */
  @RequirePermission('documents', 'view')
  @Get()
  list(@Query() query: QueryDocumentsDto) {
    return this.documents.list(query);
  }

  /**
   * Xuất Excel sổ văn bản theo ĐÚNG bộ lọc đang áp dụng.
   *
   * PHẢI khai TRƯỚC route ':arrivalNo' — xem chú thích ở `ocr/preview` bên dưới.
   */
  @RequirePermission('documents', 'view')
  @Get('export/excel')
  async exportExcel(
    @Query() query: QueryDocumentsDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    const rows = await this.documents.listForExport(query);
    const kindLabel = query.kind ? DOCUMENT_KIND_LABELS[query.kind] : '';
    const workbook = buildListWorkbook(rows, DOCUMENT_EXPORT_COLUMNS, {
      title: query.deleted ? 'Sổ văn bản đã xoá' : `Sổ ${kindLabel || 'văn bản đến và đơn thư'}`,
      orgName: this.config.get<string>('org.name') ?? 'UBND xã',
      orgParent: this.config.get<string>('org.parent') ?? '',
      periodLabel: dateRangeLabel(query.from, query.to),
      filterLabel: describeFilters({
        'Phân loại': kindLabel,
        'Trạng thái': query.status ? DOCUMENT_STATUS_LABELS[query.status] : undefined,
        'Bộ phận': query.department,
        'Loại văn bản': query.docType,
        'Từ khoá': query.q,
      }),
      exportedBy: req.user?.username ?? 'không rõ',
      sheetName: 'Sổ văn bản',
    });

    await streamExcelExport({
      res,
      workbook,
      fileName: listExportFileName('so-van-ban'),
      audit: this.audit,
      actor: req.user,
      resource: 'documents/export',
      rowCount: rows.length,
      filters: {
        kind: query.kind,
        status: query.status,
        department: query.department,
        docType: query.docType,
        from: query.from,
        to: query.to,
        q: query.q,
        deleted: query.deleted,
      },
      ip: req.ip,
    });
  }

  /**
   * Quét thử OCR một bản scan chưa gắn vào văn bản nào — dùng ở form tiếp nhận
   * để máy điền hộ các trường trước khi cán bộ bấm lưu. Không ghi vào CSDL.
   *
   * PHẢI khai TRƯỚC route ':arrivalNo': Nest khớp route theo thứ tự khai, nên
   * đặt sau thì 'ocr' bị hiểu là một số đến và lời gọi rơi vào hàm detail().
   */
  @RequirePermission('documents', 'edit')
  @Post('ocr/preview')
  previewOcr(@Body() dto: PreviewOcrDto) {
    return this.documents.previewOcr(dto.fileId);
  }

  /** Chi tiết văn bản theo số đến */
  @RequirePermission('documents', 'view')
  @Get(':arrivalNo')
  detail(@Param('arrivalNo') arrivalNo: string) {
    return this.documents.findOne(arrivalNo);
  }

  /** Tiếp nhận văn bản, tự cấp số đến và vào sổ */
  @RequirePermission('documents', 'edit')
  @Post()
  create(@Body() dto: CreateDocumentDto, @Req() req: AuthedRequest) {
    return this.documents.create(dto, req.user);
  }

  /** Cập nhật văn bản (đổi bộ phận / trạng thái sẽ ghi thêm timeline) */
  @RequirePermission('documents', 'edit')
  @Patch(':arrivalNo')
  update(
    @Param('arrivalNo') arrivalNo: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.update(arrivalNo, dto, req.user);
  }

  /** Chạy OCR trên bản scan đính kèm, lưu 7 trường trích xuất */
  @RequirePermission('documents', 'edit')
  @Post(':arrivalNo/ocr')
  runOcr(@Param('arrivalNo') arrivalNo: string) {
    return this.documents.runOcr(arrivalNo);
  }

  /** Cán bộ xác nhận một trường OCR (có thể sửa lại giá trị) */
  @RequirePermission('documents', 'edit')
  @Patch(':arrivalNo/ocr/:key/confirm')
  confirmOcrField(
    @Param('arrivalNo') arrivalNo: string,
    @Param('key') key: string,
    @Body() dto: ConfirmOcrFieldDto,
  ) {
    return this.documents.confirmOcrField(arrivalNo, key, dto);
  }

  /** Xác nhận toàn bộ trường OCR của văn bản */
  @RequirePermission('documents', 'edit')
  @Post(':arrivalNo/confirm-all-ocr')
  confirmAllOcr(@Param('arrivalNo') arrivalNo: string) {
    return this.documents.confirmAllOcr(arrivalNo);
  }

  /**
   * Gắn tệp đính kèm (phụ lục, biên bản) vào văn bản.
   * Tệp phải được tải lên ở chế độ riêng tư — service từ chối 400 nếu không.
   */
  @RequirePermission('documents', 'edit')
  @Post(':arrivalNo/attachments')
  addAttachments(
    @Param('arrivalNo') arrivalNo: string,
    @Body() dto: AttachDocumentFilesDto,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.addAttachments(arrivalNo, dto.fileIds, req.user);
  }

  /** Gỡ một tệp đính kèm khỏi văn bản — tệp vẫn còn trong kho tệp */
  @RequirePermission('documents', 'edit')
  @Delete(':arrivalNo/attachments/:fileId')
  removeAttachment(
    @Param('arrivalNo') arrivalNo: string,
    @Param('fileId') fileId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.removeAttachment(arrivalNo, fileId, req.user);
  }

  /**
   * Xoá MỀM văn bản khỏi sổ: ẩn khỏi mọi danh sách và chặn mọi thao tác ghi,
   * dữ liệu vẫn nằm nguyên trong CSDL. Dùng PATCH chứ không phải DELETE để nói
   * đúng việc đang làm (đổi trạng thái bản ghi) và để mang được lý do xoá trong
   * body — cùng quy ước với xoá nhiệm vụ và xoá tài khoản công dân.
   */
  @RequirePermission('documents', 'admin')
  @Patch(':arrivalNo/delete')
  remove(
    @Param('arrivalNo') arrivalNo: string,
    @Body() dto: DeleteDocumentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.remove(arrivalNo, req.user, dto.reason);
  }

  /** Khôi phục văn bản đã xoá mềm — chỉ quản trị hệ thống */
  @RequirePermission('documents', 'admin')
  @Patch(':arrivalNo/restore')
  restore(@Param('arrivalNo') arrivalNo: string, @Req() req: AuthedRequest) {
    return this.documents.restore(arrivalNo, req.user);
  }
}
