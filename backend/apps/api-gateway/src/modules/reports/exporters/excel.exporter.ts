import { Workbook, type Worksheet } from 'exceljs';
import type { ReportSummary } from '../reports.service';

/** Tên các sheet trong tệp báo cáo */
const SHEET_TASKS = 'Nhiệm vụ';
const SHEET_FEEDBACK = 'Phản ánh';
const SHEET_DISBURSEMENT = 'Giải ngân';
const SHEET_RANKING = 'Xếp hạng';

/** Định dạng chung */
const HEADER_FILL = 'FFE8F0FE';
const TITLE_ROW_HEIGHT = 22;
const DEFAULT_COLUMN_WIDTH = 18;

/**
 * Dựng workbook báo cáo tổng hợp gồm 4 sheet.
 * Không ghi ra tệp — controller stream thẳng workbook về client.
 */
export function buildReportWorkbook(summary: ReportSummary): Workbook {
  const workbook = new Workbook();
  workbook.creator = 'ViGov';
  workbook.created = new Date();

  buildTaskSheet(workbook, summary);
  buildFeedbackSheet(workbook, summary);
  buildDisbursementSheet(workbook, summary);
  buildRankingSheet(workbook, summary);

  return workbook;
}

/** Tên tệp tải về: bao-cao-vigov-<period>-<year>.xlsx */
export function reportFileName(period: string, year: number): string {
  return `bao-cao-vigov-${period}-${year}.xlsx`;
}

/** Sheet Nhiệm vụ: số nhiệm vụ theo bộ phận + tỷ lệ đúng hạn theo tháng */
function buildTaskSheet(workbook: Workbook, summary: ReportSummary): void {
  const sheet = workbook.addWorksheet(SHEET_TASKS);
  writeTitle(sheet, `Báo cáo nhiệm vụ — ${summary.range.label}`, 4);

  writeHeader(sheet, ['Bộ phận', 'Số nhiệm vụ']);
  for (const row of summary.tasksByDepartment) {
    sheet.addRow([row.department, row.total]);
  }

  sheet.addRow([]);
  writeHeader(sheet, ['Tháng', 'Tổng nhiệm vụ', 'Hoàn thành đúng hạn', 'Tỷ lệ đúng hạn (%)']);
  for (const row of summary.onTimeRateByMonth) {
    sheet.addRow([row.month, row.total, row.onTime, row.rate]);
  }

  sheet.addRow([]);
  sheet.addRow(['Tổng nhiệm vụ trong kỳ', summary.totals.tasks]);
  sheet.addRow(['Hoàn thành đúng hạn', summary.totals.tasksOnTime]);
  sheet.addRow(['Trễ hạn', summary.totals.tasksLate]);
  sheet.addRow(['Tỷ lệ đúng hạn (%)', summary.totals.onTimeRate]);

  autoWidth(sheet);
}

/** Sheet Phản ánh: số phiếu theo lĩnh vực và tỷ lệ đã xử lý */
function buildFeedbackSheet(workbook: Workbook, summary: ReportSummary): void {
  const sheet = workbook.addWorksheet(SHEET_FEEDBACK);
  writeTitle(sheet, `Báo cáo phản ánh — ${summary.range.label}`, 4);

  writeHeader(sheet, ['Lĩnh vực', 'Số phiếu', 'Đã xử lý', 'Tỷ lệ xử lý (%)']);
  for (const row of summary.feedbackByCategory) {
    sheet.addRow([row.label, row.total, row.resolved, row.resolveRate]);
  }

  sheet.addRow([]);
  sheet.addRow(['Tổng phiếu trong kỳ', summary.totals.feedbacks]);
  sheet.addRow(['Đã xử lý xong', summary.totals.feedbacksResolved]);

  autoWidth(sheet);
}

/** Sheet Giải ngân: kế hoạch và thực hiện theo nguồn vốn (tỷ đồng) */
function buildDisbursementSheet(workbook: Workbook, summary: ReportSummary): void {
  const sheet = workbook.addWorksheet(SHEET_DISBURSEMENT);
  writeTitle(sheet, `Báo cáo giải ngân năm ${summary.year} (đơn vị: tỷ đồng)`, 4);

  writeHeader(sheet, ['Nguồn vốn', 'Kế hoạch', 'Đã giải ngân', 'Tỷ lệ (%)']);
  for (const row of summary.disbursementByFunding) {
    sheet.addRow([row.fundingSource, row.planned, row.actual, row.percent]);
  }

  sheet.addRow([]);
  sheet.addRow(['Tổng kế hoạch', summary.totals.planned]);
  sheet.addRow(['Tổng đã giải ngân', summary.totals.actual]);
  sheet.addRow(['Tỷ lệ giải ngân (%)', summary.totals.disbursementPercent]);

  autoWidth(sheet);
}

/** Sheet Xếp hạng bộ phận theo tỷ lệ hoàn thành đúng hạn */
function buildRankingSheet(workbook: Workbook, summary: ReportSummary): void {
  const sheet = workbook.addWorksheet(SHEET_RANKING);
  writeTitle(sheet, `Xếp hạng bộ phận — ${summary.range.label}`, 5);

  writeHeader(sheet, ['Hạng', 'Bộ phận', 'Tổng nhiệm vụ', 'Đúng hạn', 'Trễ hạn']);
  for (const row of summary.departmentRanking) {
    sheet.addRow([row.rank, row.department, row.total, row.onTime, row.late]);
  }

  if (summary.comparison) {
    sheet.addRow([]);
    writeHeader(sheet, ['So sánh với', summary.comparison.previousLabel]);
    sheet.addRow(['Nhiệm vụ kỳ trước', summary.comparison.previous.tasks]);
    sheet.addRow(['Tỷ lệ đúng hạn kỳ trước (%)', summary.comparison.previous.onTimeRate]);
    sheet.addRow(['Chênh lệch tỷ lệ đúng hạn (%)', summary.comparison.delta.onTimeRate ?? 0]);
  }

  autoWidth(sheet);
}

/** Dòng tiêu đề lớn của sheet */
function writeTitle(sheet: Worksheet, title: string, span: number): void {
  const row = sheet.addRow([title]);
  row.height = TITLE_ROW_HEIGHT;
  row.font = { bold: true, size: 13 };
  sheet.mergeCells(row.number, 1, row.number, span);
  sheet.addRow([]);
}

/** Dòng tiêu đề cột có tô nền */
function writeHeader(sheet: Worksheet, headers: string[]): void {
  const row = sheet.addRow(headers);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });
}

/** Giãn cột theo độ dài nội dung để bảng dễ đọc khi mở bằng Excel */
function autoWidth(sheet: Worksheet): void {
  sheet.columns.forEach((column) => {
    let width = DEFAULT_COLUMN_WIDTH;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length + 2;
      if (length > width) width = length;
    });
    column.width = Math.min(width, 60);
  });
}
