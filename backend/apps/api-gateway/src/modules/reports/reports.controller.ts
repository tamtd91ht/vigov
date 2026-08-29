import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '@vigov/shared';
import { ReportsService } from './reports.service';
import { DashboardService } from './dashboard.service';
import { ReportQueryDto } from './dto/reports.dto';
import { buildReportWorkbook, reportFileName } from './exporters/excel.exporter';

/** MIME type của tệp .xlsx */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Thông báo cho các định dạng kết xuất chưa hỗ trợ ở Phase 1 */
const NOT_IMPLEMENTED_MESSAGE = 'Kết xuất PDF/PPT sẽ bổ sung ở giai đoạn tích hợp';

/** Kết xuất báo cáo (WBS #27) */
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Số liệu tổng hợp cho trang Tổng quan (WBS #2) */
  @Get('dashboard')
  @RequirePermission('overview', 'view')
  overview(@Query('year') year?: string) {
    return this.dashboard.overview(Number.parseInt(year ?? '', 10) || new Date().getFullYear());
  }

  /** Số liệu tổng hợp theo kỳ, dựng biểu đồ trên Web Quản trị */
  @Get('summary')
  @RequirePermission('reports', 'view')
  summary(@Query() query: ReportQueryDto) {
    return this.reports.summary(query);
  }

  /** Tải báo cáo Excel nhiều sheet: Nhiệm vụ, Phản ánh, Giải ngân, Xếp hạng */
  @Get('export/excel')
  @RequirePermission('reports', 'view')
  async exportExcel(@Query() query: ReportQueryDto, @Res({ passthrough: false }) res: Response) {
    const summary = await this.reports.summary(query);
    const workbook = buildReportWorkbook(summary);
    const fileName = reportFileName(summary.period, summary.year);

    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Kết xuất PDF — chưa hỗ trợ ở Phase 1.
   * Định dạng và mẫu trình bày chờ khách chốt (câu hỏi mở #11).
   */
  @Get('export/pdf')
  @RequirePermission('reports', 'view')
  exportPdf(): never {
    throw new HttpException(
      { statusCode: HttpStatus.NOT_IMPLEMENTED, message: NOT_IMPLEMENTED_MESSAGE, format: 'pdf' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  /**
   * Kết xuất PowerPoint — chưa hỗ trợ ở Phase 1.
   * Khách có thể bỏ hạng mục PPT để tiết kiệm 0.5 ngày công (câu hỏi mở #11).
   */
  @Get('export/pptx')
  @RequirePermission('reports', 'view')
  exportPptx(): never {
    throw new HttpException(
      { statusCode: HttpStatus.NOT_IMPLEMENTED, message: NOT_IMPLEMENTED_MESSAGE, format: 'pptx' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
