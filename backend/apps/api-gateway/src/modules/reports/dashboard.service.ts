import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BudgetItem,
  type BudgetItemDocument,
  Feedback,
  type FeedbackDocument,
  IncomingDocument,
  type IncomingDocumentDocument,
  Task,
  type TaskDocument,
} from '@vigov/shared';

/** Số dòng hiển thị trong bảng "Cần xử lý ngay" */
const URGENT_LIMIT = 6;

/** Số tháng gần nhất vẽ biểu đồ cột nhiệm vụ */
const MONTHS_IN_CHART = 12;

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
  urgent: { code: string; title: string; department: string; deadline: string; daysLeft: number; priority: string }[];
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
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const [tasks, documents, feedbacks, budgets] = await Promise.all([
      this.taskModel.find().lean().exec(),
      this.docModel.find().lean().exec(),
      this.feedbackModel.find().lean().exec(),
      this.budgetModel.find({ year }).lean().exec(),
    ]);

    const activeTasks = tasks.filter((t) => t.status !== 'xong').length;
    const overdueTasks = tasks.filter((t) => t.status === 'qua').length;

    const pendingDocuments = documents.filter((d) => d.status !== 'xong').length;
    const dueDocuments = documents.filter(
      (d) => d.status !== 'xong' && d.deadlineAt && new Date(d.deadlineAt) <= soon,
    ).length;

    const planned = budgets.reduce((sum, b) => sum + (b.planned ?? 0), 0);
    const actual = budgets.reduce((sum, b) => sum + (b.actual ?? 0), 0);

    const resolved = feedbacks.filter((f) => f.status === 'resolved');
    // `updatedAt` do tuỳ chọn timestamps sinh ra nên không nằm trong lớp schema
    const resolvedAt = (f: (typeof resolved)[number]) => (f as { updatedAt?: Date }).updatedAt ?? now;
    const onTime = resolved.filter((f) => !f.slaDueAt || new Date(resolvedAt(f)) <= new Date(f.slaDueAt));
    const rated = feedbacks.filter((f) => (f.rating ?? 0) > 0);
    const ratingSum = rated.reduce((sum, f) => sum + (f.rating ?? 0), 0);

    return {
      kpis: {
        activeTasks,
        overdueTasks,
        pendingDocuments,
        dueDocuments,
        disbursementPercent: planned > 0 ? Math.round((actual / planned) * 100) : 0,
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
  private buildMonthlyTasks(tasks: Pick<Task, 'status' | 'deadlineAt'>[], year: number) {
    return MONTH_LABELS.slice(0, MONTHS_IN_CHART).map((label, index) => {
      const inMonth = tasks.filter((t) => {
        if (!t.deadlineAt) return false;
        const d = new Date(t.deadlineAt);
        return d.getFullYear() === year && d.getMonth() === index;
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
  private buildCumulative(budgets: Pick<BudgetItem, 'planned' | 'entries'>[], now: Date) {
    const totalPlanned = budgets.reduce((sum, b) => sum + (b.planned ?? 0), 0);
    const monthlyActual = new Array<number>(12).fill(0);

    for (const item of budgets) {
      for (const entry of item.entries ?? []) {
        const month = this.monthFromVnDate(entry.date);
        if (month === null) continue;
        monthlyActual[month] += this.parseAmount(entry.amount);
      }
    }

    let runningActual = 0;
    const planned: (number | null)[] = [];
    const actual: (number | null)[] = [];

    for (let i = 0; i < 12; i++) {
      planned.push(Number(((totalPlanned / 12) * (i + 1)).toFixed(2)));
      if (i > now.getMonth()) {
        actual.push(null);
      } else {
        runningActual += monthlyActual[i];
        actual.push(Number(runningActual.toFixed(2)));
      }
    }

    return { months: MONTH_LABELS, planned, actual };
  }

  /** Nhiệm vụ quá hạn xếp trước, sau đó tới nhiệm vụ sát hạn nhất */
  private buildUrgent(tasks: TaskDocument[] | Task[], now: Date) {
    return tasks
      .filter((t) => t.status !== 'xong' && t.deadlineAt)
      .map((t) => ({
        code: t.code,
        title: t.title,
        department: t.department,
        deadline: t.deadline,
        daysLeft: Math.ceil((new Date(t.deadlineAt as Date).getTime() - now.getTime()) / 86_400_000),
        priority: t.priority,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, URGENT_LIMIT);
  }

  /** "12/03/2026" -> 2 (chỉ số tháng 0-based); trả null nếu không đọc được */
  private monthFromVnDate(value: string): number | null {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? '');
    if (!match) return null;
    return Number(match[2]) - 1;
  }

  /** "1,25 tỷ" -> 1.25 (đơn vị tỷ đồng) */
  private parseAmount(value: string): number {
    const numeric = (value ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number.parseFloat(numeric);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
