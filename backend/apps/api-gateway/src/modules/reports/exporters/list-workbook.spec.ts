import type { Worksheet } from 'exceljs';
import {
  buildListWorkbook,
  describeFilters,
  listExportFileName,
  type ListColumn,
} from './list-workbook';

/**
 * Test bộ xuất Excel dùng chung.
 *
 * Trọng tâm là những thứ làm một bảng biểu gửi cấp trên trở thành sai: tên đơn
 * vị bị viết cứng, kỳ số liệu không ghi rõ, bảng rỗng trông như tệp lỗi, và số
 * 0 bị hiện thành ô trống.
 */

interface Row {
  code: string;
  name: string;
  progress: number;
}

const COLUMNS: ListColumn<Row>[] = [
  { header: 'Mã', value: (r) => r.code },
  { header: 'Tên', value: (r) => r.name },
  { header: 'Tiến độ', value: (r) => `${r.progress}%`, numeric: true },
];

const META = {
  title: 'Danh sách nhiệm vụ',
  orgName: 'UBND xã Kiểm Thử',
  orgParent: 'Huyện Kiểm Thử · Tỉnh Kiểm Thử',
  periodLabel: 'từ 01/03/2026 đến 31/03/2026',
  filterLabel: 'Bộ phận: Văn phòng',
  exportedBy: 'canbo.a',
};

/** Số hàng đang được cố định (kiểu WorksheetView của exceljs không lộ ySplit) */
function frozenRow(sheet: Worksheet): number {
  return (sheet.views[0] as unknown as { ySplit?: number })?.ySplit ?? 0;
}

/** Toàn bộ chữ trong sheet, ghép lại để tìm nhanh một câu có xuất hiện không */
function allText(sheet: Worksheet): string {
  const parts: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => parts.push(String(cell.value ?? '')));
  });
  return parts.join('\n');
}

describe('buildListWorkbook', () => {
  const rows: Row[] = [
    { code: 'NV-01', name: 'Rà soát hồ sơ', progress: 0 },
    { code: 'NV-02', name: 'Kiểm tra hiện trường', progress: 50 },
  ];

  it('in tên đơn vị lấy từ cấu hình, KHÔNG viết cứng tên xã nào', () => {
    const sheet = buildListWorkbook(rows, COLUMNS, META).worksheets[0];
    const text = allText(sheet);

    expect(text).toContain('UBND XÃ KIỂM THỬ');
    expect(text).toContain('HUYỆN KIỂM THỬ · TỈNH KIỂM THỬ');
  });

  it('ghi rõ kỳ số liệu với cả hai mốc và bộ lọc đang áp dụng', () => {
    const sheet = buildListWorkbook(rows, COLUMNS, META).worksheets[0];
    const text = allText(sheet);

    expect(text).toContain('Kỳ số liệu: từ 01/03/2026 đến 31/03/2026');
    expect(text).toContain('Bộ lọc: Bộ phận: Văn phòng');
  });

  it('không có bộ lọc thì nói rõ là không lọc, không để trống gây hiểu nhầm', () => {
    const sheet = buildListWorkbook(rows, COLUMNS, { ...META, filterLabel: '' }).worksheets[0];

    expect(allText(sheet)).toContain('Bộ lọc: không áp dụng bộ lọc');
  });

  it('ghi vết ai xuất và tổng số bản ghi ở chân bảng', () => {
    const sheet = buildListWorkbook(rows, COLUMNS, META).worksheets[0];
    const text = allText(sheet);

    expect(text).toContain('Tổng số: 2 bản ghi');
    expect(text).toContain('Người xuất: canbo.a');
    expect(text).toContain('giờ Việt Nam');
  });

  it('có cột STT và đủ hàng dữ liệu, đánh số từ 1', () => {
    const sheet = buildListWorkbook(rows, COLUMNS, META).worksheets[0];
    const header = sheet.getRow(frozenRow(sheet));

    expect(header.getCell(1).value).toBe('STT');
    expect(header.getCell(2).value).toBe('Mã');
    // Hàng dữ liệu đầu tiên nằm ngay sau hàng tiêu đề
    const first = sheet.getRow(header.number + 1);
    expect(first.getCell(1).value).toBe(1);
    expect(first.getCell(2).value).toBe('NV-01');
  });

  it('giá trị 0 hiện "0%", KHÔNG để ô trống', () => {
    // Ô trống làm người đọc tưởng chưa có số liệu, khác hẳn với tiến độ bằng 0
    const sheet = buildListWorkbook(rows, COLUMNS, META).worksheets[0];

    expect(allText(sheet)).toContain('0%');
  });

  it('bảng rỗng thì nói rõ là rỗng thay vì để trắng như tệp lỗi', () => {
    const sheet = buildListWorkbook([], COLUMNS, META).worksheets[0];
    const text = allText(sheet);

    expect(text).toContain('Chưa có dữ liệu phù hợp bộ lọc');
    expect(text).toContain('Tổng số: 0 bản ghi');
  });

  it('cố định hàng tiêu đề và bật lọc trên đúng hàng đó', () => {
    const wb = buildListWorkbook(rows, COLUMNS, META);
    const sheet = wb.worksheets[0];
    const frozen = frozenRow(sheet);

    expect(frozen).toBeGreaterThan(0);
    expect(sheet.autoFilter).toEqual({
      from: { row: frozen, column: 1 },
      to: { row: frozen, column: COLUMNS.length + 1 },
    });
  });

  it('in ngang và co vừa chiều rộng trang — bảng nhiều cột', () => {
    const sheet = buildListWorkbook(rows, COLUMNS, META).worksheets[0];

    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.pageSetup.fitToWidth).toBe(1);
  });
});

describe('describeFilters', () => {
  it('ghép các bộ lọc có giá trị, bỏ bộ lọc rỗng', () => {
    expect(
      describeFilters({
        'Bộ phận': 'Văn phòng',
        'Trạng thái': ['Mới giao', 'Đang thực hiện'],
        'Từ khoá': '',
        'Người thực hiện': undefined,
      }),
    ).toBe('Bộ phận: Văn phòng · Trạng thái: Mới giao, Đang thực hiện');
  });

  it('không có bộ lọc nào thì trả chuỗi rỗng', () => {
    expect(describeFilters({ 'Bộ phận': undefined })).toBe('');
  });
});

describe('listExportFileName', () => {
  it('tên tệp có mốc thời gian giờ Việt Nam, không chứa dữ liệu cá nhân', () => {
    // 23:30 UTC ngày 09/09 = 06:30 ngày 10/09 giờ Việt Nam
    const at = new Date('2026-09-09T23:30:00Z');

    expect(listExportFileName('danh-sach-nhiem-vu', at)).toBe(
      'danh-sach-nhiem-vu-20260910-0630.xlsx',
    );
  });
});
