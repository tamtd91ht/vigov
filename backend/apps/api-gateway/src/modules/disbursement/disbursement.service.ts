import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  BudgetItem,
  IS_DELETED,
  NOT_DELETED,
  softDeleteUpdate,
  softRestoreUpdate,
  type BudgetItemDocument,
  type Comment,
  type DisbursementRequest,
  type JwtPayload,
} from '@vigov/shared';
import {
  CreateBudgetItemDto,
  CreateCommentDto,
  CreateDisbursementRequestDto,
  CreateEntryDto,
  CreateObstacleDto,
  DeleteBudgetItemDto,
  DisburseRequestDto,
  ListBudgetQueryDto,
  ListRequestQueryDto,
  RejectRequestDto,
} from './dto/disbursement.dto';

/** Tiền tố mã hạng mục và số chữ số của phần tăng dần: HM-01, HM-02… */
const CODE_PREFIX = 'HM-';
const CODE_DIGITS = 2;

/**
 * Ngưỡng tiến độ giải ngân: dưới 70% kế hoạch thì đánh dấu chậm.
 * Phase 1 so sánh theo luỹ kế cả năm; nếu khách yêu cầu so theo tiến độ
 * từng quý sẽ bổ sung ở giai đoạn tích hợp.
 */
const PROGRESS_DELAY_THRESHOLD = 0.7;

/** Màu mặc định của avatar bình luận khi chưa lấy được màu cán bộ */
const DEFAULT_COMMENT_COLOR = 'var(--blue)';

/** Màu mặc định gắn với nguồn vốn khi người dùng không chọn */
const DEFAULT_FUNDING_COLOR = 'var(--blue)';

/** Tên hiển thị dùng cho bình luận do hệ thống tự sinh */
const SYSTEM_AUTHOR = 'Hệ thống';

/** Tiền tố mã đề nghị giải ngân trong phạm vi một hạng mục: DN-01, DN-02… */
const REQUEST_PREFIX = 'DN-';
const REQUEST_DIGITS = 2;

