import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  daysLeftMs,
  nowMs,
  BudgetItem,
  Feedback,
  IncomingDocument,
  NOT_DELETED,
  percentOf,
  sumVnd,
  Task,
  type BudgetItemDocument,
  type FeedbackDocument,
  type IncomingDocumentDocument,
  type TaskDocument,
} from '@vigov/shared';

/** Số dòng hiển thị trong bảng "Cần xử lý ngay" */
const URGENT_LIMIT = 6;

/** Số tháng gần nhất vẽ biểu đồ cột nhiệm vụ */
const MONTHS_IN_CHART = 12;

/**
 * Năm và tháng theo lịch Việt Nam của một mốc thời gian.
 *
 * Mọi phép suy tháng/năm trong tệp này phải đi qua đây: dùng `new Date(ms)` rồi
 * `getMonth()` là suy theo giờ MÁY CHỦ, nên trên container UTC một giao dịch
 * ngày 01 lúc 02:00 giờ Việt Nam bị đếm vào tháng trước.
 */
function vnCalendar(ms: number): { year: number; month: number } {
  const vn = new Date(ms + 7 * 60 * 60_000);
  return { year: vn.getUTCFullYear(), month: vn.getUTCMonth() };
}

const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

export interface DashboardOverview {
  /** 6 thẻ KPI của trang Tổng quan */
  kpis: {
    activeTasks: number;
    overdueTasks: number;
    pendingDocuments: number;
    dueDocuments: number;
    disbursementPercent: number;
    disbursementPlanned: number;
    disbursementActual: number;
    feedbackOnTimeRate: number;
    feedbackResolved: number;
    feedbackTotal: number;
    satisfactionScore: number;
    ratedCount: number;
  };
  /** Nhiệm vụ theo tháng: được giao và đã hoàn thành */
  monthlyTasks: { label: string; assigned: number; done: number }[];
  /** Giải ngân luỹ kế theo tháng (tỷ đồng) */
  disbursementCumulative: { months: string[]; planned: (number | null)[]; actual: (number | null)[] };
  /** Việc cần xử lý ngay: quá hạn trước, rồi tới sát hạn */
  urgent: { code: string; title: string; department: string; deadline: number; daysLeft: number; priority: string }[];
}

