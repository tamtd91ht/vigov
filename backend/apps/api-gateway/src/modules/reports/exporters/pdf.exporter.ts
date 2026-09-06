import * as path from 'node:path';
/*
 * `import pdfMake = require('pdfmake')` CHỨ KHÔNG `import * as pdfMake`.
 *
 * Gói pdfmake xuất ra một THỰC THỂ của lớp (`module.exports = new pdfmake()`),
 * nên các hàm như `setFonts`/`createPdf` nằm trên prototype. Với
 * `esModuleInterop`, `import * as` đi qua `__importStar`, hàm này chỉ chép các
 * thuộc tính SỞ HỮU TRỰC TIẾP — phương thức prototype bị mất và lời gọi hỏng ở
 * lúc chạy ("setFonts is not a function") dù TypeScript vẫn biên dịch sạch.
 */
import pdfMake = require('pdfmake');
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ReportSummary, ReportTotals } from '../reports.service';

/**
 * Bộ kết xuất báo cáo PDF (WBS #8, #27).
 *
 * VÌ SAO `pdfmake` CHỨ KHÔNG `pdfkit`: pdfkit mặc định dùng 14 font chuẩn của
 * PDF (Helvetica…), vốn chỉ có bảng mã WinAnsi — mọi chữ có dấu tiếng Việt ra
 * ô vuông hoặc mất dấu. pdfmake đi kèm sẵn bộ Roboto TTF đủ dấu và tự NHÚNG
 * font vào tệp, nên tệp mở đúng trên mọi máy kể cả máy không cài Roboto.
 *
 * Không ghi ra đĩa — controller nhận Buffer rồi trả thẳng về client, giống cách
 * excel.exporter đang làm.
 */

/** Cỡ và lề trang — A4 dọc, lề vừa đủ để in trực tiếp */
const PAGE_SIZE = 'A4';
const PAGE_MARGINS: [number, number, number, number] = [32, 36, 32, 44];

/** Cỡ chữ */
const FONT_SIZE_BASE = 9;
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_SECTION = 11;

/** Màu nền dòng tiêu đề bảng — cùng tông với sheet Excel (FFE8F0FE) */
const HEADER_FILL = '#e8f0fe';
const MUTED_COLOR = '#5b6c8f';
const BORDER_COLOR = '#d5dde8';

/** Tên font duy nhất dùng trong tài liệu */
const FONT_NAME = 'Roboto';

/** Tệp font Roboto đi kèm gói pdfmake — nguồn duy nhất có đủ dấu tiếng Việt */
const ROBOTO_FILES = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italic.ttf',
  bolditalics: 'Roboto-MediumItalic.ttf',
} as const;

/**
 * pdfmake là một THỰC THỂ DÙNG CHUNG cho cả tiến trình (`module.exports = new
 * pdfmake()`), nên `setFonts` chỉ cần gọi một lần. Cờ này chặn việc nạp lại
 * font ở mỗi lần xuất báo cáo.
 */
let fontsReady = false;

/** Thư mục chứa Roboto trong gói pdfmake đã cài */
function robotoDir(): string {
  return path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
}

/**
 * Nạp font và siết quyền truy cập tài nguyên của pdfmake.
 *
 * Hai chính sách truy cập là bắt buộc về mặt an toàn: nội dung tài liệu pdfmake
 * dựng có thể tham chiếu ảnh theo URL hoặc theo đường dẫn cục bộ. Chặn hết URL
 * và chỉ cho đọc đúng thư mục font nghĩa là dù về sau ai thêm dữ liệu người
 * dùng vào tài liệu, tiến trình cũng không bị dụ đi đọc tệp nội bộ hay gọi ra
 * mạng (SSRF). Không khai thì pdfmake còn ghi cảnh báo ở nhật ký mỗi lần xuất.
 */
