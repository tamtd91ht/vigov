import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BudgetItem,
  type BudgetItemDocument,
  Feedback,
  type FeedbackDocument,
  Task,
  type TaskDocument,
} from '@vigov/shared';
import type { ReportPeriod, ReportQueryDto } from './dto/reports.dto';

/** Trạng thái nhiệm vụ dùng để tính đúng hạn / trễ hạn */
const TASK_STATUS_DONE = 'xong';
const TASK_STATUS_OVERDUE = 'qua';

/** Trạng thái phản ánh đã xử lý xong */
const FEEDBACK_STATUS_RESOLVED = 'resolved';

/** Số bộ phận tối đa hiển thị trong bảng xếp hạng */
const RANKING_LIMIT = 20;

/** Nhãn tháng tiếng Việt dùng cho biểu đồ tỷ lệ đúng hạn */
const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

/** Nhãn lĩnh vực phản ánh — khớp cấu hình SLA phía Web Quản trị */
const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  'ha-tang': 'Hạ tầng – giao thông',
  'moi-truong': 'Môi trường – vệ sinh',
  'an-ninh': 'An ninh trật tự',
  'dat-dai': 'Đất đai – xây dựng',
  'hanh-chinh': 'Thủ tục hành chính',
  khac: 'Lĩnh vực khác',
};

/** Khoảng thời gian của một kỳ báo cáo */
export interface ReportRange {
  from: Date;
  to: Date;
  label: string;
  /** Chỉ số tháng (0-11) nằm trong kỳ, phục vụ biểu đồ theo tháng */
  months: number[];
  year: number;
}

/** Số liệu tổng của một kỳ — dùng cho phần so sánh kỳ trước */
export interface ReportTotals {
  tasks: number;
  tasksOnTime: number;
  tasksLate: number;
  onTimeRate: number;
  feedbacks: number;
  feedbacksResolved: number;
  planned: number;
  actual: number;
  disbursementPercent: number;
}

/** Kết quả tổng hợp báo cáo — dùng chung cho API JSON và bộ kết xuất Excel */
export interface ReportSummary {
  period: ReportPeriod;
  year: number;
  range: { from: string; to: string; label: string };
  tasksByDepartment: { department: string; total: number }[];
  onTimeRateByMonth: { month: string; total: number; onTime: number; rate: number }[];
  feedbackByCategory: {
    categoryKey: string;
    label: string;
    total: number;
    resolved: number;
    resolveRate: number;
  }[];
  disbursementByFunding: {
    fundingSource: string;
    planned: number;
    actual: number;
    percent: number;
  }[];
  departmentRanking: {
    rank: number;
    department: string;
    total: number;
    onTime: number;
    late: number;
    onTimeRate: number;
  }[];
  totals: ReportTotals;
  /** Chỉ có khi gọi với compare=true */
  comparison?: {
    previousLabel: string;
    previous: ReportTotals;
    delta: Partial<ReportTotals>;
  };
}

/** Bản ghi rút gọn đọc từ Mongo (lean) */
interface TaskLean {
  code: string;
  title: string;
  department: string;
  assignee: string;
  status: string;
  deadline: string;
  deadlineAt?: Date;
  createdAt?: Date;
}

interface FeedbackLean {
  code: string;
  categoryKey: string;
  status: string;
  department: string;
  sentAt: string;
  createdAt?: Date;
}

