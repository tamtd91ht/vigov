import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BudgetItem,
  type BudgetItemDocument,
  type Comment,
  type JwtPayload,
} from '@vigov/shared';
import {
  CreateBudgetItemDto,
  CreateCommentDto,
  CreateDisbursementRequestDto,
  CreateEntryDto,
  CreateObstacleDto,
  ListBudgetQueryDto,
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
    const filter: Record<string, unknown> = { year };
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
   * Đề nghị giải ngân.
   * Phase 1 chỉ ghi nhận đề nghị dưới dạng bình luận chờ lãnh đạo xem xét —
   * luồng duyệt nhiều cấp (ai duyệt, mấy bước, có ký số không) chờ khách chốt
   * (câu hỏi mở #8), khi đó sẽ tách thành collection riêng + trạng thái duyệt.
   */
  async createRequest(code: string, dto: CreateDisbursementRequestDto, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    const amountTy = this.parseAmountToTyDong(dto.amount);
    const vendorLabel = dto.vendor ? ` — đơn vị thụ hưởng: ${dto.vendor}` : '';

    const comment = this.buildComment(
      `Đề nghị giải ngân chờ duyệt: ${dto.amount} cho "${dto.content}"${vendorLabel}`,
      user,
    );
    item.comments.push(comment);
    await item.save();

    this.logger.log(`Đề nghị giải ngân ${code}: ${dto.amount} (~${amountTy} tỷ đồng)`);

    return {
      code: item.code,
      status: 'pending',
      message: 'Đề nghị giải ngân chờ duyệt',
      amount: dto.amount,
      amountTyDong: this.round(amountTy),
      content: dto.content,
      vendor: dto.vendor ?? '',
      requestedBy: user?.displayName ?? SYSTEM_AUTHOR,
      comment,
    };
  }

  /** Lấy document (không lean) để cập nhật, báo lỗi rõ ràng nếu không có */
  private async findOrFail(code: string): Promise<BudgetItemDocument> {
    const item = await this.budgetModel.findOne({ code }).exec();
    if (!item) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    return item;
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

  /** Làm tròn 2 chữ số thập phân cho số liệu tiền tỷ */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
