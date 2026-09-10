import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { DocumentsService } from './documents.service';
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
  constructor(private readonly documents: DocumentsService) {}

  /** Danh sách văn bản đến / đơn thư (lọc + phân trang) */
  @RequirePermission('documents', 'view')
  @Get()
  list(@Query() query: QueryDocumentsDto) {
    return this.documents.list(query);
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