function ensureFonts(): void {
  if (fontsReady) return;
  const dir = robotoDir();

  pdfMake.setFonts({
    [FONT_NAME]: {
      normal: path.join(dir, ROBOTO_FILES.normal),
      bold: path.join(dir, ROBOTO_FILES.bold),
      italics: path.join(dir, ROBOTO_FILES.italics),
      bolditalics: path.join(dir, ROBOTO_FILES.bolditalics),
    },
  });
  pdfMake.setLocalAccessPolicy((filePath) => path.resolve(filePath).startsWith(path.resolve(dir)));
  pdfMake.setUrlAccessPolicy(() => false);

  fontsReady = true;
}

/** Tên tệp tải về: bao-cao-vigov-<period>-<year>.pdf */
export function reportPdfFileName(period: string, year: number): string {
  return `bao-cao-vigov-${period}-${year}.pdf`;
}

/**
 * Dựng tệp PDF báo cáo tổng hợp và trả về Buffer.
 * Nội dung bám sát ReportSummary — cùng bộ số liệu với bản Excel.
 */
export async function buildReportPdf(summary: ReportSummary): Promise<Buffer> {
  ensureFonts();
  return pdfMake.createPdf(buildDocDefinition(summary)).getBuffer();
}

/** Định nghĩa tài liệu pdfmake */
function buildDocDefinition(summary: ReportSummary): TDocumentDefinitions {
  return {
    pageSize: PAGE_SIZE,
    pageMargins: PAGE_MARGINS,
    info: {
      title: `Báo cáo tổng hợp ViGov — ${summary.range.label}`,
      author: 'ViGov',
      creator: 'ViGov',
    },
    defaultStyle: { font: FONT_NAME, fontSize: FONT_SIZE_BASE },
    styles: {
      title: { fontSize: FONT_SIZE_TITLE, bold: true },
      subtitle: { fontSize: FONT_SIZE_BASE + 1, color: MUTED_COLOR },
      section: { fontSize: FONT_SIZE_SECTION, bold: true, margin: [0, 14, 0, 6] },
      note: { fontSize: FONT_SIZE_BASE - 1, color: MUTED_COLOR, italics: true },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Trang ${currentPage}/${pageCount} · Hệ thống điều hành số ViGov`,
      alignment: 'center',
      fontSize: FONT_SIZE_BASE - 1,
      color: MUTED_COLOR,
      margin: [0, 12, 0, 0],
    }),
    content: [
      { text: 'BÁO CÁO TỔNG HỢP ĐIỀU HÀNH', style: 'title' },
      { text: summary.range.label, style: 'subtitle', margin: [0, 4, 0, 0] },
      {
        text: `Kỳ báo cáo: ${summary.period} · Năm ${summary.year} · Kết xuất ngày ${formatDate(new Date())}`,
        style: 'note',
        margin: [0, 2, 0, 0],
      },

      { text: '1. Số liệu tổng hợp trong kỳ', style: 'section' },
      totalsTable(summary.totals),
      ...comparisonBlock(summary),

      { text: '2. Nhiệm vụ theo bộ phận', style: 'section' },
      simpleTable(
        ['Bộ phận', 'Số nhiệm vụ'],
        summary.tasksByDepartment.map((row) => [row.department, formatNumber(row.total)]),
        ['*', 80],
      ),

      { text: '3. Tỷ lệ hoàn thành đúng hạn theo tháng', style: 'section' },
      simpleTable(
        ['Tháng', 'Tổng nhiệm vụ', 'Đúng hạn', 'Tỷ lệ (%)'],
        summary.onTimeRateByMonth.map((row) => [
          row.month,
          formatNumber(row.total),
          formatNumber(row.onTime),
          formatNumber(row.rate),
        ]),
        ['*', 90, 80, 70],
      ),

      { text: '4. Phản ánh người dân theo lĩnh vực', style: 'section', pageBreak: 'before' },
      simpleTable(
        ['Lĩnh vực', 'Số phiếu', 'Đã xử lý', 'Tỷ lệ xử lý (%)'],
        summary.feedbackByCategory.map((row) => [
          row.label,
          formatNumber(row.total),
          formatNumber(row.resolved),
          formatNumber(row.resolveRate),
        ]),
        ['*', 70, 70, 100],
      ),

      { text: '5. Giải ngân theo nguồn vốn (tỷ đồng)', style: 'section' },
      simpleTable(
        ['Nguồn vốn', 'Kế hoạch', 'Đã giải ngân', 'Tỷ lệ (%)'],
        summary.disbursementByFunding.map((row) => [
          row.fundingSource,
          formatNumber(row.planned),
          formatNumber(row.actual),
          formatNumber(row.percent),
        ]),
        ['*', 80, 90, 70],
      ),

      { text: '6. Xếp hạng bộ phận theo tỷ lệ đúng hạn', style: 'section' },
      simpleTable(
        ['Hạng', 'Bộ phận', 'Tổng', 'Đúng hạn', 'Trễ hạn', 'Tỷ lệ (%)'],
        summary.departmentRanking.map((row) => [
          formatNumber(row.rank),
          row.department,
          formatNumber(row.total),
          formatNumber(row.onTime),
          formatNumber(row.late),
          formatNumber(row.onTimeRate),
        ]),
        [40, '*', 50, 65, 60, 65],
      ),
    ],
  };
}

/** Bảng hai cột "chỉ tiêu — giá trị" cho phần số liệu tổng */
function totalsTable(totals: ReportTotals): Content {
  return simpleTable(
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
    ['*', 120],
  );
}

/** Khối so sánh với kỳ trước — chỉ có khi gọi API với compare=true */
function comparisonBlock(summary: ReportSummary): Content[] {
  const comparison = summary.comparison;
  if (!comparison) {
    return [
      { text: 'Không kèm số liệu so sánh kỳ trước (gọi với compare=true để có).', style: 'note' },
    ];
  }

  return [
    { text: `So sánh với ${comparison.previousLabel}`, style: 'section' },
    simpleTable(
      ['Chỉ tiêu', 'Kỳ trước', 'Chênh lệch'],
      [
        ['Tổng nhiệm vụ', formatNumber(comparison.previous.tasks), formatDelta(comparison.delta.tasks)],
        [
          'Tỷ lệ đúng hạn (%)',
          formatNumber(comparison.previous.onTimeRate),
          formatDelta(comparison.delta.onTimeRate),
        ],
        ['Tổng phản ánh', formatNumber(comparison.previous.feedbacks), formatDelta(comparison.delta.feedbacks)],
        [
          'Tỷ lệ giải ngân (%)',
          formatNumber(comparison.previous.disbursementPercent),
          formatDelta(comparison.delta.disbursementPercent),
        ],
      ],
      ['*', 100, 100],
    ),
  ];
}

/**
 * Bảng có dòng tiêu đề tô nền.
 * Bảng rỗng vẫn in một dòng "Không có dữ liệu" thay vì để trống — người đọc cần
 * phân biệt "kỳ này không có số liệu" với "phần này bị lỗi khi kết xuất".
 */
function simpleTable(headers: string[], rows: string[][], widths: (string | number)[]): Content {
  const body =
    rows.length > 0
      ? rows
      : [
          [
            {
              text: 'Không có dữ liệu trong kỳ',
              colSpan: headers.length,
              color: MUTED_COLOR,
              italics: true,
            },
          ],
        ];

  return {
    table: {
      headerRows: 1,
      widths,
      body: [headers.map((text) => ({ text, bold: true, fillColor: HEADER_FILL })), ...body],
    },
    layout: {
      hLineColor: () => BORDER_COLOR,
      vLineColor: () => BORDER_COLOR,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  } as Content;
}

/**
 * Số theo quy ước Việt Nam: dấu chấm phân nhóm nghìn, dấu phẩy thập phân.
 *
 * Tự định dạng chứ không dùng `toLocaleString('vi-VN')`: bản Node thiếu ICU đầy
 * đủ sẽ lặng lẽ rơi về định dạng en-US, và báo cáo in ra sai quy ước mà không
 * có lỗi nào báo.
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  const [whole, fraction] = Math.abs(rounded).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

/** Chênh lệch so kỳ trước, luôn kèm dấu để đọc nhanh chiều tăng/giảm */
export function formatDelta(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

/** dd/MM/yyyy */
function formatDate(value: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(value.getDate())}/${p(value.getMonth() + 1)}/${value.getFullYear()}`;
}
