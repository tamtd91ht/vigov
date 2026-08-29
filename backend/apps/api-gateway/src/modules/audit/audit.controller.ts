import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '@vigov/shared';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './dto/audit.dto';

/** Nhật ký thao tác — chỉ quản trị hệ thống được tra cứu (WBS #29, P3-29). */
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Tra cứu nhật ký theo người thao tác / đối tượng / hành động / khoảng thời gian */
  @Get()
  @RequirePermission('settings', 'admin')
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }
}
