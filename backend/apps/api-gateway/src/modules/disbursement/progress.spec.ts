import type { DisbursementEntry, QuarterPlan } from '@vigov/shared';
import {
  actualFromEntries,
  computeProgress,
  disbursementStateOf,
  parseVnDate,
  planCumulative,
} from './progress';

/**
 * Test tính tiến độ giải ngân.
 *
 * Trọng tâm là những ca mà bản cũ kết luận SAI: hạng mục vừa được giao dự toán
 * đầu năm bị báo "chậm tiến độ" (vì bản cũ chỉ so tỷ lệ giải ngân với ngưỡng
 * 70%, không nhìn thời gian), và hạng mục đã giải ngân đủ nhưng quá hạn cũng bị
 * báo chậm.
 *
 * Mọi số tiền dưới đây là đồng.
 */

const TY = 1_000_000_000;

/** Kế hoạch chia đều 4 quý, mỗi quý 1 tỷ */
const CHIA_DEU: QuarterPlan[] = [1, 2, 3, 4].map((quarter) => ({ quarter, amountDong: TY }));

const NGUONG = { riskRatio: 0.8, dueSoonDays: 30 };

function tinh(over: Partial<Parameters<typeof computeProgress>[0]> = {}) {
  return computeProgress({
    plannedDong: 4 * TY,
    actualDong: 0,
    quarterPlans: CHIA_DEU,
    startDate: '01/01/2026',
    endDate: '31/12/2026',
    year: 2026,
    asOf: new Date(2026, 0, 15),
    thresholds: NGUONG,
    ...over,
  });
}

describe('parseVnDate', () => {
  it('đọc dd/MM/yyyy', () => {
    expect(parseVnDate('05/03/2026')?.getMonth()).toBe(2);
    expect(parseVnDate('5/3/2026')?.getDate()).toBe(5);
  });

  it('từ chối ngày không tồn tại và chuỗi rác', () => {
    // 31/02 bị Date tự nhảy sang 03/03 nếu không chặn — ngày sai vào hồ sơ
    expect(parseVnDate('31/02/2026')).toBeNull();
    expect(parseVnDate('32/01/2026')).toBeNull();
    expect(parseVnDate('2026-03-05')).toBeNull();
    expect(parseVnDate('')).toBeNull();
  });
});

describe('actualFromEntries — hoàn trả trừ vào luỹ kế', () => {
  it('cộng giao dịch chi, TRỪ giao dịch hoàn trả', () => {
    const entries = [
      { type: 'chi', amountDong: 800_000_000 },
      { type: 'chi', amountDong: 150_000_000 },
      { type: 'hoan-tra', amountDong: 50_000_000 },
    ] as DisbursementEntry[];

    expect(actualFromEntries(entries)).toBe(900_000_000);
  });

  it('không có giao dịch nào thì luỹ kế là 0', () => {
    expect(actualFromEntries([])).toBe(0);
  });
});

describe('planCumulative — chỉ tính quý ĐÃ KẾT THÚC', () => {
  it('giữa quý I: chưa quý nào kết thúc nên luỹ kế kế hoạch bằng 0', () => {
    const { cumulative } = planCumulative(CHIA_DEU, 2026, new Date(2026, 0, 15));
    expect(cumulative).toBe(0);
  });

  it('đầu quý III: hai quý đã kết thúc', () => {
    const { cumulative } = planCumulative(CHIA_DEU, 2026, new Date(2026, 6, 5));
    expect(cumulative).toBe(2 * TY);
  });

  it('sang năm sau: toàn bộ kế hoạch đã tới hạn', () => {
    const { cumulative } = planCumulative(CHIA_DEU, 2026, new Date(2027, 0, 5));
    expect(cumulative).toBe(4 * TY);
  });

  it('năm ngân sách chưa tới: chưa có phần nào tới hạn', () => {
    const { cumulative, expected } = planCumulative(CHIA_DEU, 2026, new Date(2025, 11, 20));
    expect(cumulative).toBe(0);
    expect(expected).toBe(0);
  });

  it('nội suy phần quý hiện tại theo số ngày đã trôi qua', () => {
    // 15/02/2026: quý I có 90 ngày (2026 không nhuận), đã qua 46 ngày
    const { expected } = planCumulative(CHIA_DEU, 2026, new Date(2026, 1, 15));
    expect(expected).toBe(Math.round((TY * 46) / 90));
  });
});

describe('disbursementStateOf', () => {
  it('chưa chi / một phần / đủ', () => {
    expect(disbursementStateOf(4 * TY, 0)).toBe('chua-chi');
    expect(disbursementStateOf(4 * TY, 1 * TY)).toBe('mot-phan');
    expect(disbursementStateOf(4 * TY, 4 * TY)).toBe('du');
  });

  it('chi vượt kế hoạch vẫn là "đủ", không phải một phần', () => {
    expect(disbursementStateOf(4 * TY, 5 * TY)).toBe('du');
  });
});