/**
 * Tổng hợp số liệu cho trang Tổng quan (WBS #2).
 * Gom về một endpoint để giao diện chỉ gọi một lần thay vì năm lời gọi rời rạc.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(IncomingDocument.name) private readonly docModel: Model<IncomingDocumentDocument>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(BudgetItem.name) private readonly budgetModel: Model<BudgetItemDocument>,
  ) {}

  async overview(year: number): Promise<DashboardOverview> {
    const now = nowMs();
    const soon = now + 7 * 24 * 3600 * 1000;

    const [tasks, documents, feedbacks, budgets] = await Promise.all([
      // NOT_DELETED — nhiệm vụ / văn bản đã xoá mềm không tính vào thẻ thống kê
      this.taskModel.find(NOT_DELETED).lean().exec(),
      this.docModel.find(NOT_DELETED).lean().exec(),
      this.feedbackModel.find(NOT_DELETED).lean().exec(),
      this.budgetModel.find({ year }).lean().exec(),
    ]);

    const activeTasks = tasks.filter((t) => t.status !== 'xong').length;
    const overdueTasks = tasks.filter((t) => t.status === 'qua').length;

    const pendingDocuments = documents.filter((d) => d.status !== 'xong').length;
    const dueDocuments = documents.filter(
      (d) => d.status !== 'xong' && d.deadline !== undefined && d.deadline <= soon,
    ).length;

    // Đơn vị ĐỒNG, số nguyên — xem libs/shared/src/money/vnd.ts
    const planned = sumVnd(budgets.map((b) => b.plannedDong ?? 0));
    const actual = sumVnd(budgets.map((b) => b.actualDong ?? 0));

    const resolved = feedbacks.filter((f) => f.status === 'resolved');
    const resolvedAt = (f: (typeof resolved)[number]) => f.updatedAt ?? now;
    const onTime = resolved.filter((f) => !f.slaDueAt || resolvedAt(f) <= f.slaDueAt);
    const rated = feedbacks.filter((f) => (f.rating ?? 0) > 0);
    const ratingSum = rated.reduce((sum, f) => sum + (f.rating ?? 0), 0);

    return {
      kpis: {
        activeTasks,
        overdueTasks,
        pendingDocuments,
        dueDocuments,
        disbursementPercent: percentOf(actual, planned) ?? 0,
        /** Đồng, số nguyên */
        disbursementPlanned: planned,
        disbursementActual: actual,
        feedbackOnTimeRate: resolved.length > 0 ? Math.round((onTime.length / resolved.length) * 100) : 0,
        feedbackResolved: resolved.length,
        feedbackTotal: feedbacks.length,
        satisfactionScore: rated.length > 0 ? Number((ratingSum / rated.length).toFixed(1)) : 0,
        ratedCount: rated.length,
      },
      monthlyTasks: this.buildMonthlyTasks(tasks, year),
      disbursementCumulative: this.buildCumulative(budgets, now),
      urgent: this.buildUrgent(tasks, now),
    };
  }

  /** Đếm nhiệm vụ được giao và hoàn thành theo từng tháng trong năm */
  private buildMonthlyTasks(tasks: Pick<Task, 'status' | 'deadline'>[], year: number) {
    return MONTH_LABELS.slice(0, MONTHS_IN_CHART).map((label, index) => {
      const inMonth = tasks.filter((t) => {
        if (!t.deadline) return false;
        // Tháng và năm theo lịch VIỆT NAM: hạn 01/01 lúc 00:30 giờ VN vẫn là tháng 1
        const vn = vnCalendar(t.deadline);
        return vn.year === year && vn.month === index;
      });
      return {
        label,
        assigned: inMonth.length,
        done: inMonth.filter((t) => t.status === 'xong').length,
      };
    });
  }

  /**
   * Giải ngân luỹ kế: kế hoạch chia đều 12 tháng, thực tế cộng dồn theo ngày
   * ghi nhận trong `entries`. Tháng chưa tới thì để null để đường biểu đồ dừng lại.
   */
  private buildCumulative(budgets: Pick<BudgetItem, 'plannedDong' | 'entries'>[], now: number) {
    const totalPlanned = sumVnd(budgets.map((b) => b.plannedDong ?? 0));
    const monthlyActual = new Array<number>(12).fill(0);

    for (const item of budgets) {
      for (const entry of item.entries ?? []) {
        const month = this.monthFromVnDate(entry.date);
        if (month === null) continue;
        /* Giao dịch hoàn trả TRỪ vào luỹ kế: nếu cộng cả vào thì đường thực tế
           trên biểu đồ vượt số tiền thật đã chi. */
        const amount = Math.trunc(entry.amountDong ?? 0);
        monthlyActual[month] += entry.type === 'hoan-tra' ? -amount : amount;
      }
    }

    let runningActual = 0;
    const planned: (number | null)[] = [];
    const actual: (number | null)[] = [];

    for (let i = 0; i < 12; i++) {
      // Kế hoạch chia đều 12 tháng, làm tròn tới ĐỒNG (không giữ số thập phân)
      planned.push(Math.round((totalPlanned / 12) * (i + 1)));
      if (i > vnCalendar(now).month) {
        actual.push(null);
      } else {
        runningActual += monthlyActual[i];
        actual.push(Number(runningActual.toFixed(2)));
      }
    }

    return { months: MONTH_LABELS, planned, actual };
  }

  /** Nhiệm vụ quá hạn xếp trước, sau đó tới nhiệm vụ sát hạn nhất */
  private buildUrgent(tasks: TaskDocument[] | Task[], now: number) {
    return tasks
      .filter((t) => t.status !== 'xong' && t.deadline)
      .map((t) => ({
        code: t.code,
        title: t.title,
        department: t.department,
        deadline: t.deadline,
        daysLeft: daysLeftMs(t.deadline, now),
        priority: t.priority,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, URGENT_LIMIT);
  }

  /**
   * Mốc thời gian -> chỉ số tháng 0-based theo lịch Việt Nam; `null` khi không có mốc.
   *
   * Bản v1 bóc tháng ra khỏi chuỗi `dd/MM/yyyy`, nên một giao dịch ghi sai định
   * dạng bị bỏ khỏi biểu đồ luỹ kế mà không ai biết.
   */
  private monthFromVnDate(value?: number): number | null {
    return value === undefined || value === null ? null : vnCalendar(value).month;
  }

}
