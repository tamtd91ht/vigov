import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, isValidObjectId } from 'mongoose';
import {
  EVENTS,
  Feedback,
  IncomingDocument,
  type DocumentAssignedEvent,
  type FeedbackAssignedEvent,
  type FeedbackDocument,
  type IncomingDocumentDocument,
  type TaskDeadlineWarningEvent,
  type TaskDocument,
  type TimelineStep,
} from '@vigov/shared';
import { MessagingService } from '../messaging/messaging.service';
import {
  TASK_STATUS_DONE,
  TasksService,
  formatVnDate,
  formatVnDateTime,
  parseVnDate,
} from '../tasks/tasks.service';

/* ─────────────── Hằng số cấu hình luồng xuyên phân hệ (P3-30) ─────────────── */

/** Ngưỡng nhắc hạn nhiệm vụ: quét các nhiệm vụ đến hạn trong N ngày tới */
export const DEADLINE_WARNING_DAYS = 3;
/** Ngưỡng cảnh báo SLA phản ánh: quét phiếu hết hạn trong N giờ tới */
export const FEEDBACK_SLA_WARNING_HOURS = 24;
/** Hạn mặc định cho nhiệm vụ sinh từ phản ánh khi phiếu chưa có mốc SLA */
export const FEEDBACK_TASK_DEFAULT_DAYS = 3;

/** Nguồn nhiệm vụ — khớp enum sourceType trong task.schema.ts */
const SOURCE_TYPE_DOCUMENT = 'vb';
const SOURCE_TYPE_FEEDBACK = 'pa';

/** Trạng thái đích khi đồng bộ ngược về bản ghi nguồn */
const DOCUMENT_STATUS_DONE = 'xong';
const FEEDBACK_STATUS_RESOLVED = 'resolved';

/** Mức khẩn của văn bản → mức ưu tiên nhiệm vụ */
const URGENCY_TO_PRIORITY: Record<string, string> = {
  'Hoả tốc': 'cao',
  'Hỏa tốc': 'cao',
  Khẩn: 'cao',
  Thường: 'tb',
};

