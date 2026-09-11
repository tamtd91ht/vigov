import { Workbook, type Worksheet } from 'exceljs';

/**
 * Bộ xuất Excel dùng chung cho MỌI bảng danh sách (nhiệm vụ, văn bản, phản ánh,
 * giải ngân).
 *
 * VÌ SAO MỘT BỘ DÙNG CHUNG: bốn phân hệ tự làm bốn biểu mẫu là bốn kiểu trình
 * bày trong cùng một bộ hồ sơ gửi lên cấp trên. Ở đây thống nhất phần khung
 * (tiêu đề cơ quan, kỳ báo cáo, chân trang truy vết), mỗi phân hệ chỉ khai
 * TÊN CỘT và cách lấy giá trị từng dòng.
 *
 * Biểu mẫu theo lối văn bản hành chính Việt Nam:
 *   dòng 1  tên cơ quan chủ quản (đọc từ cấu hình, KHÔNG viết cứng)
 *   dòng 2  tên đơn vị ban hành
 *   dòng 4  TIÊU ĐỀ BẢNG BIỂU, in hoa, đậm
 *   dòng 5  kỳ số liệu — nêu rõ mốc đầu và mốc cuối
 *   dòng 6  bộ lọc đang áp dụng (để người nhận biết bảng này lọc theo gì)
 *   dòng 8  hàng tiêu đề cột, có cột "STT"
 *   ...     dữ liệu
 *   cuối    tổng số bản ghi, thời điểm xuất, người xuất
 */

/** Một cột trong bảng xuất */
export interface ListColumn<T> {
  header: string;
  /** Lấy giá trị ô từ một bản ghi. Trả rỗng thì ô để trống */
  value: (row: T) => string | number | null | undefined;
  /** Độ rộng cột (ký tự). Bỏ trống thì tự tính theo nội dung */
  width?: number;
  /** Căn phải cho cột số / tiền */
  numeric?: boolean;
}

export interface ListExportMeta {
  /** Tên bảng, ví dụ "DANH SÁCH NHIỆM VỤ" */
  title: string;
  /** Tên đơn vị ban hành, đọc từ cấu hình */
  orgName: string;
  /** Cơ quan chủ quản, đọc từ cấu hình. Rỗng thì bỏ dòng này */
  orgParent?: string;
  /** Kỳ số liệu, ví dụ "từ 01/03/2026 đến 31/03/2026" */
  periodLabel: string;
  /** Mô tả bộ lọc đang áp dụng; rỗng thì ghi "không áp dụng bộ lọc" */
  filterLabel?: string;
  /** Tên đăng nhập của cán bộ xuất — để truy được ai lấy dữ liệu này */
  exportedBy: string;
  /** Tên sheet; bỏ trống thì dùng "Danh sách" */
  sheetName?: string;
}

const HEADER_FILL = 'FFE8F0FE';
const BORDER_COLOR = 'FFBFCBD9';
const MIN_WIDTH = 8;
const MAX_WIDTH = 60;
const STT_WIDTH = 6;

/** Định dạng ngày giờ Việt Nam cho dòng "Xuất lúc" ở chân bảng */
function vnDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  // Quy về giờ Việt Nam bất kể múi giờ máy chủ — container thường chạy UTC
  const vn = new Date(d.getTime() + 7 * 60 * 60_000);
  return (
    `${p(vn.getUTCDate())}/${p(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ` +
    `${p(vn.getUTCHours())}:${p(vn.getUTCMinutes())}`
  );
}

/**
 * Dựng workbook một sheet cho một bảng danh sách.
 * Không ghi ra tệp — controller stream thẳng về client.
 */
export function buildListWorkbook<T>(
  rows: T[],
  columns: ListColumn<T>[],
  meta: ListExportMeta,
): Workbook {
  const workbook = new Workbook();
  workbook.creator = meta.orgName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(meta.sheetName ?? 'Danh sách', {
    // Bảng danh sách luôn nhiều cột hơn chiều cao trang → in ngang
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const colCount = columns.length + 1; // +1 cho cột STT
  writeLetterHead(sheet, meta, colCount);
  const headerRowIndex = writeColumnHeader(sheet, columns);
  writeRows(sheet, rows, columns);
  writeFooter(sheet, rows.length, meta, colCount);
  applyWidths(sheet, columns);

  // Cố định phần khung + hàng tiêu đề: bảng dài vài trăm dòng mà cuộn mất tiêu
  // đề cột thì người đọc không biết cột nào là cột nào
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: colCount },
  };

  return workbook;
}

