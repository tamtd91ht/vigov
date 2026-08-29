import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type FilterQuery } from 'mongoose';
import {
  Task,
  type ChecklistItem,
  type JwtPayload,
  type TaskDocument,
  type TimelineStep,
} from '@vigov/shared';
import { REALTIME_EVENTS, RealtimeService } from '../realtime/realtime.service';
import type {
  CreateCommentDto,
  CreateTaskDto,
  QueryTasksDto,
  UpdateTaskDto,
} from './dto/task.dto';

/* ───────────────── Hằng số cấu hình của phân hệ Nhiệm vụ ───────────────── */

/** Trang mặc định và số bản ghi mỗi trang khi FE không truyền */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
/** Chặn trên để tránh truy vấn nặng */
export const MAX_PAGE_SIZE = 100;

/** Tiền tố mã nhiệm vụ: NV-<năm 2 số><số thứ tự> → NV-2601 */
export const TASK_CODE_PREFIX = 'NV-';
/** Số chữ số tối thiểu của phần thứ tự trong mã */
export const TASK_SEQ_MIN_DIGITS = 2;
/** Số lần thử lại khi hai người tạo nhiệm vụ cùng lúc (trùng mã) */
const CODE_MAX_RETRY = 5;

/** Trạng thái nhiệm vụ dùng nội bộ */
export const TASK_STATUS_NEW = 'moi';
export const TASK_STATUS_WAITING_APPROVAL = 'cho';
export const TASK_STATUS_OVERDUE = 'qua';
export const TASK_STATUS_DONE = 'xong';

/** Nhãn tiếng Việt để ghi nhật ký (timeline) */
const STATUS_LABELS: Record<string, string> = {
  moi: 'Mới giao',
  dang: 'Đang thực hiện',
  cho: 'Chờ duyệt',
  qua: 'Quá hạn',
  xong: 'Hoàn thành',
};

/** Bảng màu avatar người bình luận — khớp tông màu admin-web */
const AUTHOR_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

/** Tên người giao mặc định khi không xác định được phiên đăng nhập */
const SYSTEM_ACTOR = 'Hệ thống';

/* ───────────────────────── Tiện ích ngày tháng ───────────────────────── */

/** Chuyển chuỗi dd/MM/yyyy sang Date (mốc cuối ngày để tính hạn xử lý) */
export function parseVnDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const matched = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!matched) return undefined;
  const day = Number(matched[1]);
  const month = Number(matched[2]);
  const year = Number(matched[3]);
  // Hạn tính đến hết ngày 23:59:59
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined; // ngày không tồn tại (31/02/2026...)
  }
  return date;
}

