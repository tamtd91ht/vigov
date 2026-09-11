import {
  MAX_VND,
  formatVnd,
  formatVndShort,
  isValidVnd,
  percentOf,
  sumVnd,
  tyDongToVnd,
} from './vnd';

/**
 * Test tiền Việt Nam.
 *
 * Bộ test này tồn tại vì mô hình cũ (số thực đơn vị tỷ đồng, làm tròn 2 chữ số
 * thập phân) làm mất tiền thật khi lưu. Ba test đầu khoá lại đúng những con số
 * đã từng sai, để mô hình cũ không quay lại.
 */

describe('vnd — giữ đúng từng đồng', () => {
  it('KHÔNG làm tròn số tiền lẻ', () => {
    // Ba con số này bị mô hình cũ làm lệch: 823tr → 820tr, 1.234.567.890 →
    // 1.230.000.000, 55tr → 60tr
    expect(formatVnd(823_000_000)).toBe('823.000.000 đồng');
    expect(formatVnd(1_234_567_890)).toBe('1.234.567.890 đồng');
    expect(formatVnd(55_000_000)).toBe('55.000.000 đồng');
  });

  it('tổng luôn khớp từng đồng với các số hạng', () => {
    const chungTu = [823_000_000, 1_234_567_890, 55_000_000, 7];
    expect(sumVnd(chungTu)).toBe(2_112_567_897);
  });

  it('cộng nhiều lần liên tiếp không sinh sai số tích luỹ', () => {
    // Mô hình cũ cộng số thực rồi làm tròn từng bước, sai số dồn lại
    let luyKe = 0;
    for (let i = 0; i < 1000; i += 1) luyKe += 1_234_567;
    expect(luyKe).toBe(1_234_567_000);
  });
});

describe('isValidVnd', () => {
  it('chỉ nhận số nguyên không âm trong ngưỡng', () => {
    expect(isValidVnd(0)).toBe(true);
    expect(isValidVnd(1_000_000_000)).toBe(true);
    expect(isValidVnd(MAX_VND)).toBe(true);
  });

  it('từ chối số âm, số thập phân, và số vượt ngưỡng', () => {
    // Số thập phân bị từ chối thẳng: cho vào là quay lại mô hình cũ
    expect(isValidVnd(-1)).toBe(false);
    expect(isValidVnd(1_000_000.5)).toBe(false);
    expect(isValidVnd(MAX_VND + 1)).toBe(false);
    expect(isValidVnd('1000000')).toBe(false);
    expect(isValidVnd(Number.NaN)).toBe(false);
  });
});

describe('formatVndShort — chỉ để hiển thị tổng quan', () => {
  it('viết gọn theo bậc tỷ / triệu / nghìn, dấu phẩy thập phân kiểu Việt Nam', () => {
    expect(formatVndShort(1_230_000_000)).toBe('1,23 tỷ đồng');
    expect(formatVndShort(2_000_000_000)).toBe('2 tỷ đồng');
    expect(formatVndShort(850_000_000)).toBe('850 triệu đồng');
    expect(formatVndShort(45_000)).toBe('45 nghìn đồng');
    expect(formatVndShort(700)).toBe('700 đồng');
  });

  it('số 0 hiện "0 đồng", không hiện rỗng', () => {
    expect(formatVndShort(0)).toBe('0 đồng');
  });
});

describe('percentOf', () => {
  it('tính trên số nguyên, hai chữ số thập phân', () => {
    expect(percentOf(823_000_000, 1_000_000_000)).toBe(82.3);
    expect(percentOf(1, 3)).toBe(33.33);
  });

  it('mẫu số 0 trả null — "chưa có kế hoạch vốn" KHÁC "giải ngân 0%"', () => {
    expect(percentOf(0, 0)).toBeNull();
    expect(percentOf(500, 0)).toBeNull();
  });

  it('giải ngân 0 đồng trên kế hoạch có thật thì trả 0, không trả null', () => {
    expect(percentOf(0, 1_000_000_000)).toBe(0);
  });
});

describe('tyDongToVnd — chỉ dùng trong script di trú', () => {
  it('quy đổi tỷ đồng sang đồng, làm tròn tới đồng', () => {
    expect(tyDongToVnd(1.23)).toBe(1_230_000_000);
    expect(tyDongToVnd(0.8)).toBe(800_000_000);
    expect(tyDongToVnd(0)).toBe(0);
  });

  it('không sinh số thập phân do sai số dấu phẩy động', () => {
    // 0,07 × 1e9 trong số thực là 70000000.00000001
    expect(Number.isInteger(tyDongToVnd(0.07))).toBe(true);
    expect(tyDongToVnd(0.07)).toBe(70_000_000);
  });
});
