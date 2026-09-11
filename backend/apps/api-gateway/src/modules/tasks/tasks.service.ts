import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type FilterQuery } from 'mongoose';
import {
  IS_DELETED,
  NOT_DELETED,
  Task,
  activity,
  buildEpochRangeFilter,
  comment,
  daysLeftMs,
  endOfVnDayMs,
  nowMs,
  markDeleted,
  markRestored,
  type ChecklistItem,
  type JwtPayload,
  type TaskDocument,
  type ActivityEntry,
} from '@vigov/shared';
import { DirectoryService, type DirectoryLookup } from '../directory/directory.service';
import { FilesService } from '../files/files.service';
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

/**
 * Số dòng tối đa của một tệp Excel xuất ra.
 *
 * Hằng số KỸ THUẬT, không phụ thuộc khách hàng: quá ngưỡng này thì máy chủ phải
 * giữ cả bảng trong bộ nhớ để dựng workbook, và tệp mở ra cũng nặng. Vượt ngưỡng
 * thì báo cán bộ thu hẹp bộ lọc thay vì cắt bớt dòng.
 */
export const MAX_EXPORT_ROWS = 5000;

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

/**
 * Khoá hành động ghi vào nhật ký xử lý — khuôn `ActivityEntry` của v2.
 *
 * Chỉ là KHOÁ, không phải nhãn hiển thị. Nhãn tiếng Việt do client tra từ
 * `admin-web/src/config/activity.config.ts`; bảng nhãn nằm trong cơ sở dữ liệu
 * như bản v1 nghĩa là đổi cách gọi một trạng thái phải sửa dữ liệu lịch sử.
 */
const ACT = {
  assign: 'task.assign',
  progress: 'task.progress',
  status: 'task.status',
  checklistDone: 'task.checklist-done',
  attach: 'task.attach',
  detach: 'task.detach',
  delete: 'task.delete',
  restore: 'task.restore',
  overdue: 'task.overdue',
} as const;

/** Tên người giao mặc định khi không xác định được phiên đăng nhập */
const SYSTEM_ACTOR = 'Hệ thống';


/* ───────────────────────── Tiện ích ngày tháng ───────────────────────── */

/*
 * `parseVnDate` và `formatVnDate` đã bỏ. Chúng là bản thứ hai của cùng một phép
 * quy đổi (bản thứ ba nằm ở `disbursement/progress.ts`), và bản ở đây neo vào
 * giờ MÁY CHỦ nên trên container UTC hạn bị nới thêm 7 giờ. Dùng
 * `parseVnDateMs` / `formatVnDateMs` / `endOfVnDayMs` của `@vigov/shared`.
 */

/*
 * `formatVnDateTime` đã bỏ: nhật ký và bình luận v2 lưu thời điểm dạng SỐ
 * (`ActivityEntry.at`, `Comment.at`), không còn chuỗi đã định dạng sẵn. Việc
 * định dạng chuyển sang tầng hiển thị; bản dùng cho tệp xuất nằm ở
 * `formatVnDateTimeMs` trong `@vigov/shared`.
 */

/** Thoát ký tự đặc biệt trước khi ghép vào biểu thức chính quy tìm kiếm */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/*
 * `initialsOf` và `colorOf` đã bỏ: chữ viết tắt và màu avatar là cách TRÌNH BÀY,
 * tính được từ tên nên không có lý do lưu vào cơ sở dữ liệu. `admin-web` đã có
 * component `Avatar` tự tính hai thứ này từ tên đã resolve.
 */

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

/** Siêu dữ liệu tệp minh chứng trả kèm chi tiết nhiệm vụ */
export interface TaskAttachmentFile {
  fileId: string;
  name: string;
  size: number;
  contentType: string;
}