/** Định dạng Date thành chuỗi dd/MM/yyyy cho FE */
export function formatVnDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Định dạng mốc thời gian ghi nhật ký: HH:mm dd/MM/yyyy */
export function formatVnDateTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mi} ${formatVnDate(date)}`;
}

/** Thoát ký tự đặc biệt trước khi ghép vào biểu thức chính quy tìm kiếm */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Chữ cái viết tắt của người bình luận (Nguyễn Văn A → VA) */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  const picked = words.slice(-2);
  return picked.map((w) => w[0]?.toUpperCase() ?? '').join('') || 'CB';
}

/** Chọn màu avatar ổn định theo tên (cùng người → cùng màu) */
function colorOf(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AUTHOR_COLORS[hash % AUTHOR_COLORS.length];
}

/** Tiến độ = số việc con đã xong / tổng số việc con */
function calcProgress(checklist: ChecklistItem[]): number {
  if (!checklist || checklist.length === 0) return 0;
  const done = checklist.filter((item) => item.done).length;
  return Math.round((done / checklist.length) * 100);
}

/** Lỗi trùng khoá của MongoDB */
function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/** Tham số tạo nhiệm vụ từ nguồn khác (văn bản / phản ánh) — dùng bởi WorkflowService */
export interface CreateTaskFromSourceInput {
  title: string;
  assignee: string;
  department: string;
  /** dd/MM/yyyy */
  deadline: string;
  assigner: string;
  sourceType: string;
  sourceLabel: string;
  sourceRefId: string;
  priority?: string;
  description?: string;
}

/* ───────────────────────────── Service ───────────────────────────── */

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly realtime: RealtimeService,
  ) {}

  /** Danh sách nhiệm vụ có lọc + phân trang */
  async list(query: QueryTasksDto) {
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const filter: FilterQuery<TaskDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.assignee) filter.assignee = query.assignee;
    if (query.priority) filter.priority = query.priority;

    const keyword = query.q?.trim();
    if (keyword) {
      const rx = new RegExp(escapeRegex(keyword), 'i');
      filter.$or = [{ code: rx }, { title: rx }, { description: rx }, { assignee: rx }];
    }

    const [items, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.taskModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  /** Chi tiết nhiệm vụ theo mã NV-xxxx (404 nếu không có) */
  async findByCode(code: string): Promise<TaskDocument> {
    const task = await this.taskModel.findOne({ code }).exec();
    if (!task) throw new NotFoundException(`Không tìm thấy nhiệm vụ ${code}`);
    return task;
  }

  /** Tạo nhiệm vụ mới từ Web Quản trị */
  async create(dto: CreateTaskDto, user?: JwtPayload): Promise<TaskDocument> {
    const deadlineAt = parseVnDate(dto.deadline);
    if (!deadlineAt) throw new BadRequestException('Hạn xử lý không hợp lệ (dd/MM/yyyy)');

    const actor = user?.displayName ?? SYSTEM_ACTOR;
    const checklist: ChecklistItem[] = (dto.checklist ?? []).map((item) => ({
      title: item.title,
      done: item.done ?? false,
    }));

    return this.insertWithGeneratedCode({
      title: dto.title,
      assignee: dto.assignee,
      department: dto.department,
      deadline: dto.deadline,
      deadlineAt,
      priority: dto.priority ?? 'tb',
      description: dto.description ?? '',
      status: TASK_STATUS_NEW,
      progress: calcProgress(checklist),
      assigner: actor,
      collaborators: dto.collaborators ?? [],
      sourceType: dto.sourceType ?? 'hop',
      sourceLabel: dto.sourceLabel ?? '',
      checklist,
      comments: [],
      timeline: [this.buildTimelineStep('Giao nhiệm vụ', actor, 'cur')],
      attachments: [],
    });
  }

  /**
   * Tạo nhiệm vụ từ nguồn xuyên phân hệ (văn bản đến / phản ánh).
   * Dùng bởi WorkflowModule — P3-30.
   */
  async createFromSource(input: CreateTaskFromSourceInput): Promise<TaskDocument> {
    const deadlineAt = parseVnDate(input.deadline);
    if (!deadlineAt) throw new BadRequestException('Hạn xử lý không hợp lệ (dd/MM/yyyy)');

    return this.insertWithGeneratedCode({
      title: input.title,
      assignee: input.assignee,
      department: input.department,
      deadline: input.deadline,
      deadlineAt,
      priority: input.priority ?? 'tb',
      description: input.description ?? '',
      status: TASK_STATUS_NEW,
      progress: 0,
      assigner: input.assigner || SYSTEM_ACTOR,
      collaborators: [],
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      sourceRefId: input.sourceRefId,
      checklist: [],
      comments: [],
      timeline: [this.buildTimelineStep('Giao nhiệm vụ', input.assigner || SYSTEM_ACTOR, 'cur')],
      attachments: [],
    });
  }

  /** Cập nhật nhiệm vụ; đổi trạng thái / tiến độ sẽ ghi thêm mục nhật ký */
  async update(code: string, dto: UpdateTaskDto, user?: JwtPayload): Promise<TaskDocument> {
    const task = await this.findByCode(code);
    const actor = user?.displayName ?? SYSTEM_ACTOR;

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.assignee !== undefined) task.assignee = dto.assignee;
    if (dto.department !== undefined) task.department = dto.department;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.collaborators !== undefined) task.collaborators = dto.collaborators;

    if (dto.deadline !== undefined) {
      const deadlineAt = parseVnDate(dto.deadline);
      if (!deadlineAt) throw new BadRequestException('Hạn xử lý không hợp lệ (dd/MM/yyyy)');
      task.deadline = dto.deadline;
      task.deadlineAt = deadlineAt;
    }

    if (dto.checklist !== undefined) {
      task.checklist = dto.checklist.map((item) => ({ title: item.title, done: item.done ?? false }));
      task.progress = calcProgress(task.checklist);
      task.markModified('checklist');
    }

    // Ghi nhật ký khi tiến độ thay đổi (trước khi đổi trạng thái để giữ thứ tự đọc)
    if (dto.progress !== undefined && dto.progress !== task.progress) {
      task.progress = dto.progress;
      task.timeline.push(this.buildTimelineStep(`Cập nhật tiến độ ${dto.progress}%`, actor));
    }

    const statusChanged = dto.status !== undefined && dto.status !== task.status;
    if (dto.status !== undefined && statusChanged) {
      const label = STATUS_LABELS[dto.status] ?? dto.status;
      task.status = dto.status;
      if (dto.status === TASK_STATUS_DONE) task.progress = 100;
      task.timeline.push(this.buildTimelineStep(`Chuyển trạng thái: ${label}`, actor, 'cur'));
    }

    await task.save();
    // Cập nhật thời gian thực (P5-05): chỉ báo khi trạng thái đổi, tránh làm phiền client
    if (statusChanged) this.emitTaskChanged('status', task);
    return task;
  }

  /**
   * Tick / bỏ tick một việc con → tính lại tiến độ.
   * Hoàn thành 100% mà chưa 'xong' thì chuyển sang 'cho' (chờ duyệt).
   */
  async toggleChecklistItem(
    code: string,
    index: number,
    done: boolean | undefined,
    user?: JwtPayload,
  ): Promise<TaskDocument> {
    const task = await this.findByCode(code);
    if (!Number.isInteger(index) || index < 0 || index >= task.checklist.length) {
      throw new NotFoundException(`Không tìm thấy việc con số ${index} trong nhiệm vụ ${code}`);
    }

    const actor = user?.displayName ?? SYSTEM_ACTOR;
    const item = task.checklist[index];
    item.done = done ?? !item.done;
    task.markModified('checklist');
    task.progress = calcProgress(task.checklist);

    let statusChanged = false;
    if (task.progress === 100 && task.status !== TASK_STATUS_DONE) {
      statusChanged = task.status !== TASK_STATUS_WAITING_APPROVAL;
      task.status = TASK_STATUS_WAITING_APPROVAL;
      task.timeline.push(
        this.buildTimelineStep('Hoàn thành toàn bộ việc con — chờ lãnh đạo duyệt', actor, 'cur'),
      );
    }

    await task.save();
    // Tick hết việc con làm nhiệm vụ chuyển sang "chờ duyệt" — lãnh đạo cần biết ngay (P5-05)
    if (statusChanged) this.emitTaskChanged('status', task);
    return task;
  }

  /** Thêm bình luận trao đổi trong nhiệm vụ */
  async addComment(code: string, dto: CreateCommentDto, user?: JwtPayload): Promise<TaskDocument> {
    const task = await this.findByCode(code);
    const authorName = user?.displayName ?? SYSTEM_ACTOR;

    task.comments.push({
      authorName,
      authorInitials: initialsOf(authorName),
      authorColor: colorOf(authorName),
      time: formatVnDateTime(new Date()),
      content: dto.content,
    });

    await task.save();
    return task;
  }

  /** Xoá nhiệm vụ — chỉ quản trị hệ thống */
  async remove(code: string): Promise<{ deleted: boolean; code: string }> {
    const result = await this.taskModel.deleteOne({ code }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Không tìm thấy nhiệm vụ ${code}`);
    return { deleted: true, code };
  }

  /**
   * Nhiệm vụ chưa hoàn thành có hạn trong [withinDays] ngày tới hoặc đã quá hạn.
   * Dùng cho CronJob nhắc hạn và endpoint GET /workflow/deadline-warnings (P3-30).
   */
  async findDeadlineWarnings(withinDays: number): Promise<{
    now: Date;
    overdue: TaskDocument[];
    upcoming: TaskDocument[];
  }> {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const items = await this.taskModel
      .find({
        status: { $ne: TASK_STATUS_DONE },
        deadlineAt: { $ne: null, $lte: threshold },
      })
      .sort({ deadlineAt: 1 })
      .exec();

    const overdue = items.filter((t) => t.deadlineAt !== undefined && t.deadlineAt < now);
    const upcoming = items.filter((t) => t.deadlineAt !== undefined && t.deadlineAt >= now);
    return { now, overdue, upcoming };
  }

  /** Đánh dấu nhiệm vụ quá hạn + ghi nhật ký (CronJob gọi) */
  async markOverdue(task: TaskDocument): Promise<TaskDocument> {
    if (task.status === TASK_STATUS_OVERDUE || task.status === TASK_STATUS_DONE) return task;
    task.status = TASK_STATUS_OVERDUE;
    task.timeline.push(
      this.buildTimelineStep(`Nhiệm vụ quá hạn (hạn ${task.deadline})`, SYSTEM_ACTOR, 'cur'),
    );
    await task.save();
    this.emitTaskChanged('status', task);
    return task;
  }

  /** Số ngày còn lại tới hạn (âm = đã quá hạn) */
  daysLeft(task: TaskDocument, from: Date = new Date()): number {
    if (!task.deadlineAt) return 0;
    return Math.ceil((task.deadlineAt.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  }

  /* ─────────────────────────── Nội bộ ─────────────────────────── */

  /**
   * Phát tín hiệu "nhiệm vụ vừa đổi" qua Socket.IO (P5-05).
   *
   * Gói tin cố tình gọn ({type, code, status, at}) — client nhận rồi tự tải lại
   * danh sách/chi tiết theo quyền của mình. RealtimeService nuốt mọi lỗi nên lời
   * gọi này không thể làm hỏng nghiệp vụ đang chạy.
   */
  private emitTaskChanged(type: 'created' | 'status', task: TaskDocument): void {
    this.realtime.emitChange(
      REALTIME_EVENTS.TASK_CHANGED,
      { type, code: task.code, status: task.status, at: new Date().toISOString() },
      { department: task.department, user: task.assignee },
    );
  }

  /** Tạo một mục nhật ký chuẩn */
  private buildTimelineStep(title: string, actor: string, state: 'ok' | 'cur' = 'ok'): TimelineStep {
    return { title, meta: `${formatVnDateTime(new Date())} · ${actor}`, state };
  }

  /**
   * Sinh mã NV-<năm 2 số><số thứ tự> theo bản ghi lớn nhất hiện có trong năm.
   * Quy mô cấp xã nên duyệt trong bộ nhớ là đủ nhanh và chính xác khi số
   * thứ tự vượt 2 chữ số (NV-2699 → NV-26100).
   */
  private async generateCode(): Promise<string> {
    const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
    const prefix = `${TASK_CODE_PREFIX}${yy}`;

    const rows = await this.taskModel
      .find({ code: new RegExp(`^${prefix}\\d+$`) })
      .select('code')
      .lean<{ code: string }[]>()
      .exec();

    let max = 0;
    for (const row of rows) {
      const seq = Number.parseInt(row.code.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
    return `${prefix}${String(max + 1).padStart(TASK_SEQ_MIN_DIGITS, '0')}`;
  }

  /** Ghi bản ghi mới kèm sinh mã, thử lại khi trùng mã do tạo đồng thời */
  private async insertWithGeneratedCode(payload: Partial<Task>): Promise<TaskDocument> {
    for (let attempt = 1; attempt <= CODE_MAX_RETRY; attempt++) {
      const code = await this.generateCode();
      try {
        const created = await this.taskModel.create({ ...payload, code });
        // Điểm chung của mọi đường tạo nhiệm vụ (thủ công và sinh từ văn bản/phản ánh)
        this.emitTaskChanged('created', created);
        return created;
      } catch (error) {
        if (isDuplicateKeyError(error) && attempt < CODE_MAX_RETRY) {
          this.logger.warn(`Mã ${code} đã tồn tại, sinh lại (lần ${attempt})`);
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('Không sinh được mã nhiệm vụ, vui lòng thử lại');
  }
}