const SYSTEM_ACTOR = 'Hệ thống';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Luồng nghiệp vụ xuyên phân hệ + CronJob nhắc hạn (WBS #30 — P3-30).
 *
 * Đường CHÍNH vẫn là lời gọi trực tiếp: các phân hệ khác gọi thẳng method public
 * của service này, và service này gọi thẳng TasksService để tạo nhiệm vụ.
 *
 * P5-04 bổ sung kênh PHỤ: sau khi nghiệp vụ đã hoàn tất và ghi xong cơ sở dữ liệu,
 * phát thêm sự kiện vào RabbitMQ để NotificationModule tiêu thụ. Sự kiện được bắn
 * "gửi rồi quên" (không await ở luồng HTTP) và MessagingService đã có timeout cứng,
 * nên broker chết hay bị chặn thì nghiệp vụ chính vẫn đúng và API vẫn trả lời ngay.
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly tasks: TasksService,
    private readonly messaging: MessagingService,
    @InjectModel(IncomingDocument.name)
    private readonly documentModel: Model<IncomingDocumentDocument>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
  ) {}

  /* ───────────────── Văn bản đến → Nhiệm vụ ───────────────── */

  /**
   * Tạo nhiệm vụ theo dõi từ văn bản đến đã phân công bộ phận chủ trì.
   * Idempotent: văn bản đã có linkedTaskCode thì trả lại mã cũ.
   */
  async createTaskFromDocument(
    payload: DocumentAssignedEvent,
    assignee?: string,
  ): Promise<{ code: string }> {
    const doc = await this.loadDocument(payload.documentId);
    if (doc.linkedTaskCode) return { code: doc.linkedTaskCode };

    const department = payload.department || doc.department;
    const summary = payload.summary || doc.summary;
    const deadline = this.pickDeadline(payload.deadline, doc.deadline, doc.deadlineAt);
    const assigner = payload.assignedBy || SYSTEM_ACTOR;

    const task = await this.tasks.createFromSource({
      title: `Xử lý văn bản: ${summary}`,
      // Chưa chỉ định cán bộ cụ thể thì giao cho bộ phận chủ trì
      assignee: assignee || department,
      department,
      deadline,
      assigner,
      sourceType: SOURCE_TYPE_DOCUMENT,
      sourceLabel: `Từ ${doc.refNo}`,
      sourceRefId: String(doc._id),
      priority: URGENCY_TO_PRIORITY[doc.urgency] ?? 'tb',
      description: summary,
    });

    doc.linkedTaskCode = task.code;
    doc.timeline.push(step(`Chuyển thành nhiệm vụ ${task.code}`, assigner, 'cur'));
    await doc.save();

    this.logger.log(`Văn bản ${doc.refNo} → nhiệm vụ ${task.code} (bộ phận ${department})`);

    /*
     * Kênh phụ (P5-04): báo cho NotificationModule qua hàng đợi.
     * KHÔNG await — nghiệp vụ đã xong, không có lý do gì để người dùng phải chờ
     * broker. publish() không bao giờ ném lỗi nên `void` là an toàn.
     */
    void this.messaging.publish(EVENTS.DOCUMENT_ASSIGNED, {
      documentId: String(doc._id),
      arrivalNo: doc.arrivalNo || payload.arrivalNo || doc.refNo,
      summary,
      department,
      deadline,
      assignedBy: assigner,
      // Trường mở rộng cho consumer — xem AssignedExtras ở notification.consumer.ts
      taskCode: task.code,
      assignee: task.assignee,
    } satisfies DocumentAssignedEvent & { taskCode: string; assignee: string });

    return { code: task.code };
  }

  /* ───────────────── Phản ánh → Nhiệm vụ ───────────────── */

  /**
   * Tạo nhiệm vụ xử lý từ phiếu phản ánh đã phân công cán bộ.
   * Idempotent: phiếu đã có linkedTaskCode thì trả lại mã cũ.
   */
  async createTaskFromFeedback(
    payload: FeedbackAssignedEvent,
    deadlineOverride?: string,
  ): Promise<{ code: string }> {
    const feedback = await this.loadFeedback(payload.feedbackId);
    if (feedback.linkedTaskCode) return { code: feedback.linkedTaskCode };

    const department = payload.department || feedback.department;
    const assignee = payload.assignee || feedback.assignee || department;
    const title = payload.title || feedback.title;
    const deadline = this.pickDeadline(
      deadlineOverride,
      undefined,
      feedback.slaDueAt,
      FEEDBACK_TASK_DEFAULT_DAYS,
    );

    const task = await this.tasks.createFromSource({
      title: `Xử lý phản ánh: ${title}`,
      assignee,
      department,
      deadline,
      assigner: SYSTEM_ACTOR,
      sourceType: SOURCE_TYPE_FEEDBACK,
      sourceLabel: `Từ ${feedback.code}`,
      sourceRefId: String(feedback._id),
      description: feedback.description || title,
    });

    feedback.linkedTaskCode = task.code;
    feedback.timeline.push(step(`Chuyển thành nhiệm vụ ${task.code}`, SYSTEM_ACTOR, 'cur'));
    await feedback.save();

    this.logger.log(`Phản ánh ${feedback.code} → nhiệm vụ ${task.code} (cán bộ ${assignee})`);

    // Kênh phụ (P5-04) — xem chú thích ở createTaskFromDocument
    void this.messaging.publish(EVENTS.FEEDBACK_ASSIGNED, {
      feedbackId: String(feedback._id),
      code: feedback.code,
      title,
      categoryKey: payload.categoryKey || feedback.categoryKey,
      department,
      assignee,
      taskCode: task.code,
    } satisfies FeedbackAssignedEvent & { taskCode: string });

    return { code: task.code };
  }

  /* ───────────────── Đồng bộ ngược về bản ghi nguồn ───────────────── */

  /**
   * Nhiệm vụ hoàn thành thì cập nhật trạng thái bản ghi nguồn
   * (văn bản → 'xong', phản ánh → 'resolved') kèm ghi nhật ký.
   */
  async syncTaskStatusToSource(taskCode: string, status: string): Promise<void> {
    if (status !== TASK_STATUS_DONE) return; // chỉ đồng bộ khi nhiệm vụ đã hoàn thành

    const task = await this.tasks.findByCode(taskCode);
    if (!task.sourceRefId) return; // nhiệm vụ nội bộ, không có nguồn

    if (task.sourceType === SOURCE_TYPE_DOCUMENT) {
      const doc = await this.documentModel.findById(task.sourceRefId).exec();
      if (!doc) return;
      doc.status = DOCUMENT_STATUS_DONE;
      doc.timeline.push(step(`Hoàn thành xử lý theo nhiệm vụ ${taskCode}`, SYSTEM_ACTOR, 'cur'));
      await doc.save();
      this.logger.log(`Nhiệm vụ ${taskCode} hoàn thành → văn bản ${doc.refNo} chuyển 'xong'`);
      return;
    }

    if (task.sourceType === SOURCE_TYPE_FEEDBACK) {
      const feedback = await this.feedbackModel.findById(task.sourceRefId).exec();
      if (!feedback) return;
      feedback.status = FEEDBACK_STATUS_RESOLVED;
      feedback.timeline.push(step(`Hoàn thành xử lý theo nhiệm vụ ${taskCode}`, SYSTEM_ACTOR, 'cur'));
      await feedback.save();
      this.logger.log(`Nhiệm vụ ${taskCode} hoàn thành → phản ánh ${feedback.code} chuyển 'resolved'`);
      // TODO: phát NotificationRequestedEvent (ZNS báo công dân) khi NotificationModule sẵn sàng
    }
  }

  /* ───────────────── CronJob nhắc hạn ───────────────── */

  /**
   * 07:00 hằng ngày: quét nhiệm vụ chưa hoàn thành sắp/đã đến hạn.
   * Nhiệm vụ quá hạn tự chuyển trạng thái 'qua' và ghi nhật ký.
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async warnTaskDeadlines(): Promise<{ overdue: number; upcoming: number }> {
    const { now, overdue, upcoming } = await this.tasks.findDeadlineWarnings(DEADLINE_WARNING_DAYS);

    for (const task of overdue) {
      await this.tasks.markOverdue(task);
      this.logger.warn(
        `QUÁ HẠN — ${task.code} "${task.title}" | ${task.assignee} | hạn ${task.deadline} ` +
          `(trễ ${Math.abs(this.tasks.daysLeft(task, now))} ngày)`,
      );
      // CronJob chạy nền, không có ai đang chờ phản hồi → await được để log theo đúng thứ tự
      await this.publishDeadlineWarning(task, now);
    }

    for (const task of upcoming) {
      this.logger.log(
        `SẮP ĐẾN HẠN — ${task.code} "${task.title}" | ${task.assignee} | hạn ${task.deadline} ` +
          `(còn ${this.tasks.daysLeft(task, now)} ngày)`,
      );
      await this.publishDeadlineWarning(task, now);
    }

    this.logger.log(
      `Nhắc hạn nhiệm vụ: ${overdue.length} quá hạn, ${upcoming.length} đến hạn trong ${DEADLINE_WARNING_DAYS} ngày`,
    );
    return { overdue: overdue.length, upcoming: upcoming.length };
  }

  /** 07:00 hằng ngày: cảnh báo phiếu phản ánh sắp/đã hết hạn SLA */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async warnFeedbackSla(): Promise<{ overdue: number; upcoming: number }> {
    const now = new Date();
    const threshold = new Date(now.getTime() + FEEDBACK_SLA_WARNING_HOURS * 60 * 60 * 1000);

    const items = await this.feedbackModel
      .find({
        status: { $ne: FEEDBACK_STATUS_RESOLVED },
        slaDueAt: { $ne: null, $lte: threshold },
      })
      .sort({ slaDueAt: 1 })
      .exec();

    let overdue = 0;
    for (const item of items) {
      const due = item.slaDueAt as Date;
      const isOverdue = due < now;
      if (isOverdue) overdue++;
      const label = isOverdue ? 'QUÁ HẠN SLA' : 'SẮP HẾT HẠN SLA';
      this.logger.warn(
        `${label} — ${item.code} "${item.title}" | ${item.assignee || item.department || 'chưa phân công'} ` +
          `| hạn ${formatVnDateTime(due)}`,
      );
      // TODO: gửi cảnh báo cho cán bộ phụ trách qua NotificationModule (module khác đảm nhiệm)
    }

    this.logger.log(
      `Cảnh báo SLA phản ánh: ${overdue} quá hạn, ${items.length - overdue} sắp hết hạn trong ${FEEDBACK_SLA_WARNING_HOURS} giờ`,
    );
    return { overdue, upcoming: items.length - overdue };
  }

  /** Danh sách nhiệm vụ sắp/quá hạn phục vụ màn hình cảnh báo của FE */
  async listDeadlineWarnings(withinDays = DEADLINE_WARNING_DAYS) {
    const { now, overdue, upcoming } = await this.tasks.findDeadlineWarnings(withinDays);
    const toItem = (task: TaskDocument) => ({
      code: task.code,
      title: task.title,
      assignee: task.assignee,
      department: task.department,
      deadline: task.deadline,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      daysLeft: this.tasks.daysLeft(task, now),
    });

    return {
      withinDays,
      overdue: overdue.map(toItem),
      upcoming: upcoming.map(toItem),
      total: overdue.length + upcoming.length,
    };
  }

  /* ─────────────────────────── Nội bộ ─────────────────────────── */

  /**
   * Phát sự kiện nhắc hạn một nhiệm vụ vào hàng đợi (P5-04).
   *
   * `taskId` mang MÃ nhiệm vụ (NV-xxxx) chứ không phải ObjectId: người nhận thông
   * báo cần mã tra cứu được trên giao diện, và hợp đồng sự kiện ở libs/shared
   * (không sửa trong task này) chỉ có đúng một trường định danh.
   */
  private async publishDeadlineWarning(task: TaskDocument, now: Date): Promise<void> {
    await this.messaging.publish(EVENTS.TASK_DEADLINE_WARNING, {
      taskId: task.code,
      title: task.title,
      assignee: task.assignee,
      deadline: task.deadline,
      daysLeft: this.tasks.daysLeft(task, now),
    } satisfies TaskDeadlineWarningEvent);
  }

  /** Lấy văn bản theo id, báo lỗi tiếng Việt khi id sai hoặc không tồn tại */
  private async loadDocument(documentId: string): Promise<IncomingDocumentDocument> {
    if (!isValidObjectId(documentId)) throw new BadRequestException('Mã văn bản không hợp lệ');
    const doc = await this.documentModel.findById(documentId).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy văn bản đến');
    return doc;
  }

  /** Lấy phiếu phản ánh theo id, báo lỗi tiếng Việt khi id sai hoặc không tồn tại */
  private async loadFeedback(feedbackId: string): Promise<FeedbackDocument> {
    if (!isValidObjectId(feedbackId)) throw new BadRequestException('Mã phiếu phản ánh không hợp lệ');
    const feedback = await this.feedbackModel.findById(feedbackId).exec();
    if (!feedback) throw new NotFoundException('Không tìm thấy phiếu phản ánh');
    return feedback;
  }

  /**
   * Chọn hạn xử lý cho nhiệm vụ theo thứ tự ưu tiên:
   * chuỗi truyền vào → chuỗi của bản ghi nguồn → mốc Date của bản ghi nguồn
   * → mặc định [fallbackDays] ngày kể từ hôm nay.
   */
  private pickDeadline(
    preferred?: string,
    sourceDeadline?: string,
    sourceDeadlineAt?: Date,
    fallbackDays = DEADLINE_WARNING_DAYS,
  ): string {
    if (preferred && parseVnDate(preferred)) return preferred;
    if (sourceDeadline && parseVnDate(sourceDeadline)) return sourceDeadline;
    if (sourceDeadlineAt) return formatVnDate(new Date(sourceDeadlineAt));
    return formatVnDate(new Date(Date.now() + fallbackDays * MS_PER_DAY));
  }
}

/** Tạo một mục nhật ký cho bản ghi nguồn (văn bản / phản ánh) */
function step(title: string, actor: string, state: 'ok' | 'cur' = 'ok'): TimelineStep {
  return { title, meta: `${formatVnDateTime(new Date())} · ${actor}`, state };
}
