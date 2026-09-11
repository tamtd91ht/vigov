import {
  type DisbursementEntry,
  type DisbursementState,
  type QuarterPlan,
  type ScheduleState,
  percentOf,
} from '@vigov/shared';

/**
 * Tính tiến độ giải ngân của một hạng mục.
 *
 * Hàm thuần, không chạm CSDL, không đọc giờ hệ thống (mốc `asOf` truyền vào) —
 * nhờ vậy test được đúng những ca đổi kết luận: cuối quý, quá hạn, chưa tới kỳ.
 *
 * VÌ SAO KHÔNG DÙNG NGƯỠNG "TỶ LỆ GIẢI NGÂN < 70%" NHƯ BẢN CŨ: ngưỡng đó không
 * nhìn thời gian, nên một hạng mục vừa được giao dự toán tháng 1 đã bị kết luận
 * chậm tiến độ. Cách đúng theo nghiệp vụ ngân sách là so
 *
 *     luỹ kế THỰC TẾ  ↔  luỹ kế KẾ HOẠCH đến thời điểm này
 *
 * Kế hoạch luỹ kế chỉ tính các quý ĐÃ KẾT THÚC: hết quý II mà chưa đạt kế hoạch
 * quý I + II thì mới là chậm. Đang giữa quý thì chưa kết luận chậm, chỉ cảnh báo
 * "có nguy cơ chậm" dựa trên phần kế hoạch quý hiện tại đã trôi qua theo ngày.
 * Kết luận "chậm" giữa quý là kết luận không giải trình được với đơn vị.
 */

/** Ranh giới quý theo năm ngân sách: [tháng bắt đầu, tháng kết thúc] tính từ 0 */
const QUARTER_MONTHS: [number, number][] = [
  [0, 2],
  [3, 5],
  [6, 8],
  [9, 11],
];

export interface ProgressThresholds {
  /**
   * Tỷ lệ so với kế hoạch luỹ kế nội suy, dưới mức này thì cảnh báo nguy cơ chậm.
   * Ví dụ 0,8 = đạt dưới 80% phần kế hoạch đã tới hạn theo ngày.
   */
  riskRatio: number;
  /** Còn bao nhiêu ngày tới hạn kết thúc thì coi là "sắp đến hạn" */
  dueSoonDays: number;
}

export interface ProgressInput {
  plannedDong: number;
  actualDong: number;
  quarterPlans: QuarterPlan[];
  /** dd/MM/yyyy, rỗng nghĩa là chưa đặt mốc */
  startDate: string;
  endDate: string;
  year: number;
  asOf: Date;
  thresholds: ProgressThresholds;
}

export interface ProgressResult {
  plannedDong: number;
  actualDong: number;
  remainingDong: number;
  /** `null` khi chưa có kế hoạch vốn — khác hẳn "giải ngân 0%" */
  percent: number | null;
  /** Kế hoạch luỹ kế đến hết quý gần nhất đã kết thúc */
  planCumulativeDong: number;
  /** Kế hoạch luỹ kế có tính phần quý hiện tại đã trôi qua theo ngày */
  planExpectedDong: number;
  /** Số ngày còn lại tới hạn kết thúc; âm là đã quá hạn; `null` khi chưa đặt hạn */
  daysLeft: number | null;
  disbursementState: DisbursementState;
  scheduleState: ScheduleState;
}

