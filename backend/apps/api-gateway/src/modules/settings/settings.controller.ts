import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequirePermission } from '@vigov/shared';
import { SettingsService } from './settings.service';
import { CreateOrgNodeDto, UpdateOrgNodeDto, UpdateSlaDto } from './dto/settings.dto';

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

  // ─── Vai trò ─────────────────────────────────────────────────────────────

  /** Danh mục vai trò RBAC — chỉ đọc, phục vụ dropdown phía FE */
  @Get('roles')
  @RequirePermission('settings', 'view')
  getRoles() {
    return this.settings.getRoles();
  }
}
