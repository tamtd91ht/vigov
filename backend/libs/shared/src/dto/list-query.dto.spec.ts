import { buildDateRangeFilter, dateRangeLabel, toStringArray } from './list-query.dto';

/**
 * Hai thứ được khoá ở đây đều là chỗ đã từng làm lệch số liệu báo cáo ở các dự
 * án tương tự: mốc cuối kỳ bị cắt mất một ngày, và ngày bị lệch vì tính theo
 * giờ máy chủ (container chạy UTC) thay vì giờ Việt Nam.
 */

describe('toStringArray', () => {
  it('quy chuỗi đơn và mảng về cùng một dạng mảng', () => {
    expect(toStringArray('moi')).toEqual(['moi']);
    expect(toStringArray(['moi', 'dang-lam'])).toEqual(['moi', 'dang-lam']);
  });

  it('bỏ giá trị rỗng và khoảng trắng thừa', () => {
    expect(toStringArray(['  moi  ', '', '   '])).toEqual(['moi']);
  });

  it('không có giá trị nào thì trả undefined, KHÔNG trả mảng rỗng', () => {
    // Mảng rỗng đi vào `$in: []` sẽ khớp KHÔNG bản ghi nào — bảng trắng trơn
    // trong khi người dùng tưởng mình chưa lọc gì
    expect(toStringArray(undefined)).toBeUndefined();
    expect(toStringArray('')).toBeUndefined();
    expect(toStringArray([''])).toBeUndefined();
  });

  it('vẫn nhận dạng phân tách bằng dấu phẩy khi gọi API bằng tay', () => {
    expect(toStringArray('moi,dang-lam')).toEqual(['moi', 'dang-lam']);
  });
});

describe('buildDateRangeFilter', () => {
  it('mốc đầu là 00:00 giờ VIỆT NAM, không phải giờ máy chủ', () => {
    const f = buildDateRangeFilter('createdAt', '2026-03-01') as { createdAt: { $gte: Date } };
    // 00:00 ngày 01/03 giờ Việt Nam = 17:00 ngày 28/02 UTC
    expect(f.createdAt.$gte.toISOString()).toBe('2026-02-28T17:00:00.000Z');
  });

  it('mốc cuối là 00:00 ngày KẾ TIẾP với $lt — không cắt mất ngày cuối kỳ', () => {
    const f = buildDateRangeFilter('createdAt', undefined, '2026-03-31') as {
      createdAt: { $lt: Date };
    };
    // Hết ngày 31/03 giờ Việt Nam = 17:00 ngày 31/03 UTC
    expect(f.createdAt.$lt.toISOString()).toBe('2026-03-31T17:00:00.000Z');
  });

  it('bản ghi lúc 23h59 ngày cuối kỳ vẫn nằm trong khoảng', () => {
    const f = buildDateRangeFilter('createdAt', '2026-03-01', '2026-03-31') as {
      createdAt: { $gte: Date; $lt: Date };
    };
    const cuoiNgay = new Date('2026-03-31T23:59:59+07:00');

    expect(cuoiNgay >= f.createdAt.$gte).toBe(true);
    expect(cuoiNgay < f.createdAt.$lt).toBe(true);
  });

  it('bản ghi lúc 00h30 ngày đầu kỳ vẫn nằm trong khoảng', () => {
    const f = buildDateRangeFilter('createdAt', '2026-03-01', '2026-03-31') as {
      createdAt: { $gte: Date; $lt: Date };
    };
    const dauNgay = new Date('2026-03-01T00:30:00+07:00');

    expect(dauNgay >= f.createdAt.$gte).toBe(true);
  });

  it('không có mốc nào thì trả undefined, không trả điều kiện rỗng', () => {
    expect(buildDateRangeFilter('createdAt')).toBeUndefined();
  });
});

describe('dateRangeLabel', () => {
  it('nêu rõ cả hai mốc theo định dạng Việt Nam', () => {
    expect(dateRangeLabel('2026-03-01', '2026-03-31')).toBe('từ 01/03/2026 đến 31/03/2026');
  });

  it('chỉ có một mốc, hoặc không có mốc nào', () => {
    expect(dateRangeLabel('2026-03-01')).toBe('từ 01/03/2026');
    expect(dateRangeLabel(undefined, '2026-03-31')).toBe('đến 31/03/2026');
    expect(dateRangeLabel()).toBe('toàn bộ thời gian');
  });
});