/** Hệ số quy đổi đơn vị tiền về "tỷ đồng" — đơn vị lưu trong BudgetItem */
const UNIT_TO_TY: Record<string, number> = {
  ty: 1,
  trieu: 1 / 1_000,
  nghin: 1 / 1_000_000,
  ngan: 1 / 1_000_000,
  dong: 1 / 1_000_000_000,
};

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(
    @InjectModel(BudgetItem.name) private readonly budgetModel: Model<BudgetItemDocument>,
  ) {}

  /**
   * Quy đổi số tiền dạng chuỗi người dùng nhập về số thực (đơn vị: tỷ đồng).
   * Chấp nhận dấu phẩy làm dấu thập phân và dấu chấm làm phân cách nghìn:
   *   "1,25 tỷ" → 1.25 | "800 triệu" → 0.8 | "1.200 triệu" → 1.2 | "0,5" → 0.5
   */
  parseAmountToTyDong(raw: string): number {
    const text = String(raw ?? '').trim().toLowerCase();
    if (!text) throw new BadRequestException('Số tiền không hợp lệ');

    // Bỏ dấu chấm phân cách nghìn rồi đổi dấu phẩy thập phân thành dấu chấm
    const numberPart = text
      .replace(/[^\d.,]/g, '')
      .replace(/\.(?=\d{3}\b)/g, '')
      .replace(',', '.');

    const value = Number.parseFloat(numberPart);
    if (!Number.isFinite(value)) {
      throw new BadRequestException('Số tiền không hợp lệ, ví dụ hợp lệ: "1,25 tỷ"');
    }

    return value * this.unitFactor(text);
  }

  /** Nhận diện đơn vị tiền trong chuỗi để lấy hệ số quy đổi về tỷ đồng */
  private unitFactor(text: string): number {
    if (/(triệu|trieu|tr\b)/.test(text)) return UNIT_TO_TY.trieu;
    if (/(nghìn|nghin|ngàn|ngan|k\b)/.test(text)) return UNIT_TO_TY.nghin;
    if (/(đồng|dong|vnđ|vnd)/.test(text) && !/(tỷ|ty\b)/.test(text)) return UNIT_TO_TY.dong;
    // Mặc định: coi như đơn vị tỷ đồng (khớp đơn vị lưu trong BudgetItem)
    return UNIT_TO_TY.ty;
  }

  /** Danh sách hạng mục theo bộ lọc + số liệu tổng hợp phục vụ dashboard */
  async list(query: ListBudgetQueryDto) {
    const year = query.year ?? new Date().getFullYear();
    /*
     * Hạng mục đã xoá mềm nằm ngoài mọi số liệu tổng hợp: tổng kế hoạch vốn và
     * tỷ lệ giải ngân phải phản ánh đúng phần ngân sách còn hiệu lực. Muốn xem
     * lại thì dùng bộ lọc "Đã xoá" (deleted=true).
     */
    const filter: FilterQuery<BudgetItemDocument> = {
      year,
      ...(query.deleted ? IS_DELETED : NOT_DELETED),
    };
    if (typeof query.delayed === 'boolean') filter.delayed = query.delayed;
    if (query.owner) filter.owner = query.owner;

    const items = await this.budgetModel.find(filter).sort({ code: 1 }).lean().exec();

    const totalPlanned = items.reduce((sum, it) => sum + (it.planned ?? 0), 0);
    const totalActual = items.reduce((sum, it) => sum + (it.actual ?? 0), 0);

    return {
      year,
      items,
      summary: {
        totalPlanned: this.round(totalPlanned),
        totalActual: this.round(totalActual),
        percent: totalPlanned > 0 ? this.round((totalActual / totalPlanned) * 100) : 0,
        delayedCount: items.filter((it) => it.delayed).length,
      },
    };
  }

  /** Chi tiết một hạng mục theo mã HM-xx */
  async detail(code: string) {
    const item = await this.budgetModel.findOne({ code }).lean().exec();
    if (!item) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    return item;
  }

  /** Tạo hạng mục mới; mã HM-xx tự sinh tăng dần */
  async create(dto: CreateBudgetItemDto) {
    const code = await this.nextCode();
    const created = await this.budgetModel.create({
      code,
      name: dto.name,
      fundingSource: dto.fundingSource,
      fundingColor: dto.fundingColor ?? DEFAULT_FUNDING_COLOR,
      owner: dto.owner,
      year: dto.year,
      planned: dto.planned,
      actual: 0,
      // Hạng mục mới chưa giải ngân đồng nào nên mặc định nằm dưới ngưỡng tiến độ
      delayed: this.isDelayed(dto.planned, 0),
      entries: [],
      comments: [],
      obstacles: [],
    });
    return created.toObject();
  }

  /** Ghi nhận một lần giải ngân: cộng dồn luỹ kế và cập nhật cờ chậm tiến độ */
  async addEntry(code: string, dto: CreateEntryDto, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    const amountTy = this.parseAmountToTyDong(dto.amount);

    item.entries.push({
      date: dto.date,
      content: dto.content,
      amount: dto.amount,
      vendor: dto.vendor ?? '',
      voucherNo: dto.voucherNo ?? '',
      by: user?.displayName ?? SYSTEM_AUTHOR,
    });

    item.actual = this.round(item.actual + amountTy);
    item.delayed = this.isDelayed(item.planned, item.actual);
    await item.save();

    return {
      code: item.code,
      actual: item.actual,
      planned: item.planned,
      percent: item.planned > 0 ? this.round((item.actual / item.planned) * 100) : 0,
      delayed: item.delayed,
      entry: item.entries[item.entries.length - 1],
    };
  }

  /** Thêm bình luận trao đổi; tác giả lấy từ phiên đăng nhập */
  async addComment(code: string, dto: CreateCommentDto, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    const comment = this.buildComment(dto.content, user);
    item.comments.push(comment);
    await item.save();
    return { code: item.code, comment };
  }

  /** Thêm vướng mắc cần tháo gỡ cho hạng mục */
  async addObstacle(code: string, dto: CreateObstacleDto) {
    const item = await this.findOrFail(code);
    const obstacle = {
      content: dto.content,
      owner: dto.owner ?? '',
      deadline: dto.deadline ?? '',
    };
    item.obstacles.push(obstacle);
    await item.save();
    return { code: item.code, obstacles: item.obstacles };
  }

  /** Đánh dấu vướng mắc đã tháo gỡ: xoá khỏi danh sách và ghi bình luận hệ thống */
  async resolveObstacle(code: string, index: number, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    if (!Number.isInteger(index) || index < 0 || index >= item.obstacles.length) {
      throw new NotFoundException('Không tìm thấy vướng mắc cần tháo gỡ');
    }

    const [removed] = item.obstacles.splice(index, 1);
    item.comments.push(
      this.buildComment(`Đã tháo gỡ vướng mắc: ${removed.content}`, user, true),
    );
    await item.save();

    return { code: item.code, resolved: removed, obstacles: item.obstacles };
  }

  /**
   * Gửi đề nghị giải ngân đợt tiếp theo — bước đầu của luồng một cấp duyệt.
   *
   * Chặn tổng đề nghị vượt kế hoạch vốn: phần vốn còn lại tính theo cả số đã
   * chi (`actual`) LẪN các đề nghị đang treo (pending + approved). Nếu chỉ trừ
   * `actual` thì gửi ba đề nghị liên tiếp, mỗi cái vừa đúng phần còn lại, sẽ
   * lọt hết và tổng cam kết vượt vốn giao.
   */
  async createRequest(code: string, dto: CreateDisbursementRequestDto, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    const amountTy = this.parseAmountToTyDong(dto.amount);
    if (amountTy <= 0) throw new BadRequestException('Số tiền đề nghị phải lớn hơn 0');

    const remaining = this.remainingBudget(item);
    if (amountTy > remaining + 1e-9) {
      throw new BadRequestException(
        `Số tiền đề nghị vượt phần vốn còn lại (${this.round(remaining)} tỷ đồng, đã trừ các đề nghị đang chờ duyệt)`,
      );
    }

    const request: DisbursementRequest = {
      code: this.nextRequestCode(item),
      amount: dto.amount,
      amountTyDong: this.round(amountTy),
      content: dto.content,
      vendor: dto.vendor ?? '',
      status: 'pending',
      requestedBy: user?.displayName ?? SYSTEM_AUTHOR,
      requestedAt: this.nowLabel(),
      decidedBy: '',
      decidedAt: '',
      rejectReason: '',
      voucherNo: '',
      disbursedAt: '',
    };
    item.requests.push(request);

    const vendorLabel = dto.vendor ? ` — đơn vị thụ hưởng: ${dto.vendor}` : '';
    const comment = this.buildComment(
      `Gửi đề nghị giải ngân ${request.code}: ${dto.amount} cho "${dto.content}"${vendorLabel}`,
      user,
    );
    item.comments.push(comment);
    await item.save();

    this.logger.log(`Đề nghị giải ngân ${code}/${request.code}: ${dto.amount} (~${amountTy} tỷ đồng)`);

    return {
      code: item.code,
      request,
      status: request.status,
      message: 'Đề nghị giải ngân chờ duyệt',
      amount: request.amount,
      amountTyDong: request.amountTyDong,
      content: request.content,
      vendor: request.vendor,
      requestedBy: request.requestedBy,
      remaining: this.round(this.remainingBudget(item)),
      comment,
    };
  }

  /**
   * Danh sách đề nghị giải ngân của TOÀN XÃ, gộp từ mọi hạng mục.
   *
   * Đề nghị lưu lồng trong hạng mục (mỗi hạng mục vài đề nghị, không phải hàng
   * nghìn) nên gộp ở tầng ứng dụng đủ nhanh và giữ được một nguồn sự thật duy
   * nhất. Tách collection riêng chỉ cần khi số đề nghị lớn tới mức phải phân trang.
   */
  async listRequests(query: ListRequestQueryDto) {
    const year = query.year ?? new Date().getFullYear();
    const items = await this.budgetModel
      .find({ year, ...NOT_DELETED })
      .sort({ code: 1 })
      .lean()
      .exec();

    const rows = items.flatMap((item) =>
      ((item.requests ?? []) as DisbursementRequest[])
        .filter((r) => !query.status || r.status === query.status)
        .map((r) => ({
          ...r,
          budgetCode: item.code,
          budgetName: item.name,
          fundingSource: item.fundingSource,
          owner: item.owner,
        })),
    );

    /* Mới gửi lên đầu: người duyệt quan tâm đề nghị vừa tới, không phải cái cũ nhất */
    rows.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

    const all = items.flatMap((it) => (it.requests ?? []) as DisbursementRequest[]);
    return {
      year,
      items: rows,
      summary: {
        pending: all.filter((r) => r.status === 'pending').length,
        approved: all.filter((r) => r.status === 'approved').length,
        rejected: all.filter((r) => r.status === 'rejected').length,
        disbursed: all.filter((r) => r.status === 'disbursed').length,
        /** Tổng tiền đang chờ duyệt (tỷ đồng) — phần ngân sách đã cam kết nhưng chưa quyết */
        pendingAmount: this.round(
          all.filter((r) => r.status === 'pending').reduce((s, r) => s + (r.amountTyDong ?? 0), 0),
        ),
      },
    };
  }

  /** Duyệt đề nghị: chuyển pending → approved. Chưa cộng tiền vào luỹ kế. */
  async approveRequest(code: string, requestCode: string, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    const request = this.findRequestOrFail(item, requestCode);
    this.assertStatus(request, 'pending', 'duyệt');

    request.status = 'approved';
    request.decidedBy = user?.displayName ?? SYSTEM_AUTHOR;
    request.decidedAt = this.nowLabel();

    item.comments.push(
      this.buildComment(
        `Đã duyệt đề nghị giải ngân ${request.code}: ${request.amount} cho "${request.content}"`,
        user,
      ),
    );
    await item.save();

    return { code: item.code, request };
  }

  /** Từ chối đề nghị: chuyển pending → rejected, bắt buộc kèm lý do */
  async rejectRequest(
    code: string,
    requestCode: string,
    dto: RejectRequestDto,
    user?: JwtPayload,
  ) {
    const item = await this.findOrFail(code);
    const request = this.findRequestOrFail(item, requestCode);
    this.assertStatus(request, 'pending', 'từ chối');

    request.status = 'rejected';
    request.rejectReason = dto.reason;
    request.decidedBy = user?.displayName ?? SYSTEM_AUTHOR;
    request.decidedAt = this.nowLabel();

    item.comments.push(
      this.buildComment(
        `Đã từ chối đề nghị giải ngân ${request.code}. Lý do: ${dto.reason}`,
        user,
      ),
    );
    await item.save();

    return { code: item.code, request };
  }

  /**
   * Ghi nhận đề nghị đã chi thật: approved → disbursed.
   *
   * ĐÂY là chỗ duy nhất tiền của một đề nghị được cộng vào luỹ kế `actual`, và
   * cùng lúc sinh một dòng trong Lịch sử giải ngân — nhờ vậy mỗi khoản chi
   * trong sổ đều truy ngược được về đề nghị đã duyệt sinh ra nó.
   */
  async disburseRequest(
    code: string,
    requestCode: string,
    dto: DisburseRequestDto,
    user?: JwtPayload,
  ) {
    const item = await this.findOrFail(code);
    const request = this.findRequestOrFail(item, requestCode);
    this.assertStatus(request, 'approved', 'ghi nhận đã chi');

    const date = dto.date?.trim() || this.todayLabel();
    request.status = 'disbursed';
    request.voucherNo = dto.voucherNo;
    request.disbursedAt = date;

    item.entries.push({
      date,
      content: request.content,
      amount: request.amount,
      vendor: request.vendor,
      voucherNo: dto.voucherNo,
      by: user?.displayName ?? SYSTEM_AUTHOR,
    });

    item.actual = this.round(item.actual + request.amountTyDong);
    item.delayed = this.isDelayed(item.planned, item.actual);

    item.comments.push(
      this.buildComment(
        `Đã giải ngân đề nghị ${request.code}: ${request.amount}, chứng từ ${dto.voucherNo}`,
        user,
      ),
    );
    await item.save();

    return {
      code: item.code,
      request,
      planned: item.planned,
      actual: item.actual,
      percent: item.planned > 0 ? this.round((item.actual / item.planned) * 100) : 0,
      delayed: item.delayed,
      entry: item.entries[item.entries.length - 1],
    };
  }

  /**
   * Xoá mềm hạng mục: bật cờ `isDeleted` chứ KHÔNG xoá tài liệu.
   *
   * Hạng mục đã phát sinh lần chi là số liệu quyết toán ngân sách — xoá cứng
   * là mất dấu tiền đã giải ngân. Bản ghi biến mất khỏi danh sách và khỏi mọi
   * số liệu tổng hợp, nhưng khôi phục lại được từ bộ lọc "Đã xoá".
   *
   * `deletedBy` lưu TÊN ĐĂNG NHẬP (không phải displayName) để khớp nhật ký
   * kiểm toán — quy ước dùng chung cả 4 phân hệ, xem `SoftDeletable`.
   */
  async softDelete(code: string, dto: DeleteBudgetItemDto, user?: JwtPayload) {
    const actor = user?.username ?? SYSTEM_AUTHOR;
    const updated = await this.budgetModel
      .findOneAndUpdate({ code, ...NOT_DELETED }, softDeleteUpdate(actor, dto.reason), { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    this.logger.log(`Xoá mềm hạng mục ${code} bởi ${actor}`);
    return updated;
  }

  /** Khôi phục hạng mục đã xoá mềm về lại danh sách đang dùng */
  async restore(code: string) {
    const updated = await this.budgetModel
      .findOneAndUpdate({ code, ...IS_DELETED }, softRestoreUpdate(), { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Không tìm thấy hạng mục đã xoá ${code}`);
    return updated;
  }

  /**
   * Lấy document (không lean) để cập nhật, báo lỗi rõ ràng nếu không có.
   * Loại luôn hạng mục đã xoá mềm: không cho ghi thêm vào bản ghi đã bỏ.
   */
  private async findOrFail(code: string): Promise<BudgetItemDocument> {
    const item = await this.budgetModel.findOne({ code, ...NOT_DELETED }).exec();
    if (!item) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    return item;
  }

  /** Tìm đề nghị theo mã DN-xx trong hạng mục */
  private findRequestOrFail(item: BudgetItemDocument, requestCode: string): DisbursementRequest {
    const request = item.requests.find((r) => r.code === requestCode);
    if (!request) {
      throw new NotFoundException(`Không tìm thấy đề nghị ${requestCode} trong hạng mục ${item.code}`);
    }
    return request;
  }

  /**
   * Chặn chuyển trạng thái sai luồng — ví dụ duyệt một đề nghị đã bị từ chối,
   * hoặc ghi nhận chi hai lần cho cùng một đề nghị (sẽ cộng tiền hai lượt).
   */
  private assertStatus(
    request: DisbursementRequest,
    expected: DisbursementRequest['status'],
    action: string,
  ): void {
    if (request.status !== expected) {
      throw new BadRequestException(
        `Đề nghị ${request.code} đang ở trạng thái "${this.statusLabel(request.status)}" nên không ${action} được`,
      );
    }
  }

  /** Nhãn tiếng Việt của trạng thái đề nghị, dùng trong thông báo lỗi */
  private statusLabel(status: DisbursementRequest['status']): string {
    const labels: Record<DisbursementRequest['status'], string> = {
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
      disbursed: 'Đã giải ngân',
    };
    return labels[status] ?? status;
  }

  /**
   * Phần vốn còn có thể đề nghị: kế hoạch trừ đi số đã chi và các đề nghị đang
   * treo (chờ duyệt + đã duyệt chưa chi). Đề nghị đã chi nằm trong `actual` rồi
   * nên không trừ lần nữa; đề nghị bị từ chối không chiếm vốn.
   */
  private remainingBudget(item: BudgetItemDocument): number {
    const committed = item.requests
      .filter((r) => r.status === 'pending' || r.status === 'approved')
      .reduce((sum, r) => sum + (r.amountTyDong ?? 0), 0);
    return Math.max(0, item.planned - item.actual - committed);
  }

  /** Sinh mã đề nghị kế tiếp trong phạm vi hạng mục: DN-01, DN-02… */
  private nextRequestCode(item: BudgetItemDocument): string {
    const numbers = item.requests
      .map((r) => Number.parseInt(r.code.slice(REQUEST_PREFIX.length), 10))
      .filter((n) => Number.isFinite(n));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${REQUEST_PREFIX}${String(next).padStart(REQUEST_DIGITS, '0')}`;
  }

  /** Sinh mã hạng mục kế tiếp theo số thứ tự lớn nhất đang có */
  private async nextCode(): Promise<string> {
    const last = await this.budgetModel
      .findOne({ code: new RegExp(`^${CODE_PREFIX}\\d+$`) })
      .sort({ code: -1 })
      .select('code')
      .lean<{ code: string } | null>()
      .exec();

    const nextNumber = last ? Number.parseInt(last.code.slice(CODE_PREFIX.length), 10) + 1 : 1;
    return `${CODE_PREFIX}${String(nextNumber).padStart(CODE_DIGITS, '0')}`;
  }

  /** Hạng mục chậm khi tỷ lệ giải ngân/kế hoạch dưới ngưỡng cấu hình */
  private isDelayed(planned: number, actual: number): boolean {
    if (planned <= 0) return false;
    return actual / planned < PROGRESS_DELAY_THRESHOLD;
  }

  /** Dựng bình luận theo đúng cấu trúc Comment dùng chung với nhiệm vụ */
  private buildComment(content: string, user?: JwtPayload, system = false): Comment {
    const authorName = system ? SYSTEM_AUTHOR : user?.displayName ?? SYSTEM_AUTHOR;
    return {
      authorName,
      authorInitials: this.initials(authorName),
      authorColor: DEFAULT_COMMENT_COLOR,
      time: this.nowLabel(),
      content,
    };
  }

  /** Viết tắt tên hiển thị: "Nguyễn Văn A" → "NA" */
  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'HT';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Nhãn thời gian hiển thị: "14:05 27/08/2026" */
  private nowLabel(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** Ngày hôm nay dạng "27/08/2026" — khớp định dạng ngày của lần giải ngân */
  private todayLabel(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** Làm tròn 2 chữ số thập phân cho số liệu tiền tỷ */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