interface BudgetLean {
  code: string;
  name: string;
  fundingSource: string;
  owner: string;
  planned: number;
  actual: number;
  delayed: boolean;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(BudgetItem.name) private readonly budgetModel: Model<BudgetItemDocument>,
  ) {}

  /**
   * Tổng hợp báo cáo kỳ từ dữ liệu thật của các phân hệ Nhiệm vụ, Phản ánh, Giải ngân.
   * Dữ liệu cấp xã trong một kỳ ở mức vài nghìn bản ghi nên gom nhóm tại tầng ứng dụng
   * để xử lý được ngày tháng lưu dạng chuỗi dd/MM/yyyy; khi dữ liệu lớn sẽ chuyển
   * sang aggregation pipeline.
   */
  async summary(query: ReportQueryDto): Promise<ReportSummary> {
    const period: ReportPeriod = query.period ?? 'month';
    const year = query.year ?? new Date().getFullYear();
    const range = this.resolveRange(period, year);

    const summary = await this.buildForRange(period, year, range);

    if (query.compare) {
      const previousRange = this.previousRange(period, range);
      const previous = await this.totalsForRange(previousRange);
      summary.comparison = {
        previousLabel: previousRange.label,
        previous,
        delta: this.delta(summary.totals, previous),
      };
    }

    return summary;
  }

  /** Dựng toàn bộ khối số liệu của một kỳ */
  private async buildForRange(
    period: ReportPeriod,
    year: number,
    range: ReportRange,
  ): Promise<ReportSummary> {
    const { tasks, feedbacks, budgets } = await this.collect(range);

    return {
      period,
      year,
      range: { from: this.isoDate(range.from), to: this.isoDate(range.to), label: range.label },
      tasksByDepartment: this.groupTasksByDepartment(tasks),
      onTimeRateByMonth: this.onTimeRateByMonth(tasks, range),
      feedbackByCategory: this.groupFeedbackByCategory(feedbacks),
      disbursementByFunding: this.groupDisbursementByFunding(budgets),
      departmentRanking: this.rankDepartments(tasks),
      totals: this.buildTotals(tasks, feedbacks, budgets),
    };
  }

  /** Số liệu tổng của một kỳ (dùng cho so sánh) */
  private async totalsForRange(range: ReportRange): Promise<ReportTotals> {
    const { tasks, feedbacks, budgets } = await this.collect(range);
    return this.buildTotals(tasks, feedbacks, budgets);
  }

  /** Nạp dữ liệu thô của kỳ từ 3 phân hệ */
  private async collect(range: ReportRange) {
    const [allTasks, allFeedbacks, budgets] = await Promise.all([
      this.taskModel
        .find({}, 'code title department assignee status deadline deadlineAt createdAt')
        .lean<TaskLean[]>()
        .exec(),
      this.feedbackModel
        .find({}, 'code categoryKey status department sentAt createdAt')
        .lean<FeedbackLean[]>()
        .exec(),
      this.budgetModel
        .find({ year: range.year }, 'code name fundingSource owner planned actual delayed')
        .lean<BudgetLean[]>()
        .exec(),
    ]);

    return {
      tasks: allTasks.filter((t) => this.inRange(this.taskDate(t), range)),
      feedbacks: allFeedbacks.filter((f) => this.inRange(this.feedbackDate(f), range)),
      budgets,
    };
  }

  // ------------------------------------------------------------- Nhóm số liệu

  /** Số nhiệm vụ theo bộ phận */
  private groupTasksByDepartment(tasks: TaskLean[]) {
    const counter = new Map<string, number>();
    for (const task of tasks) {
      const dept = task.department || 'Chưa phân công';
      counter.set(dept, (counter.get(dept) ?? 0) + 1);
    }
    return [...counter.entries()]
      .map(([department, total]) => ({ department, total }))
      .sort((a, b) => b.total - a.total);
  }

  /** Tỷ lệ hoàn thành đúng hạn theo từng tháng trong kỳ */
  private onTimeRateByMonth(tasks: TaskLean[], range: ReportRange) {
    return range.months.map((monthIndex) => {
      const inMonth = tasks.filter((t) => {
        const date = this.taskDate(t);
        return !!date && date.getMonth() === monthIndex && date.getFullYear() === range.year;
      });
      const onTime = inMonth.filter((t) => t.status === TASK_STATUS_DONE).length;
      return {
        month: MONTH_LABELS[monthIndex],
        total: inMonth.length,
        onTime,
        rate: inMonth.length > 0 ? this.round((onTime / inMonth.length) * 100) : 0,
      };
    });
  }

  /** Phản ánh theo lĩnh vực kèm tỷ lệ đã xử lý */
  private groupFeedbackByCategory(feedbacks: FeedbackLean[]) {
    const counter = new Map<string, { total: number; resolved: number }>();
    for (const fb of feedbacks) {
      const key = fb.categoryKey || 'khac';
      const bucket = counter.get(key) ?? { total: 0, resolved: 0 };
      bucket.total += 1;
      if (fb.status === FEEDBACK_STATUS_RESOLVED) bucket.resolved += 1;
      counter.set(key, bucket);
    }
    return [...counter.entries()]
      .map(([categoryKey, bucket]) => ({
        categoryKey,
        label: FEEDBACK_CATEGORY_LABELS[categoryKey] ?? categoryKey,
        total: bucket.total,
        resolved: bucket.resolved,
        resolveRate: bucket.total > 0 ? this.round((bucket.resolved / bucket.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  /** Giải ngân theo nguồn vốn (đơn vị: tỷ đồng) */
  private groupDisbursementByFunding(budgets: BudgetLean[]) {
    const counter = new Map<string, { planned: number; actual: number }>();
    for (const item of budgets) {
      const key = item.fundingSource || 'Chưa xác định';
      const bucket = counter.get(key) ?? { planned: 0, actual: 0 };
      bucket.planned += item.planned ?? 0;
      bucket.actual += item.actual ?? 0;
      counter.set(key, bucket);
    }
    return [...counter.entries()]
      .map(([fundingSource, bucket]) => ({
        fundingSource,
        planned: this.round(bucket.planned),
        actual: this.round(bucket.actual),
        percent: bucket.planned > 0 ? this.round((bucket.actual / bucket.planned) * 100) : 0,
      }))
      .sort((a, b) => b.planned - a.planned);
  }

  /** Xếp hạng bộ phận theo tỷ lệ đúng hạn (tổng / đúng hạn / trễ) */
  private rankDepartments(tasks: TaskLean[]) {
    const counter = new Map<string, { total: number; onTime: number; late: number }>();
    for (const task of tasks) {
      const dept = task.department || 'Chưa phân công';
      const bucket = counter.get(dept) ?? { total: 0, onTime: 0, late: 0 };
      bucket.total += 1;
      if (task.status === TASK_STATUS_DONE) bucket.onTime += 1;
      if (task.status === TASK_STATUS_OVERDUE) bucket.late += 1;
      counter.set(dept, bucket);
    }

    return [...counter.entries()]
      .map(([department, bucket]) => ({
        department,
        total: bucket.total,
        onTime: bucket.onTime,
        late: bucket.late,
        onTimeRate: bucket.total > 0 ? this.round((bucket.onTime / bucket.total) * 100) : 0,
      }))
      .sort((a, b) => b.onTimeRate - a.onTimeRate || b.total - a.total)
      .slice(0, RANKING_LIMIT)
      .map((row, index) => ({ rank: index + 1, ...row }));
  }

  /** Số liệu tổng của kỳ */
  private buildTotals(
    tasks: TaskLean[],
    feedbacks: FeedbackLean[],
    budgets: BudgetLean[],
  ): ReportTotals {
    const tasksOnTime = tasks.filter((t) => t.status === TASK_STATUS_DONE).length;
    const tasksLate = tasks.filter((t) => t.status === TASK_STATUS_OVERDUE).length;
    const planned = budgets.reduce((sum, b) => sum + (b.planned ?? 0), 0);
    const actual = budgets.reduce((sum, b) => sum + (b.actual ?? 0), 0);

    return {
      tasks: tasks.length,
      tasksOnTime,
      tasksLate,
      onTimeRate: tasks.length > 0 ? this.round((tasksOnTime / tasks.length) * 100) : 0,
      feedbacks: feedbacks.length,
      feedbacksResolved: feedbacks.filter((f) => f.status === FEEDBACK_STATUS_RESOLVED).length,
      planned: this.round(planned),
      actual: this.round(actual),
      disbursementPercent: planned > 0 ? this.round((actual / planned) * 100) : 0,
    };
  }

  /** Chênh lệch giữa kỳ này và kỳ trước */
  private delta(current: ReportTotals, previous: ReportTotals): Partial<ReportTotals> {
    const keys = Object.keys(current) as (keyof ReportTotals)[];
    const result: Partial<ReportTotals> = {};
    for (const key of keys) {
      result[key] = this.round(current[key] - previous[key]);
    }
    return result;
  }

  // ---------------------------------------------------------------- Thời gian

  /**
   * Xác định khoảng thời gian của kỳ báo cáo.
   * Với năm hiện tại lấy kỳ đang diễn ra; với năm quá khứ lấy kỳ cuối cùng của năm đó.
   */
  private resolveRange(period: ReportPeriod, year: number): ReportRange {
    const now = new Date();
    const isCurrentYear = year === now.getFullYear();
    const currentMonth = isCurrentYear ? now.getMonth() : 11;

    let startMonth = 0;
    let endMonth = 11;

    if (period === 'month') {
      startMonth = currentMonth;
      endMonth = currentMonth;
    } else if (period === 'quarter') {
      startMonth = Math.floor(currentMonth / 3) * 3;
      endMonth = startMonth + 2;
    } else if (period === 'half') {
      startMonth = currentMonth < 6 ? 0 : 6;
      endMonth = startMonth + 5;
    }

    return this.makeRange(period, year, startMonth, endMonth);
  }

  /** Kỳ liền trước cùng độ dài, phục vụ so sánh */
  private previousRange(period: ReportPeriod, range: ReportRange): ReportRange {
    const step = period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'half' ? 6 : 12;
    const startMonth = range.months[0] - step;
    const length = range.months.length;

    let year = range.year;
    let normalizedStart = startMonth;
    while (normalizedStart < 0) {
      normalizedStart += 12;
      year -= 1;
    }

    return this.makeRange(period, year, normalizedStart, normalizedStart + length - 1);
  }

  /** Dựng ReportRange từ tháng bắt đầu/kết thúc (theo chỉ số 0-11) */
  private makeRange(
    period: ReportPeriod,
    year: number,
    startMonth: number,
    endMonth: number,
  ): ReportRange {
    const from = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const to = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
    const months: number[] = [];
    for (let m = startMonth; m <= endMonth; m += 1) months.push(m);

    return { from, to, months, year, label: this.rangeLabel(period, year, startMonth) };
  }

  /** Nhãn kỳ hiển thị trên báo cáo */
  private rangeLabel(period: ReportPeriod, year: number, startMonth: number): string {
    if (period === 'month') return `${MONTH_LABELS[startMonth]}/${year}`;
    if (period === 'quarter') return `Quý ${Math.floor(startMonth / 3) + 1}/${year}`;
    if (period === 'half') return `${startMonth < 6 ? '6 tháng đầu năm' : '6 tháng cuối năm'} ${year}`;
    return `Năm ${year}`;
  }

  /** Mốc thời gian dùng để xếp nhiệm vụ vào kỳ: ưu tiên hạn xử lý, sau đó ngày tạo */
  private taskDate(task: TaskLean): Date | null {
    if (task.deadlineAt) return new Date(task.deadlineAt);
    return this.parseVnDate(task.deadline) ?? (task.createdAt ? new Date(task.createdAt) : null);
  }

  /** Mốc thời gian của phản ánh: ưu tiên ngày gửi, sau đó ngày tạo bản ghi */
  private feedbackDate(feedback: FeedbackLean): Date | null {
    return (
      this.parseVnDate(feedback.sentAt) ??
      (feedback.createdAt ? new Date(feedback.createdAt) : null)
    );
  }

  /** Đọc chuỗi ngày dd/MM/yyyy (có thể kèm giờ) do FE lưu */
  private parseVnDate(value?: string): Date | null {
    if (!value) return null;
    const matched = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
    if (!matched) return null;
    const [, day, month, year] = matched;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private inRange(date: Date | null, range: ReportRange): boolean {
    if (!date) return false;
    return date >= range.from && date <= range.to;
  }

  private isoDate(date: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
