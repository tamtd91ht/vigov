import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { DocumentsService } from './documents.service';
import {
  ConfirmOcrFieldDto,
  CreateDocumentDto,
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

  /** Xoá văn bản khỏi sổ — chỉ quản trị hệ thống */
  @RequirePermission('documents', 'admin')
  @Delete(':arrivalNo')
  remove(@Param('arrivalNo') arrivalNo: string) {
    return this.documents.remove(arrivalNo);
  }
}
