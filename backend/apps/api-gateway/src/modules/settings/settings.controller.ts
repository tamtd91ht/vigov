import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequirePermission } from '@vigov/shared';
import { SettingsService } from './settings.service';
import {
  CreateFeedbackCategoryDto,
  CreateOrgNodeDto,
  UpdateFeedbackCategoryDto,
  UpdateOrgNodeDto,
  UpdateSlaDto,
} from './dto/settings.dto';

/** Phân hệ Cấu hình hệ thống — SLA, cây tổ chức, danh mục vai trò (WBS #9). */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // ─── SLA ─────────────────────────────────────────────────────────────────

  /** Bảng SLA theo lĩnh vực; chưa cấu hình thì trả bộ mặc định 8 lĩnh vực */
  @Get('sla')
  @RequirePermission('settings', 'view')
  getSla() {
    return this.settings.getSla();
  }

  /** Lưu cả bảng SLA (upsert theo categoryKey) */
  @Put('sla')
  @RequirePermission('settings', 'edit')
  saveSla(@Body() dto: UpdateSlaDto) {
    return this.settings.saveSla(dto.rules);
  }

  /** Khôi phục bộ SLA mặc định */
  @Post('sla/reset')
  @RequirePermission('settings', 'edit')
  resetSla() {
    return this.settings.resetSla();
  }

  // ─── Cây tổ chức ─────────────────────────────────────────────────────────

  /** Cây tổ chức lồng nhau dựng từ parentId */
  @Get('org')
  @RequirePermission('settings', 'view')
  getOrgTree() {
    return this.settings.getOrgTree();
  }

  /** Thêm đơn vị vào cây tổ chức */
  @Post('org')
  @RequirePermission('settings', 'edit')
  createOrgNode(@Body() dto: CreateOrgNodeDto) {
    return this.settings.createOrgNode(dto);
  }

  /** Cập nhật thông tin đơn vị */
  @Patch('org/:id')
  @RequirePermission('settings', 'edit')
  updateOrgNode(@Param('id') id: string, @Body() dto: UpdateOrgNodeDto) {
    return this.settings.updateOrgNode(id, dto);
  }

  /** Xoá đơn vị (chặn khi còn đơn vị trực thuộc) */
  @Delete('org/:id')
  @RequirePermission('settings', 'edit')
  removeOrgNode(@Param('id') id: string) {
    return this.settings.removeOrgNode(id);
  }

  // ─── Lĩnh vực phản ánh ───────────────────────────────────────────────────

  /**
   * Danh mục lĩnh vực phản ánh.
   * Để mức 'view' của phân hệ settings vì nhiều màn hình khác cần đọc để
   * đổ dropdown và tô màu chip.
   */
  @Get('categories')
  @RequirePermission('settings', 'view')
  getCategories() {
    return this.settings.getCategories();
  }

  @Post('categories')
  @RequirePermission('settings', 'edit')
  createCategory(@Body() dto: CreateFeedbackCategoryDto) {
    return this.settings.createCategory(dto);
  }

  /** Sửa tên / màu / thứ tự; mã lĩnh vực không đổi được */
  @Patch('categories/:key')
  @RequirePermission('settings', 'edit')
  updateCategory(@Param('key') key: string, @Body() dto: UpdateFeedbackCategoryDto) {
    return this.settings.updateCategory(key, dto);
  }

  /** Xoá lĩnh vực (chặn khi còn phiếu phản ánh tham chiếu) */
  @Delete('categories/:key')
  @RequirePermission('settings', 'edit')
  removeCategory(@Param('key') key: string) {
    return this.settings.removeCategory(key);
  }

  // ─── Vai trò ─────────────────────────────────────────────────────────────

  /** Danh mục vai trò RBAC — chỉ đọc, phục vụ dropdown phía FE */
  @Get('roles')
  @RequirePermission('settings', 'view')
  getRoles() {
    return this.settings.getRoles();
  }
}
