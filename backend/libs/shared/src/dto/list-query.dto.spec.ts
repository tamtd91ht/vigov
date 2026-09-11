import { dateRangeLabel, toStringArray } from './list-query.dto';

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

/*
 * Các phép kiểm cho bộ lọc khoảng thời gian đã chuyển sang
 * `libs/shared/src/time/epoch.spec.ts` cùng với `buildEpochRangeFilter` —
 * nâng cấp v2 lọc trên trường số thay vì `Date`.
 */

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