describe('computeProgress — tình trạng tiến độ', () => {
  it('hạng mục mới giao dự toán đầu năm KHÔNG bị coi là chậm', () => {
    // Đây là lỗi của bản cũ: 0/4 tỷ < ngưỡng 70% nên bị gắn cờ chậm ngay 15/01
    const kq = tinh({ asOf: new Date(2026, 0, 2), actualDong: 0 });
    expect(kq.scheduleState).not.toBe('cham');
  });

  it('chưa tới ngày bắt đầu kế hoạch thì là "chưa đến kỳ"', () => {
    const kq = tinh({ asOf: new Date(2025, 11, 20), startDate: '01/01/2026' });
    expect(kq.scheduleState).toBe('chua-den-han');
  });

  it('hết quý II mà chưa đạt kế hoạch quý I+II thì CHẬM', () => {
    const kq = tinh({ asOf: new Date(2026, 6, 5), actualDong: 1_500_000_000 });
    expect(kq.planCumulativeDong).toBe(2 * TY);
    expect(kq.scheduleState).toBe('cham');
  });

  it('hết quý II và đạt đúng kế hoạch luỹ kế thì ĐÚNG TIẾN ĐỘ', () => {
    const kq = tinh({ asOf: new Date(2026, 6, 5), actualDong: 2 * TY });
    expect(kq.scheduleState).toBe('dung-tien-do');
  });

  it('giữa quý mà mới đạt phần nhỏ so với kế hoạch đã tới hạn → NGUY CƠ CHẬM', () => {
    // 15/02: kế hoạch tới hạn ≈ 511 triệu; mới chi 100 triệu
    const kq = tinh({ asOf: new Date(2026, 1, 15), actualDong: 100_000_000 });
    expect(kq.scheduleState).toBe('nguy-co-cham');
  });

  it('quá hạn kết thúc mà chưa giải ngân đủ thì CHẬM', () => {
    const kq = tinh({ asOf: new Date(2027, 0, 10), actualDong: 3 * TY });
    expect(kq.daysLeft).toBeLessThan(0);
    expect(kq.scheduleState).toBe('cham');
  });

  it('đã giải ngân ĐỦ thì là HOÀN THÀNH, dù đã quá hạn', () => {
    // Tiền đã ra hết, không còn việc gì phải làm — báo "chậm" là báo sai
    const kq = tinh({ asOf: new Date(2027, 0, 10), actualDong: 4 * TY });
    expect(kq.scheduleState).toBe('hoan-thanh');
  });

  it('chưa có dự toán thì là "chưa đến kỳ", không phải chậm', () => {
    const kq = tinh({ plannedDong: 0, actualDong: 0, quarterPlans: [] });
    expect(kq.percent).toBeNull();
    expect(kq.scheduleState).toBe('chua-den-han');
  });

  it('không khai kế hoạch quý thì không kết luận chậm giữa năm', () => {
    // Nhiều hạng mục nhỏ sẽ không ai khai kế hoạch quý; không được vì thế mà
    // bị gắn cờ chậm
    const kq = tinh({ quarterPlans: [], asOf: new Date(2026, 6, 5), actualDong: 0 });
    expect(kq.scheduleState).toBe('dung-tien-do');
  });

  it('sắp đến hạn mà tỷ lệ còn thấp → NGUY CƠ CHẬM', () => {
    const kq = tinh({
      quarterPlans: [],
      endDate: '20/12/2026',
      asOf: new Date(2026, 11, 1),
      actualDong: 1 * TY,
    });
    expect(kq.daysLeft).toBe(19);
    expect(kq.scheduleState).toBe('nguy-co-cham');
  });

  it('trả đủ số liệu để hiển thị: còn lại, tỷ lệ, số ngày còn lại', () => {
    const kq = tinh({ asOf: new Date(2026, 5, 30), actualDong: 1_200_000_000 });
    expect(kq.remainingDong).toBe(2_800_000_000);
    expect(kq.percent).toBe(30);
    expect(kq.daysLeft).toBe(184);
  });

  it('ngưỡng cảnh báo đọc từ tham số, KHÔNG viết cứng', () => {
    const chung = { asOf: new Date(2026, 1, 15), actualDong: 400_000_000 };
    // Ngưỡng 0,8: 400tr < 511tr × 0,8 = 409tr → nguy cơ chậm
    expect(tinh({ ...chung, thresholds: { riskRatio: 0.8, dueSoonDays: 30 } }).scheduleState).toBe(
      'nguy-co-cham',
    );
    // Ngưỡng 0,5: 400tr > 511tr × 0,5 = 256tr → đúng tiến độ
    expect(tinh({ ...chung, thresholds: { riskRatio: 0.5, dueSoonDays: 30 } }).scheduleState).toBe(
      'dung-tien-do',
    );
  });
});