/**
 * Mô tả bộ lọc đang áp dụng để in lên đầu bảng.
 *
 * Người nhận bảng biểu phải biết bảng này lọc theo gì, nếu không họ so hai bảng
 * lọc khác nhau rồi kết luận số liệu sai. Chỉ nhận nhãn đã dịch sang tiếng
 * Việt — nơi gọi tự đổi mã trạng thái thành nhãn trước khi truyền vào.
 */
export function describeFilters(pairs: Record<string, string | string[] | undefined>): string {
  const parts: string[] = [];
  for (const [label, value] of Object.entries(pairs)) {
    const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
    if (text && text.trim()) parts.push(`${label}: ${text.trim()}`);
  }
  return parts.join(' · ');
}

/** Tên tệp: khong-dau-<slug>-<yyyyMMdd-HHmm>.xlsx — không chứa dữ liệu cá nhân */
export function listExportFileName(slug: string, at = new Date()): string {
  const vn = new Date(at.getTime() + 7 * 60 * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}` +
    `-${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}`;
  return `${slug}-${stamp}.xlsx`;
}

/** Phần đầu biểu mẫu: cơ quan, tiêu đề, kỳ số liệu, bộ lọc */
function writeLetterHead<T>(sheet: Worksheet, meta: ListExportMeta, colCount: number): void {
  const line = (text: string, style: Partial<{ bold: boolean; size: number }> = {}) => {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, colCount);
    row.getCell(1).font = { bold: style.bold ?? false, size: style.size ?? 11 };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    return row;
  };

  if (meta.orgParent) line(meta.orgParent.toUpperCase(), { size: 10 });
  line(meta.orgName.toUpperCase(), { bold: true, size: 11 });
  line('');
  line(meta.title.toUpperCase(), { bold: true, size: 14 }).height = 24;
  line(`Kỳ số liệu: ${meta.periodLabel}`, { size: 10 });
  line(`Bộ lọc: ${meta.filterLabel?.trim() || 'không áp dụng bộ lọc'}`, { size: 10 });
  line('');
}

/** Hàng tiêu đề cột; trả về số hàng để cố định và bật lọc */
function writeColumnHeader<T>(sheet: Worksheet, columns: ListColumn<T>[]): number {
  const row = sheet.addRow(['STT', ...columns.map((c) => c.header)]);
  row.height = 20;
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10.5 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = allBorders();
  });
  return row.number;
}

function writeRows<T>(sheet: Worksheet, rows: T[], columns: ListColumn<T>[]): void {
  if (rows.length === 0) {
    // Bảng rỗng phải nói rõ là rỗng, không để người đọc tưởng tệp lỗi
    const row = sheet.addRow(['', 'Chưa có dữ liệu phù hợp bộ lọc']);
    sheet.mergeCells(row.number, 2, row.number, columns.length + 1);
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(2).font = { italic: true };
    return;
  }

  rows.forEach((item, index) => {
    const values = columns.map((c) => {
      const v = c.value(item);
      return v === null || v === undefined ? '' : v;
    });
    const row = sheet.addRow([index + 1, ...values]);
    row.eachCell((cell, colNumber) => {
      cell.border = allBorders();
      cell.alignment =
        colNumber === 1
          ? { horizontal: 'center', vertical: 'top' }
          : columns[colNumber - 2]?.numeric
            ? { horizontal: 'right', vertical: 'top' }
            : { horizontal: 'left', vertical: 'top', wrapText: true };
      cell.font = { size: 10.5 };
    });
  });
}

/** Chân bảng: tổng số bản ghi + vết ai xuất, lúc nào */
function writeFooter(sheet: Worksheet, count: number, meta: ListExportMeta, colCount: number): void {
  sheet.addRow([]);
  const total = sheet.addRow(['', `Tổng số: ${count} bản ghi`]);
  total.getCell(2).font = { bold: true, size: 10.5 };

  const stamp = sheet.addRow([
    '',
    `Xuất lúc ${vnDateTime(new Date())} (giờ Việt Nam) · Người xuất: ${meta.exportedBy}`,
  ]);
  sheet.mergeCells(stamp.number, 2, stamp.number, colCount);
  stamp.getCell(2).font = { italic: true, size: 9.5, color: { argb: 'FF6B7A8C' } };
}

function applyWidths<T>(sheet: Worksheet, columns: ListColumn<T>[]): void {
  sheet.getColumn(1).width = STT_WIDTH;
  columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 2);
    if (col.width) {
      column.width = col.width;
      return;
    }
    // Tự tính theo nội dung dài nhất, có chặn hai đầu để không ra cột 300 ký tự
    let longest = col.header.length;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > longest) longest = len;
    });
    column.width = Math.min(Math.max(longest + 2, MIN_WIDTH), MAX_WIDTH);
  });
}

function allBorders() {
  const side = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
  return { top: side, left: side, bottom: side, right: side };
}
