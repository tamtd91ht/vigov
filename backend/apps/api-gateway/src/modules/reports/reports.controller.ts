import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '@vigov/shared';
import { ReportsService } from './reports.service';
import { DashboardService } from './dashboard.service';
import { ReportQueryDto } from './dto/reports.dto';
import { buildReportWorkbook, reportFileName } from './exporters/excel.exporter';
import { buildReportPdf, reportPdfFileName } from './exporters/pdf.exporter';
import { buildReportPptx, reportPptxFileName } from './exporters/pptx.exporter';

/** MIME type của các tệp kết xuất */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_MIME = 'application/pdf';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** Kết xuất báo cáo: Excel, PDF, PowerPoint (WBS #8, #27) */
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
   * Tải báo cáo PDF (WBS #8) — cùng bộ số liệu với bản Excel, trình bày để in.
   *
   * Trả cả Buffer một lần thay vì stream: báo cáo cấp xã chỉ vài trang, và
   * pdfmake phải dựng xong toàn tài liệu mới biết tổng số trang cho chân trang.
   */
  @Get('export/pdf')
  @RequirePermission('reports', 'view')
  async exportPdf(@Query() query: ReportQueryDto, @Res({ passthrough: false }) res: Response) {
    const summary = await this.reports.summary(query);
    const buffer = await buildReportPdf(summary);
    const fileName = reportPdfFileName(summary.period, summary.year);

    res.setHeader('Content-Type', PDF_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /** Tải báo cáo PowerPoint (WBS #27) — mỗi khối số liệu một slide, dùng cho giao ban */
  @Get('export/pptx')
  @RequirePermission('reports', 'view')
  async exportPptx(@Query() query: ReportQueryDto, @Res({ passthrough: false }) res: Response) {
    const summary = await this.reports.summary(query);
    const buffer = await buildReportPptx(summary);
    const fileName = reportPptxFileName(summary.period, summary.year);

    res.setHeader('Content-Type', PPTX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