/** Tham số tạo nhiệm vụ từ nguồn khác (văn bản / phản ánh) — dùng bởi WorkflowService */
export interface CreateTaskFromSourceInput {
  title: string;
  /** `staff_users._id` */
  assigneeId: string;
  /** `org_nodes._id` */
  departmentId: string;
  /** Hạn xử lý — milli-giây UTC; máy chủ tự chuẩn hoá về hết ngày giờ Việt Nam */
  deadline: number;
  /** `staff_users._id` của người giao; rỗng nghĩa là hệ thống sinh */
  assignerId: string;
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
    private readonly files: FilesService,
    private readonly directory: DirectoryService,
  ) {}

  /**
   * Gắn tên hiển thị cho các tham chiếu của MỘT nhiệm vụ.
   *
   * Bản ghi lưu id; phản hồi mang cả id và tên để client vừa hiển thị được vừa
   * gửi lại được khi sửa (`ResolvedRef` trong `refs.ts`).
   *
   * Nhận `lookup` từ bên ngoài thay vì tự tra: một danh sách 20 nhiệm vụ phải
   * tốn MỘT lượt đọc danh bạ, không phải hai mươi.
   */
  private withRefs(task: object, lookup: DirectoryLookup) {
    const row = task as Record<string, unknown>;
    const legacy = (row.legacyRefs ?? {}) as Record<string, string>;
    return {
      ...row,
      assignee: lookup.staffRef(row.assigneeId as string, legacy.assignee),
      assigner: lookup.staffRef(row.assignerId as string, legacy.assigner),
      department: lookup.departmentRef(row.departmentId as string, legacy.department),
      collaborators: lookup.staffRefs(row.collaboratorIds as string[]),
    };
  }

  /**
   * Điều kiện lọc danh sách nhiệm vụ.
   *
   * Tách riêng để `list()` (phân trang) và `listForExport()` (xuất Excel) dùng
   * CHUNG một bộ điều kiện. Nếu mỗi bên tự dựng thì tệp xuất và bảng trên màn
   * hình sẽ lệch nhau — người dùng thấy 12 dòng mà tệp có 15 dòng, không ai
   * hiểu vì sao và không tin số liệu nữa.
   */
  private buildListFilter(query: QueryTasksDto): FilterQuery<TaskDocument> {
    // Mặc định ẩn nhiệm vụ đã xoá mềm; `deleted=true` là bộ lọc xem riêng thùng đã xoá
    const filter: FilterQuery<TaskDocument> = {
      ...(query.deleted ? IS_DELETED : NOT_DELETED),
    };
    /* Lọc chọn nhiều dùng `$in`. Mảng rỗng đã bị `toStringArray` quy về
       undefined ở DTO, nên không có nguy cơ `$in: []` khớp không bản ghi nào */
    if (query.status?.length) filter.status = { $in: query.status };
    if (query.departmentId) filter.departmentId = query.departmentId;
    if (query.assigneeId?.length) filter.assigneeId = { $in: query.assigneeId };
    if (query.priority?.length) filter.priority = { $in: query.priority };

    // Khoảng thời gian tính theo ngày giờ Việt Nam — xem buildEpochRangeFilter
    const range = buildEpochRangeFilter('createdAt', query.from, query.to);
    if (range) Object.assign(filter, range);

    const keyword = query.q?.trim();
    if (keyword) {
      const rx = new RegExp(escapeRegex(keyword), 'i');
      filter.$or = [{ code: rx }, { title: rx }, { description: rx }, { assignee: rx }];
    }
    return filter;
  }

  /**
   * Toàn bộ nhiệm vụ khớp bộ lọc, để xuất Excel.
   *
   * CHẶN Ở NGƯỠNG thay vì cắt bớt im lặng: một tệp thiếu dòng mà không báo gì
   * là tệp sai đi vào hồ sơ. Vượt ngưỡng thì báo cán bộ thu hẹp bộ lọc.
   */
  async listForExport(query: QueryTasksDto) {
    const filter = this.buildListFilter(query);
    const total = await this.taskModel.countDocuments(filter).exec();
    if (total > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Bộ lọc hiện khớp ${total} nhiệm vụ, vượt giới hạn ${MAX_EXPORT_ROWS} dòng mỗi tệp. ` +
          'Vui lòng thu hẹp khoảng thời gian hoặc thêm bộ lọc rồi xuất lại.',
      );
    }
    const [rows, lookup] = await Promise.all([
      this.taskModel.find(filter).sort({ createdAt: -1 }).lean().exec(),
      this.directory.lookup(),
    ]);
    return rows.map((row) => this.withRefs(row, lookup));
  }

  /** Danh sách nhiệm vụ có lọc + phân trang */
  async list(query: QueryTasksDto) {
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const filter = this.buildListFilter(query);

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

    // MỘT lượt đọc danh bạ cho cả trang, không phải một lượt mỗi dòng
    const lookup = await this.directory.lookup();
    return { items: items.map((item) => this.withRefs(item, lookup)), total, page, limit };
  }

  /**
   * Chi tiết nhiệm vụ theo mã NV-xxxx (404 nếu không có).
   *
   * Nhiệm vụ đã xoá mềm coi như không tồn tại với mọi đường ghi (sửa, tick việc
   * con, bình luận, đính kèm) — nếu không thì bản ghi trong thùng đã xoá vẫn
   * sửa được qua API dù giao diện không còn chỗ bấm. Xem chi tiết bản đã xoá
   * thì dùng `detail(code, { includeDeleted: true })`.
   */
  async findByCode(code: string, options?: { includeDeleted?: boolean }): Promise<TaskDocument> {
    const filter: FilterQuery<TaskDocument> = options?.includeDeleted
      ? { code }
      : { code, ...NOT_DELETED };
    const task = await this.taskModel.findOne(filter).exec();
    if (!task) throw new NotFoundException(`Không tìm thấy nhiệm vụ ${code}`);
    return task;
  }

  /**
   * Chi tiết nhiệm vụ kèm siêu dữ liệu tệp minh chứng.
   *
   * Bản ghi chỉ lưu mã tệp; tên, dung lượng và loại tệp nằm ở module Files.
   * Nếu không trả kèm thì giao diện phải gọi thêm một lượt cho mỗi mã tệp chỉ
   * để hiện được tên tệp.
   */
  async detail(code: string): Promise<Record<string, unknown>> {
    // Bản đã xoá mềm vẫn phải mở xem được để cán bộ kiểm tra trước khi khôi phục
    const task = await this.findByCode(code, { includeDeleted: true });
    return this.withAttachmentFiles(task);
  }

  /**
   * Gắn tệp minh chứng đã tải lên module Files vào nhiệm vụ.
   *
   * Kiểm tra từng mã tệp TRƯỚC khi ghi: mã không tồn tại thì 404 ngay thay vì
   * để lại một mã chết trong bản ghi mà giao diện không tra được. Tệp công khai
   * bị từ chối — hồ sơ minh chứng nhiệm vụ là tài liệu nội bộ, mà `GET /files/:id`
   * để `@Public()` nên tệp `isPrivate = false` chỉ được che bằng độ khó đoán của
   * ObjectId (quy ước TB-09 trong SECURITY.md).
   *
   * Mã đã gắn rồi thì bỏ qua, không nhân bản.
   */
  async addAttachments(code: string, fileIds: string[], user?: JwtPayload): Promise<Record<string, unknown>> {
    const task = await this.findByCode(code);
    const names: string[] = [];
    const added: string[] = [];
    for (const fileId of fileIds) {
      const file = await this.files.findPrivateById(fileId, 'Tệp minh chứng nhiệm vụ');
      if (task.attachmentFileIds.includes(fileId)) continue;
      task.attachmentFileIds.push(fileId);
      added.push(fileId);
      names.push(file.originalName);
    }

    if (added.length > 0) {
      task.markModified('attachmentFileIds');
      task.timeline.push(
        /* `detail` chỉ ghi SỐ LƯỢNG: tên tệp minh chứng có thể mang tên người và
           nội dung vụ việc, mà nhật ký hiển thị cho mọi cán bộ xem được nhiệm vụ.
           Tên tệp đã nằm ở `attachmentFiles` của bản ghi. */
        activity(ACT.attach, { actorId: user?.sub, detail: String(added.length) }),
      );
      await task.save();
    }
    return this.withAttachmentFiles(task);
  }

  /** Gỡ một tệp minh chứng khỏi nhiệm vụ — tệp vẫn còn trong module Files */
  async removeAttachment(code: string, fileId: string, user?: JwtPayload): Promise<Record<string, unknown>> {
    const task = await this.findByCode(code);
    const index = task.attachmentFileIds.indexOf(fileId);
    if (index < 0) {
      throw new NotFoundException(`Nhiệm vụ ${code} không có tệp đính kèm ${fileId}`);
    }

    task.attachmentFileIds.splice(index, 1);
    task.markModified('attachmentFileIds');
    task.timeline.push(
      activity(ACT.detach, { actorId: user?.sub }),
    );
    await task.save();
    return this.withAttachmentFiles(task);
  }

  /**
   * Bổ sung `attachmentFiles` vào phản hồi chi tiết nhiệm vụ.
   *
   * Mã tệp không tra được (tệp đã bị xoá khỏi kho) bị BỎ QUA thay vì làm cả
   * lời gọi thất bại — nhiệm vụ vẫn phải mở xem được khi một tệp minh chứng cũ
   * đã bị dọn. `attachments` cũ giữ nguyên trong phản hồi.
   */
  private async withAttachmentFiles(task: TaskDocument): Promise<Record<string, unknown>> {
    const attachmentFiles: TaskAttachmentFile[] = [];
    for (const fileId of task.attachmentFileIds ?? []) {
      try {
        const file = await this.files.findById(fileId);
        attachmentFiles.push({
          fileId: String(file._id),
          name: file.originalName,
          size: file.size,
          contentType: file.mimeType,
        });
      } catch {
        this.logger.warn(`Nhiệm vụ ${task.code} tham chiếu tệp ${fileId} không còn trong kho`);
      }
    }
    const lookup = await this.directory.lookup();
    return { ...this.withRefs(task.toObject(), lookup), attachmentFiles };
  }

  /** Tạo nhiệm vụ mới từ Web Quản trị */
  async create(dto: CreateTaskDto, user?: JwtPayload): Promise<TaskDocument> {
    /* Chuẩn hoá về hết ngày giờ Việt Nam: hạn hành chính là một NGÀY, và luật
       đó phải nằm ở máy chủ để client không gửi 00:00 làm ngắn mất một ngày */
    const deadline = endOfVnDayMs(dto.deadline);

    const checklist: ChecklistItem[] = (dto.checklist ?? []).map((item) => ({
      title: item.title,
      done: item.done ?? false,
    }));

    return this.insertWithGeneratedCode({
      title: dto.title,
      assigneeId: dto.assigneeId,
      departmentId: dto.departmentId,
      deadline,
      priority: dto.priority ?? 'tb',
      description: dto.description ?? '',
      status: TASK_STATUS_NEW,
      progress: calcProgress(checklist),
      assignerId: user?.sub ?? '',
      collaboratorIds: dto.collaboratorIds ?? [],
      sourceType: dto.sourceType ?? 'hop',
      sourceLabel: dto.sourceLabel ?? '',
      checklist,
      comments: [],
      timeline: [activity(ACT.assign, { actorId: user?.sub, state: 'cur' })],
      attachments: [],
      attachmentFileIds: [],
    });
  }

  /**
   * Tạo nhiệm vụ từ nguồn xuyên phân hệ (văn bản đến / phản ánh).
   * Dùng bởi WorkflowModule — P3-30.
   */
  async createFromSource(input: CreateTaskFromSourceInput): Promise<TaskDocument> {
    const deadline = endOfVnDayMs(input.deadline);

    return this.insertWithGeneratedCode({
      title: input.title,
      assigneeId: input.assigneeId,
      departmentId: input.departmentId,
      deadline,
      priority: input.priority ?? 'tb',
      description: input.description ?? '',
      status: TASK_STATUS_NEW,
      progress: 0,
      assignerId: input.assignerId,
      collaboratorIds: [],
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      sourceRefId: input.sourceRefId,
      checklist: [],
      comments: [],
      // Nguồn là văn bản / phản ánh nên người giao là hệ thống: actorId để rỗng
      timeline: [activity(ACT.assign, { state: 'cur' })],
      attachments: [],
      attachmentFileIds: [],
    });
  }

  /**
   * Cập nhật nhiệm vụ; đổi trạng thái / tiến độ sẽ ghi thêm mục nhật ký.
   *
   * Trả về qua `withAttachmentFiles` như endpoint chi tiết: Web Quản trị thay
   * NGUYÊN bản ghi đang mở bằng phản hồi này, nên thiếu `attachmentFiles` là
   * danh sách tệp minh chứng biến mất khỏi ngăn chi tiết ngay sau khi lưu.
   */
  async update(code: string, dto: UpdateTaskDto, user?: JwtPayload): Promise<Record<string, unknown>> {
    const task = await this.findByCode(code);
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.assigneeId !== undefined) task.assigneeId = dto.assigneeId;
    if (dto.departmentId !== undefined) task.departmentId = dto.departmentId;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.collaboratorIds !== undefined) task.collaboratorIds = dto.collaboratorIds;

    if (dto.deadline !== undefined) task.deadline = endOfVnDayMs(dto.deadline);

    if (dto.checklist !== undefined) {
      task.checklist = dto.checklist.map((item) => ({ title: item.title, done: item.done ?? false }));
      task.progress = calcProgress(task.checklist);
      task.markModified('checklist');
    }

    // Ghi nhật ký khi tiến độ thay đổi (trước khi đổi trạng thái để giữ thứ tự đọc)
    if (dto.progress !== undefined && dto.progress !== task.progress) {
      task.progress = dto.progress;
      task.timeline.push(
        activity(ACT.progress, { actorId: user?.sub, detail: String(dto.progress) }),
      );
    }

    const statusChanged = dto.status !== undefined && dto.status !== task.status;
    if (dto.status !== undefined && statusChanged) {
      task.status = dto.status;
      if (dto.status === TASK_STATUS_DONE) task.progress = 100;
      // `detail` là KHOÁ trạng thái, không phải nhãn tiếng Việt
      task.timeline.push(
        activity(ACT.status, { actorId: user?.sub, detail: dto.status, state: 'cur' }),
      );
    }

    await task.save();
    // Cập nhật thời gian thực (P5-05): chỉ báo khi trạng thái đổi, tránh làm phiền client
    if (statusChanged) this.emitTaskChanged('status', task);
    return this.withAttachmentFiles(task);
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
  ): Promise<Record<string, unknown>> {
    const task = await this.findByCode(code);
    if (!Number.isInteger(index) || index < 0 || index >= task.checklist.length) {
      throw new NotFoundException(`Không tìm thấy việc con số ${index} trong nhiệm vụ ${code}`);
    }

    const item = task.checklist[index];
    item.done = done ?? !item.done;
    task.markModified('checklist');
    task.progress = calcProgress(task.checklist);

    let statusChanged = false;
    if (task.progress === 100 && task.status !== TASK_STATUS_DONE) {
      statusChanged = task.status !== TASK_STATUS_WAITING_APPROVAL;
      task.status = TASK_STATUS_WAITING_APPROVAL;
      task.timeline.push(
        activity(ACT.checklistDone, { actorId: user?.sub, state: 'cur' }),
      );
    }

    await task.save();
    // Tick hết việc con làm nhiệm vụ chuyển sang "chờ duyệt" — lãnh đạo cần biết ngay (P5-05)
    if (statusChanged) this.emitTaskChanged('status', task);
    return this.withAttachmentFiles(task);
  }

  /** Thêm bình luận trao đổi trong nhiệm vụ */
  async addComment(
    code: string,
    dto: CreateCommentDto,
    user?: JwtPayload,
  ): Promise<Record<string, unknown>> {
    const task = await this.findByCode(code);
    task.comments.push(comment(dto.content, { authorId: user?.sub }));

    await task.save();
    return this.withAttachmentFiles(task);
  }

  /**
   * Xoá MỀM nhiệm vụ — chỉ quản trị hệ thống.
   *
   * Chỉ đặt cờ `isDeleted`: bản ghi biến mất khỏi danh sách, mọi đường ghi báo
   * 404, nhưng nhật ký xử lý và mã tệp minh chứng vẫn còn để truy vết. Mốc xoá
   * cũng được ghi vào nhật ký của chính nhiệm vụ, nên khi khôi phục thì lý do
   * và người xoá còn đọc lại được.
   *
   * `deletedBy` lưu TÊN ĐĂNG NHẬP (khớp nhật ký kiểm toán và 3 phân hệ còn lại),
   * còn nhật ký hiển thị dùng họ tên cho cán bộ dễ đọc.
   */
  async remove(code: string, user?: JwtPayload, reason?: string): Promise<Record<string, unknown>> {
    const task = await this.findByCode(code);
    const trimmed = reason?.trim();

    markDeleted(task, user?.sub, reason);
    task.timeline.push(
      activity(ACT.delete, { actorId: user?.sub, detail: trimmed ?? '' }),
    );
    await task.save();

    // Nhiệm vụ rời khỏi mọi danh sách nên client đang mở phải tải lại (P5-05)
    this.emitTaskChanged('deleted', task);
    return this.withAttachmentFiles(task);
  }

  /** Khôi phục nhiệm vụ đã xoá mềm — dữ liệu còn nguyên nên chỉ cần bỏ cờ xoá */
  async restore(code: string, user?: JwtPayload): Promise<Record<string, unknown>> {
    const task = await this.taskModel.findOne({ code, ...IS_DELETED }).exec();
    if (!task) throw new NotFoundException(`Không tìm thấy nhiệm vụ ${code} trong thùng đã xoá`);

    markRestored(task);
    task.timeline.push(
      activity(ACT.restore, { actorId: user?.sub }),
    );
    await task.save();

    this.emitTaskChanged('restored', task);
    return this.withAttachmentFiles(task);
  }

  /**
   * Nhiệm vụ chưa hoàn thành có hạn trong [withinDays] ngày tới hoặc đã quá hạn.
   * Dùng cho CronJob nhắc hạn và endpoint GET /workflow/deadline-warnings (P3-30).
   */
  async findDeadlineWarnings(withinDays: number): Promise<{
    now: number;
    overdue: TaskDocument[];
    upcoming: TaskDocument[];
  }> {
    const now = nowMs();
    const threshold = now + withinDays * 24 * 60 * 60 * 1000;

    const items = await this.taskModel
      .find({
        ...NOT_DELETED,
        status: { $ne: TASK_STATUS_DONE },
        deadline: { $ne: null, $lte: threshold },
      })
      .sort({ deadline: 1 })
      .exec();

    const overdue = items.filter((t) => t.deadline < now);
    const upcoming = items.filter((t) => t.deadline >= now);
    return { now, overdue, upcoming };
  }

  /** Đánh dấu nhiệm vụ quá hạn + ghi nhật ký (CronJob gọi) */
  async markOverdue(task: TaskDocument): Promise<TaskDocument> {
    if (task.status === TASK_STATUS_OVERDUE || task.status === TASK_STATUS_DONE) return task;
    task.status = TASK_STATUS_OVERDUE;
    task.timeline.push(
      // Cron chạy: không có phiên đăng nhập nên actorId rỗng = hệ thống
      activity(ACT.overdue, { detail: String(task.deadline), state: 'cur' }),
    );
    await task.save();
    this.emitTaskChanged('status', task);
    return task;
  }

  /** Số ngày còn lại tới hạn (âm = đã quá hạn) */
  daysLeft(task: TaskDocument, from: number = nowMs()): number {
    return daysLeftMs(task.deadline, from);
  }

  /* ─────────────────────────── Nội bộ ─────────────────────────── */

  /**
   * Phát tín hiệu "nhiệm vụ vừa đổi" qua Socket.IO (P5-05).
   *
   * Gói tin cố tình gọn ({type, code, status, at}) — client nhận rồi tự tải lại
   * danh sách/chi tiết theo quyền của mình. RealtimeService nuốt mọi lỗi nên lời
   * gọi này không thể làm hỏng nghiệp vụ đang chạy.
   */
  private emitTaskChanged(type: 'created' | 'status' | 'deleted' | 'restored', task: TaskDocument): void {
    this.realtime.emitChange(
      REALTIME_EVENTS.TASK_CHANGED,
      { type, code: task.code, status: task.status, at: new Date().toISOString() },
      { department: task.departmentId, user: task.assigneeId },
    );
  }

  /*
   * `buildTimelineStep` đã bỏ — thay bằng `activity()` của `@vigov/shared`, để
   * cả bốn phân hệ ghi nhật ký cùng một khuôn thay vì mỗi nơi một hàm riêng.
   */

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
