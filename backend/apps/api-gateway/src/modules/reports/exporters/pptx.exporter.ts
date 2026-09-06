import PptxGenJS from 'pptxgenjs';
import type { ReportSummary } from '../reports.service';
import { formatDelta, formatNumber } from './pdf.exporter';

/**
 * Bộ kết xuất báo cáo PowerPoint (WBS #8, #27).
 *
 * Dùng cho cuộc họp giao ban: mỗi khối số liệu của ReportSummary thành một
 * slide, không có chữ nhỏ — chỉ tiêu đề, bảng và vài con số then chốt.
 *
 * Định dạng số dùng lại `formatNumber` của pdf.exporter để bản PDF đọc trước
 * họp và bản trình chiếu trong họp không hiển thị khác nhau.
 */

/** Bố cục 16:9 (10 x 5.63 inch) — tỷ lệ máy chiếu và màn hình họp hiện nay */
const LAYOUT = 'LAYOUT_16x9';
const SLIDE_WIDTH_IN = 10;

/** Lề và vùng nội dung (inch) */
const MARGIN_X = 0.5;
const TITLE_Y = 0.35;
const BODY_Y = 1.15;
const BODY_H = 3.9;
const CONTENT_W = SLIDE_WIDTH_IN - MARGIN_X * 2;

/** Bảng màu — đồng bộ tông navy/xanh của Web Quản trị */
const COLOR_NAVY = '1B3A5C';
const COLOR_HEADER_BG = 'E8F0FE';
const COLOR_TEXT = '1F2937';
const COLOR_MUTED = '5B6C8F';
const COLOR_WHITE = 'FFFFFF';

/** Cỡ chữ (point) */
const FONT_TITLE = 24;
const FONT_SLIDE_TITLE = 20;
const FONT_TABLE = 11;
const FONT_NOTE = 11;

/** Số dòng tối đa mỗi bảng để slide không bị tràn ngoài vùng nhìn */
const MAX_TABLE_ROWS = 12;

/** Tên tệp tải về: bao-cao-vigov-<period>-<year>.pptx */
export function reportPptxFileName(period: string, year: number): string {
  return `bao-cao-vigov-${period}-${year}.pptx`;
}

/**
 * Dựng tệp .pptx báo cáo tổng hợp và trả về Buffer.
 * `outputType: 'nodebuffer'` để không ghi tạm ra đĩa — controller trả thẳng.
 */
export async function buildReportPptx(summary: ReportSummary): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = LAYOUT;
  pptx.author = 'ViGov';
  pptx.company = 'ViGov';
  pptx.title = `Báo cáo tổng hợp điều hành — ${summary.range.label}`;

  buildCoverSlide(pptx, summary);
  buildTotalsSlide(pptx, summary);
  buildTaskSlide(pptx, summary);
  buildOnTimeSlide(pptx, summary);
  buildFeedbackSlide(pptx, summary);
  buildDisbursementSlide(pptx, summary);
  buildRankingSlide(pptx, summary);

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

/** Slide bìa */
function buildCoverSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR_NAVY };

  slide.addText('BÁO CÁO TỔNG HỢP ĐIỀU HÀNH', {
    x: MARGIN_X,
    y: 1.7,
    w: CONTENT_W,
    h: 0.8,
    fontSize: FONT_TITLE,
    bold: true,
    color: COLOR_WHITE,
    align: 'center',
  });
  slide.addText(summary.range.label, {
    x: MARGIN_X,
    y: 2.5,
    w: CONTENT_W,
    h: 0.5,
    fontSize: FONT_SLIDE_TITLE,
    color: COLOR_HEADER_BG,
    align: 'center',
  });
  slide.addText(`Kỳ ${summary.period} · Năm ${summary.year}`, {
    x: MARGIN_X,
    y: 3.05,
    w: CONTENT_W,
    h: 0.4,
    fontSize: FONT_NOTE,
    color: COLOR_HEADER_BG,
    align: 'center',
  });
}

/** Slide số liệu tổng + so sánh kỳ trước */
function buildTotalsSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = addTitledSlide(pptx, '1. Số liệu tổng hợp trong kỳ');
  const totals = summary.totals;

  addTable(
    slide,
    ['Chỉ tiêu', 'Giá trị'],
    [
      ['Tổng nhiệm vụ trong kỳ', formatNumber(totals.tasks)],
      ['Hoàn thành đúng hạn', formatNumber(totals.tasksOnTime)],
      ['Trễ hạn', formatNumber(totals.tasksLate)],
      ['Tỷ lệ đúng hạn (%)', formatNumber(totals.onTimeRate)],
      ['Tổng phản ánh tiếp nhận', formatNumber(totals.feedbacks)],
      ['Phản ánh đã xử lý xong', formatNumber(totals.feedbacksResolved)],
      ['Kế hoạch vốn (tỷ đồng)', formatNumber(totals.planned)],
      ['Đã giải ngân (tỷ đồng)', formatNumber(totals.actual)],
      ['Tỷ lệ giải ngân (%)', formatNumber(totals.disbursementPercent)],
    ],
    [CONTENT_W * 0.6, CONTENT_W * 0.4],
  );

  const comparison = summary.comparison;
  slide.addText(
    comparison
      ? `So với ${comparison.previousLabel}: nhiệm vụ ${formatDelta(comparison.delta.tasks)} · ` +
          `tỷ lệ đúng hạn ${formatDelta(comparison.delta.onTimeRate)}% · ` +
          `phản ánh ${formatDelta(comparison.delta.feedbacks)}`
      : 'Không kèm số liệu so sánh kỳ trước (gọi API với compare=true để có).',
    { x: MARGIN_X, y: BODY_Y + BODY_H + 0.05, w: CONTENT_W, h: 0.4, fontSize: FONT_NOTE, color: COLOR_MUTED },
  );
}