/** `dd/MM/yyyy` → Date lúc 00:00 giờ địa phương; không đúng dạng thì trả null */
export function parseVnDate(value: string): Date | null {
  const matched = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((value ?? '').trim());
  if (!matched) return null;
  const day = Number(matched[1]);
  const month = Number(matched[2]);
  const year = Number(matched[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const date = new Date(year, month - 1, day);
  // Chặn ngày không tồn tại kiểu 31/02 — Date tự nhảy sang tháng sau
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Số ngày trọn vẹn giữa hai mốc (b − a), tính theo ngày lịch */
function daysBetween(a: Date, b: Date): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000);
}

/** Luỹ kế đã giải ngân = tổng giao dịch chi − tổng giao dịch hoàn trả */
export function actualFromEntries(entries: DisbursementEntry[]): number {
  return (entries ?? []).reduce((sum, entry) => {
    const amount = Math.trunc(entry.amountDong || 0);
    return entry.type === 'hoan-tra' ? sum - amount : sum + amount;
  }, 0);
}

/** Kế hoạch của một quý (1..4); quý chưa khai thì coi là 0 */
function quarterAmount(quarterPlans: QuarterPlan[], quarter: number): number {
  return Math.trunc(
    (quarterPlans ?? []).find((q) => q.quarter === quarter)?.amountDong || 0,
  );
}

/**
 * Kế hoạch luỹ kế đến `asOf`.
 *
 * @returns `cumulative` — chỉ các quý đã kết thúc; `expected` — cộng thêm phần
 *   quý hiện tại đã trôi qua theo số ngày.
 */
export function planCumulative(
  quarterPlans: QuarterPlan[],
  year: number,
  asOf: Date,
): { cumulative: number; expected: number } {
  const totalAll = [1, 2, 3, 4].reduce((s, q) => s + quarterAmount(quarterPlans, q), 0);

  // Năm ngân sách đã qua: toàn bộ kế hoạch đều đã tới hạn
  if (asOf.getFullYear() > year) return { cumulative: totalAll, expected: totalAll };
  // Năm ngân sách chưa tới: chưa có phần nào tới hạn
  if (asOf.getFullYear() < year) return { cumulative: 0, expected: 0 };

  const month = asOf.getMonth();
  const currentQuarter = Math.floor(month / 3) + 1;

  let cumulative = 0;
  for (let q = 1; q < currentQuarter; q += 1) cumulative += quarterAmount(quarterPlans, q);

  // Phần quý hiện tại tính theo tỷ lệ ngày đã trôi qua trong quý
  const [firstMonth, lastMonth] = QUARTER_MONTHS[currentQuarter - 1];
  const quarterStart = new Date(year, firstMonth, 1);
  const quarterEnd = new Date(year, lastMonth + 1, 0);
  const totalDays = daysBetween(quarterStart, quarterEnd) + 1;
  const elapsedDays = Math.min(Math.max(daysBetween(quarterStart, asOf) + 1, 0), totalDays);
  const currentPlan = quarterAmount(quarterPlans, currentQuarter);

  return {
    cumulative,
    expected: cumulative + Math.round((currentPlan * elapsedDays) / totalDays),
  };
}

/** Mức giải ngân suy từ số tiền */
export function disbursementStateOf(plannedDong: number, actualDong: number): DisbursementState {
  if (actualDong <= 0) return 'chua-chi';
  if (plannedDong > 0 && actualDong >= plannedDong) return 'du';
  return 'mot-phan';
}

/**
 * Tình trạng tiến độ.
 *
 * Thứ tự xét có chủ ý: hoàn thành → chưa tới kỳ → quá hạn → chậm theo luỹ kế →
 * nguy cơ chậm → đúng tiến độ. Đảo thứ tự là một hạng mục đã giải ngân đủ nhưng
 * quá hạn bị báo "chậm", trong khi tiền đã ra hết và không còn gì phải làm.
 */
export function computeProgress(input: ProgressInput): ProgressResult {
  const { plannedDong, actualDong, quarterPlans, year, asOf, thresholds } = input;
  const remainingDong = plannedDong - actualDong;
  const percent = percentOf(actualDong, plannedDong);
  const { cumulative, expected } = planCumulative(quarterPlans, year, asOf);

  const start = parseVnDate(input.startDate);
  const end = parseVnDate(input.endDate);
  const daysLeft = end ? daysBetween(asOf, end) : null;

  const disbursementState = disbursementStateOf(plannedDong, actualDong);

  const scheduleState = ((): ScheduleState => {
    if (disbursementState === 'du') return 'hoan-thanh';
    // Chưa có dự toán, hoặc chưa tới ngày bắt đầu kế hoạch
    if (plannedDong <= 0) return 'chua-den-han';
    if (start && daysBetween(asOf, start) > 0) return 'chua-den-han';
    // Quá hạn kết thúc mà chưa giải ngân đủ
    if (daysLeft !== null && daysLeft < 0) return 'cham';
    // Đã hết quý mà chưa đạt kế hoạch luỹ kế của các quý đó
    if (cumulative > 0 && actualDong < cumulative) return 'cham';
    // Đang trong quý: so với phần kế hoạch đã tới hạn theo ngày
    if (expected > 0 && actualDong < expected * thresholds.riskRatio) return 'nguy-co-cham';
    // Sắp đến hạn mà tỷ lệ giải ngân còn thấp
    if (
      daysLeft !== null &&
      daysLeft <= thresholds.dueSoonDays &&
      (percent ?? 0) < thresholds.riskRatio * 100
    ) {
      return 'nguy-co-cham';
    }
    return 'dung-tien-do';
  })();

  return {
    plannedDong,
    actualDong,
    remainingDong,
    percent,
    planCumulativeDong: cumulative,
    planExpectedDong: expected,
    daysLeft,
    disbursementState,
    scheduleState,
  };
}
