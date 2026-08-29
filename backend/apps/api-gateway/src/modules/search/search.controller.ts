import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '@vigov/shared';
import { SearchService } from './search.service';
import { GlobalSearchQueryDto } from './dto/search.dto';

/**
 * Tìm kiếm toàn cục (WBS #28, P3-28) — thanh tìm kiếm trên header Web Quản trị.
 * Ai cũng cần tra nhanh nên chỉ yêu cầu quyền xem phân hệ Tổng quan.
 */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** GET /search?q=&types=tasks,documents,feedback&limit= */
  @Get()
  @RequirePermission('overview', 'view')
  globalSearch(@Query() query: GlobalSearchQueryDto) {
    return this.search.search(query);
  }
}