/** Slide nhiệm vụ theo bộ phận */
function buildTaskSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = addTitledSlide(pptx, '2. Nhiệm vụ theo bộ phận');
  addTable(
    slide,
    ['Bộ phận', 'Số nhiệm vụ'],
    summary.tasksByDepartment.map((row) => [row.department, formatNumber(row.total)]),
    [CONTENT_W * 0.7, CONTENT_W * 0.3],
  );
}

/** Slide tỷ lệ đúng hạn theo tháng */
function buildOnTimeSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = addTitledSlide(pptx, '3. Tỷ lệ hoàn thành đúng hạn theo tháng');
  addTable(
    slide,
    ['Tháng', 'Tổng nhiệm vụ', 'Đúng hạn', 'Tỷ lệ (%)'],
    summary.onTimeRateByMonth.map((row) => [
      row.month,
      formatNumber(row.total),
      formatNumber(row.onTime),
      formatNumber(row.rate),
    ]),
    [CONTENT_W * 0.34, CONTENT_W * 0.22, CONTENT_W * 0.22, CONTENT_W * 0.22],
  );
}

/** Slide phản ánh theo lĩnh vực */
function buildFeedbackSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = addTitledSlide(pptx, '4. Phản ánh người dân theo lĩnh vực');
  addTable(
    slide,
    ['Lĩnh vực', 'Số phiếu', 'Đã xử lý', 'Tỷ lệ xử lý (%)'],
    summary.feedbackByCategory.map((row) => [
      row.label,
      formatNumber(row.total),
      formatNumber(row.resolved),
      formatNumber(row.resolveRate),
    ]),
    [CONTENT_W * 0.4, CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.2],
  );
}

/** Slide giải ngân theo nguồn vốn */
function buildDisbursementSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = addTitledSlide(pptx, `5. Giải ngân năm ${summary.year} (tỷ đồng)`);
  addTable(
    slide,
    ['Nguồn vốn', 'Kế hoạch', 'Đã giải ngân', 'Tỷ lệ (%)'],
    summary.disbursementByFunding.map((row) => [
      row.fundingSource,
      formatNumber(row.planned),
      formatNumber(row.actual),
      formatNumber(row.percent),
    ]),
    [CONTENT_W * 0.4, CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.2],
  );
}

/** Slide xếp hạng bộ phận */
function buildRankingSlide(pptx: PptxGenJS, summary: ReportSummary): void {
  const slide = addTitledSlide(pptx, '6. Xếp hạng bộ phận theo tỷ lệ đúng hạn');
  addTable(
    slide,
    ['Hạng', 'Bộ phận', 'Tổng', 'Đúng hạn', 'Trễ hạn', 'Tỷ lệ (%)'],
    summary.departmentRanking.map((row) => [
      formatNumber(row.rank),
      row.department,
      formatNumber(row.total),
      formatNumber(row.onTime),
      formatNumber(row.late),
      formatNumber(row.onTimeRate),
    ]),
    [
      CONTENT_W * 0.08,
      CONTENT_W * 0.36,
      CONTENT_W * 0.14,
      CONTENT_W * 0.14,
      CONTENT_W * 0.14,
      CONTENT_W * 0.14,
    ],
  );
}

/** Slide nội dung có dải tiêu đề — dùng chung cho mọi slide số liệu */
function addTitledSlide(pptx: PptxGenJS, title: string): PptxGenJS.Slide {
  const slide = pptx.addSlide();
  slide.addText(title, {
    x: MARGIN_X,
    y: TITLE_Y,
    w: CONTENT_W,
    h: 0.6,
    fontSize: FONT_SLIDE_TITLE,
    bold: true,
    color: COLOR_NAVY,
  });
  return slide;
}

/**
 * Bảng số liệu chiếm vùng nội dung của slide.
 *
 * Cắt còn MAX_TABLE_ROWS dòng và ghi rõ đã cắt bao nhiêu: slide 16:9 không đủ
 * chỗ cho danh sách dài, mà bảng tràn ra ngoài khung thì người xem không hề
 * biết là mình đang thiếu số liệu. Bản Excel/PDF vẫn có đủ.
 */
function addTable(
  slide: PptxGenJS.Slide,
  headers: string[],
  rows: string[][],
  colW: number[],
): void {
  const visible = rows.slice(0, MAX_TABLE_ROWS);
  const hidden = rows.length - visible.length;

  const body: PptxGenJS.TableRow[] = [
    headers.map((text) => ({
      text,
      options: { bold: true, fill: { color: COLOR_HEADER_BG }, color: COLOR_NAVY },
    })),
  ];

  if (visible.length > 0) {
    for (const row of visible) {
      body.push(row.map((text) => ({ text, options: { color: COLOR_TEXT } })));
    }
  } else {
    body.push([
      {
        text: 'Không có dữ liệu trong kỳ',
        options: { colspan: headers.length, italic: true, color: COLOR_MUTED },
      },
    ]);
  }

  if (hidden > 0) {
    body.push([
      {
        text: `… và ${hidden} dòng nữa — xem bản Excel/PDF để có đầy đủ`,
        options: { colspan: headers.length, italic: true, color: COLOR_MUTED },
      },
    ]);
  }

  slide.addTable(body, {
    x: MARGIN_X,
    y: BODY_Y,
    w: CONTENT_W,
    h: BODY_H,
    colW,
    fontSize: FONT_TABLE,
    border: { type: 'solid', color: 'D5DDE8', pt: 0.5 },
    valign: 'middle',
    autoPage: false,
  });
}
