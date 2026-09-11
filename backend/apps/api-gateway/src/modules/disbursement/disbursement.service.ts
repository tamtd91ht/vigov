import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type FilterQuery } from 'mongoose';
import {
  BUDGET_APPROVAL_LABELS,
  BudgetItem,
  DISBURSEMENT_ENTRY_TYPE_LABELS,
  DISBURSEMENT_STATE_LABELS,
  IS_DELETED,
  NOT_DELETED,
  SCHEDULE_STATE_LABELS,
  formatVnd,
  isValidVnd,
  comment,
  softDeleteUpdate,
  softRestoreUpdate,
  percentOf,
  sumVnd,
  type BudgetApprovalStatus,
  type BudgetItemDocument,
  type Comment,
  type DisbursementRequest,
  type DisbursementRequestStatus,
  type JwtPayload,
} from '@vigov/shared';
import type {
  AddBudgetDocumentDto,
  ChangeBudgetStatusDto,
  CreateAdjustmentDto,
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
  UpdateBudgetItemDto,
} from './dto/disbursement.dto';
import { actualFromEntries, computeProgress, type ProgressResult } from './progress';

/** Mã hạng mục: HM-01, HM-02… */
const CODE_PREFIX = 'HM-';
const CODE_DIGITS = 2;

/** Tiền tố mã đề nghị giải ngân trong phạm vi một hạng mục: DN-01, DN-02… */
const REQUEST_PREFIX = 'DN-';
const REQUEST_DIGITS = 2;

/** Tên hiển thị dùng cho bình luận và nhật ký do hệ thống tự sinh */
const SYSTEM_AUTHOR = 'Hệ thống';

/** Màu mặc định của avatar bình luận khi chưa lấy được màu cán bộ */
const DEFAULT_COMMENT_COLOR = 'var(--blue)';

/** Màu mặc định gắn với nguồn vốn khi người dùng không chọn */
const DEFAULT_FUNDING_COLOR = 'var(--blue)';

/**
 * Chuyển trạng thái hồ sơ được phép, và mức quyền tối thiểu để làm.
 *
 * Khung RBAC Phase 1 là theo PHÂN HỆ (view/edit/approve/admin), không theo từng
 * hành động — nên ở đây map bảy hành động nghiệp vụ vào ba mức có sẵn thay vì
 * mở một khung quyền mới (mở khung ảnh hưởng cả 11 phân hệ).
 * → `rules/critical/phan-quyen-rbac.md`
 */
const STATUS_TRANSITIONS: Record<
  BudgetApprovalStatus,
  { to: BudgetApprovalStatus; level: 'edit' | 'approve' | 'admin' }[]
> = {
  nhap: [
    { to: 'cho-duyet', level: 'edit' },
    { to: 'huy', level: 'admin' },
  ],
  'cho-duyet': [
    { to: 'da-duyet', level: 'approve' },
    { to: 'tu-choi', level: 'approve' },
    { to: 'huy', level: 'admin' },
  ],
  'tu-choi': [
    { to: 'nhap', level: 'edit' },
    { to: 'huy', level: 'admin' },
  ],
  'da-duyet': [
    { to: 'tam-dung', level: 'approve' },
    { to: 'quyet-toan', level: 'approve' },
    { to: 'huy', level: 'admin' },
  ],
  'tam-dung': [
    { to: 'da-duyet', level: 'approve' },
    { to: 'huy', level: 'admin' },
  ],
  huy: [],
  'quyet-toan': [],
};

/** Trạng thái mà hồ sơ đã CHỐT — mọi đường ghi đều bị khoá */
const CLOSED_STATUSES: BudgetApprovalStatus[] = ['huy', 'quyet-toan'];

/** Lý do bắt buộc khi chuyển sang các trạng thái này */
const STATUS_NEEDS_REASON: BudgetApprovalStatus[] = ['tu-choi', 'tam-dung', 'huy'];

/** Bản ghi hạng mục đọc từ Mongo (lean hoặc toObject) */
type LeanBudgetItem = BudgetItem & {
  _id?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Bản ghi trả ra API = dữ liệu lưu + phần tính toán + nhãn tiếng Việt.
 *
 * Khai tường minh thay vì suy từ kiểu trả về: nơi gọi cần đọc được `code`,
 * `scheduleState`, `percent`… mà không phải ép kiểu, và bộ lọc ở `list()` dựa
 * hẳn vào các trường này.
 */
export interface BudgetItemView extends LeanBudgetItem, ProgressResult {
  approvalLabel: string;
  disbursementLabel: string;
  scheduleLabel: string;
}

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(
    @InjectModel(BudgetItem.name) private readonly budgetModel: Model<BudgetItemDocument>,
    private readonly config: ConfigService,
  ) {}

  /* ─────────────────────────── Tính toán dùng chung ─────────────────────────── */

  /** Ngưỡng cảnh báo tiến độ, đọc từ cấu hình — không viết cứng */
  private get thresholds() {
    return {
      riskRatio: this.config.get<number>('disbursement.riskRatio') ?? 0.8,
      dueSoonDays: this.config.get<number>('disbursement.dueSoonDays') ?? 30,
    };
  }

  /**
   * Tính lại hai con số tổng hợp từ lịch sử, rồi lưu vào bản ghi.
   *
   * PHẢI gọi ở MỌI đường ghi. Nhờ vậy `plannedDong` và `actualDong` không bao
   * giờ lệch khỏi `adjustments` và `entries` — hai mảng đó là nguồn sự thật, hai
   * con số kia chỉ là bản tính sẵn để truy vấn và sắp xếp.
   */
  private recompute(item: BudgetItemDocument): void {
    const adjustments = sumVnd((item.adjustments ?? []).map((a) => a.deltaDong));
    item.plannedDong = Math.trunc(item.initialPlannedDong ?? 0) + adjustments;
    item.actualDong = actualFromEntries(item.entries ?? []);
  }

  /** Tiến độ của một hạng mục tại thời điểm hiện tại */
  private progressOf(item: {
    plannedDong?: number;
    actualDong?: number;
    quarterPlans?: { quarter: number; amountDong: number }[];
    startDate?: string;
    endDate?: string;
    year: number;
  }): ProgressResult {
    return computeProgress({
      plannedDong: Math.trunc(item.plannedDong ?? 0),
      actualDong: Math.trunc(item.actualDong ?? 0),
      quarterPlans: item.quarterPlans ?? [],
      startDate: item.startDate ?? '',
      endDate: item.endDate ?? '',
      year: item.year,
      asOf: new Date(),
      thresholds: this.thresholds,
    });
  }

  /**
   * Bổ sung phần tính toán vào bản ghi trả ra API.
   *
   * Giao diện KHÔNG tự tính lại tỷ lệ, còn lại, hay tình trạng tiến độ: tính ở
   * hai nơi là sớm muộn lệch nhau, và con số trên màn hình khác con số trong
   * tệp xuất thì không ai tin số liệu nữa.
   */
  private withProgress(item: LeanBudgetItem): BudgetItemView {
    const progress = this.progressOf(item);
    return {
      ...item,
      ...progress,
      approvalLabel: BUDGET_APPROVAL_LABELS[item.approvalStatus] ?? '',
      disbursementLabel: DISBURSEMENT_STATE_LABELS[progress.disbursementState],
      scheduleLabel: SCHEDULE_STATE_LABELS[progress.scheduleState],
    };
  }

  /* ─────────────────────────────── Đọc dữ liệu ─────────────────────────────── */

  /**
   * Danh sách hạng mục theo bộ lọc + số liệu tổng hợp phục vụ dashboard.
   *
   * Hạng mục đã xoá mềm nằm ngoài mọi số liệu tổng hợp: tổng kế hoạch vốn và tỷ
   * lệ giải ngân phải phản ánh đúng phần ngân sách còn hiệu lực.
   *
   * Bộ lọc theo TÌNH TRẠNG TIẾN ĐỘ và THEO TỶ LỆ áp ở tầng ứng dụng, không ở
   * Mongo: hai thứ đó được tính lại mỗi lần đọc chứ không lưu trong CSDL (xem
   * chú thích đầu `budget.schema.ts`). Một xã có vài chục hạng mục mỗi năm nên
   * lọc sau khi lấy là đủ nhanh, và không bao giờ lọc theo một cờ đã cũ.
   */
  async list(query: ListBudgetQueryDto) {
    const year = query.year ?? new Date().getFullYear();
    const filter: FilterQuery<BudgetItemDocument> = {
      year,
      ...(query.deleted ? IS_DELETED : NOT_DELETED),
    };
    if (query.owner) filter.owner = query.owner;
    if (query.expenseType) filter.expenseType = query.expenseType;
    if (query.program) filter.program = query.program;
    if (query.fundingSource) filter.fundingSource = query.fundingSource;
    if (query.approvalStatus?.length) filter.approvalStatus = { $in: query.approvalStatus };

    const raw = await this.budgetModel.find(filter).sort({ code: 1 }).lean().exec();
    const all = raw.map((item) => this.withProgress(item as LeanBudgetItem));

    const filtered = all.filter((item) => {
      if (query.scheduleState?.length && !query.scheduleState.includes(item.scheduleState)) {
        return false;
      }
      if (
        query.disbursementState?.length &&
        !query.disbursementState.includes(item.disbursementState)
      ) {
        return false;
      }
      const percent = item.percent ?? 0;
      if (query.minPercent !== undefined && percent < query.minPercent) return false;
      if (query.maxPercent !== undefined && percent > query.maxPercent) return false;
      if (query.dueSoon && !(item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= this.thresholds.dueSoonDays)) {
        return false;
      }
      const keyword = query.q?.trim().toLowerCase();
      if (keyword) {
        const haystack = [item.code, item.name, item.purpose, item.program, item.beneficiary]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });

    return { year, items: filtered, summary: this.summarize(filtered) };
  }

  /** Số liệu tổng hợp của một tập hạng mục — mọi con số cộng từ số nguyên đồng */
  private summarize(items: BudgetItemView[]) {
    const totalPlanned = sumVnd(items.map((it) => it.plannedDong));
    const totalActual = sumVnd(items.map((it) => it.actualDong));
    const countBy = (state: string) =>
      items.filter((it) => it.scheduleState === state).length;

    return {
      totalItems: items.length,
      totalPlannedDong: totalPlanned,
      totalActualDong: totalActual,
      totalRemainingDong: totalPlanned - totalActual,
      percent: percentOf(totalActual, totalPlanned),
      schedule: {
        onTrack: countBy('dung-tien-do'),
        atRisk: countBy('nguy-co-cham'),
        late: countBy('cham'),
        done: countBy('hoan-thanh'),
        notStarted: countBy('chua-den-han'),
      },
      /** Số tiền đã cam kết qua đề nghị nhưng chưa chi — phần ngân sách đã hứa */
      committedDong: sumVnd(
        items.flatMap((it) =>
          ((it.requests ?? []) as DisbursementRequest[])
            .filter((r) => r.status === 'pending' || r.status === 'approved')
            .map((r) => r.amountDong ?? 0),
        ),
      ),
    };
  }

  /**
   * Toàn bộ hạng mục khớp bộ lọc, để xuất Excel.
   *
   * Dùng LẠI `list()` nên tệp xuất và bảng trên màn hình luôn cùng một bộ lọc và
   * cùng một cách tính. Một xã có vài chục hạng mục mỗi năm nên không cần chặn
   * ngưỡng số dòng như các phân hệ có hàng nghìn bản ghi.
   */
  async listForExport(query: ListBudgetQueryDto) {
    const { items } = await this.list(query);
    return items;
  }

  /** Chi tiết một hạng mục theo mã HM-xx, kèm phần tính toán */
  async detail(code: string) {
    const item = await this.budgetModel.findOne({ code }).lean().exec();
    if (!item) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    return this.withProgress(item as LeanBudgetItem);
  }

  /**
   * Số liệu cho bảng điều khiển: tổng quan, tiến độ, kế hoạch–thực tế theo quý,
   * và danh sách cảnh báo cần xử trước.
   */
  async dashboard(year?: number) {
    const budgetYear = year ?? new Date().getFullYear();
    const raw = await this.budgetModel.find({ year: budgetYear, ...NOT_DELETED }).lean().exec();
    const items = raw.map((item) => this.withProgress(item as LeanBudgetItem));

    /* Kế hoạch theo quý lấy từ `quarterPlans`; thực tế theo quý suy từ NGÀY trên
       chứng từ, không phải ngày nhập máy — chứng từ tháng 3 nhập vào tháng 4 vẫn
       phải nằm ở quý I, nếu không báo cáo quý sai. */
    const byQuarter = [1, 2, 3, 4].map((quarter) => ({
      quarter,
      plannedDong: sumVnd(
        items.map(
          (it) =>
            ((it.quarterPlans ?? []) as { quarter: number; amountDong: number }[]).find(
              (q) => q.quarter === quarter,
            )?.amountDong ?? 0,
        ),
      ),
      actualDong: sumVnd(
        items.flatMap((it) =>
          ((it.entries ?? []) as { date: string; type: string; amountDong: number }[])
            .filter((e) => this.quarterOfVnDate(e.date) === quarter)
            .map((e) => (e.type === 'hoan-tra' ? -e.amountDong : e.amountDong)),
        ),
      ),
    }));

    const warn = (predicate: (it: (typeof items)[number]) => boolean) =>
      items.filter(predicate).map((it) => ({
        code: it.code,
        name: it.name,
        owner: it.owner,
        plannedDong: it.plannedDong,
        actualDong: it.actualDong,
        percent: it.percent,
        daysLeft: it.daysLeft,
        scheduleState: it.scheduleState,
        scheduleLabel: it.scheduleLabel,
      }));

    return {
      year: budgetYear,
      summary: this.summarize(items),
      byQuarter,
      warnings: {
        overdue: warn((it) => it.daysLeft !== null && it.daysLeft < 0 && it.disbursementState !== 'du'),
        dueSoon: warn(
          (it) =>
            it.daysLeft !== null &&
            it.daysLeft >= 0 &&
            it.daysLeft <= this.thresholds.dueSoonDays &&
            it.disbursementState !== 'du',
        ),
        late: warn((it) => it.scheduleState === 'cham'),
        atRisk: warn((it) => it.scheduleState === 'nguy-co-cham'),
        /* Hạng mục đã phê duyệt mà chưa có hồ sơ nào — không chặn được ở tầng
           dữ liệu vì không phải khoản chi nào cũng cần quyết định riêng, nên chỉ
           nhắc để cán bộ tự rà. */
        missingDocuments: warn(
          (it) =>
            it.approvalStatus !== 'nhap' &&
            ((it.documents ?? []) as unknown[]).length === 0,
        ),
      },
    };
  }

  /** Quý của một ngày dd/MM/yyyy; 0 nếu không đọc được ngày */
  private quarterOfVnDate(value: string): number {
    const matched = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((value ?? '').trim());
    if (!matched) return 0;
    const month = Number(matched[2]);
    if (month < 1 || month > 12) return 0;
    return Math.floor((month - 1) / 3) + 1;
  }

  /* ───────────────────────────── Ghi dữ liệu ───────────────────────────── */

  /** Tạo hạng mục mới; mã HM-xx tự sinh tăng dần. Hạng mục mới luôn ở trạng thái Nháp */
  async create(dto: CreateBudgetItemDto, user?: JwtPayload) {
    this.assertVnd(dto.initialPlannedDong, 'Dự toán giao đầu năm');
    this.assertPlanPeriod(dto.startDate, dto.endDate);
    this.assertQuarterPlans(dto.quarterPlans, dto.initialPlannedDong);

    const code = await this.nextCode();
    const created = await this.budgetModel.create({
      code,
      name: dto.name,
      purpose: dto.purpose ?? '',
      expenseType: dto.expenseType ?? '',
      budgetLevel: dto.budgetLevel ?? '',
      fundingSource: dto.fundingSource,
      fundingColor: dto.fundingColor ?? DEFAULT_FUNDING_COLOR,
      program: dto.program ?? '',
      budgetLine: dto.budgetLine ?? {},
      owner: dto.owner,
      beneficiary: dto.beneficiary ?? '',
      beneficiaryType: dto.beneficiaryType ?? 'khong-xac-dinh',
      beneficiaryTaxCode: dto.beneficiaryTaxCode ?? '',
      year: dto.year,
      carryOverFromYear: dto.carryOverFromYear ?? 0,
      startDate: dto.startDate ?? '',
      endDate: dto.endDate ?? '',
      initialPlannedDong: Math.trunc(dto.initialPlannedDong),
      plannedDong: Math.trunc(dto.initialPlannedDong),
      actualDong: 0,
      quarterPlans: dto.quarterPlans ?? [],
      approvalStatus: 'nhap',
      progressLogs: [
        this.buildLog('Lập hạng mục', user, {
          toStatus: 'nhap',
          plannedDong: Math.trunc(dto.initialPlannedDong),
          actualDong: 0,
          note: `Dự toán giao đầu năm ${formatVnd(dto.initialPlannedDong)}`,
        }),
      ],
    });

    this.logger.log(
      `Lập hạng mục ${code} "${dto.name}", dự toán ${formatVnd(dto.initialPlannedDong)}`,
    );
    return this.withProgress(created.toObject() as LeanBudgetItem);
  }

  /**
   * Sửa thông tin hạng mục.
   *
   * KHÔNG sửa được `initialPlannedDong` qua đường này — đổi dự toán phải đi qua
   * `addAdjustment` để có số quyết định làm căn cứ. Cũng không sửa được hạng mục
   * đã huỷ hoặc đã quyết toán.
   */
  async update(code: string, dto: UpdateBudgetItemDto, user?: JwtPayload) {
    const item = await this.findWritable(code, 'sửa');

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      this.assertPlanPeriod(dto.startDate ?? item.startDate, dto.endDate ?? item.endDate);
    }
    if (dto.quarterPlans !== undefined) {
      this.assertQuarterPlans(dto.quarterPlans, item.plannedDong);
      item.quarterPlans = dto.quarterPlans;
    }

    /* Gán từng trường tuỳ chọn: chỉ ghi khi client thực sự gửi trường đó.
       `undefined` nghĩa là "không sửa", khác hẳn chuỗi rỗng nghĩa là "xoá nội dung". */
    const fields = item as unknown as Record<string, unknown>;
    const assign = (key: string, value: unknown) => {
      if (value !== undefined) fields[key] = value;
    };
    assign('name', dto.name);
    assign('purpose', dto.purpose);
    assign('expenseType', dto.expenseType);
    assign('budgetLevel', dto.budgetLevel);
    assign('fundingSource', dto.fundingSource);
    assign('fundingColor', dto.fundingColor);
    assign('program', dto.program);
    assign('owner', dto.owner);
    assign('beneficiary', dto.beneficiary);
    assign('beneficiaryType', dto.beneficiaryType);
    assign('beneficiaryTaxCode', dto.beneficiaryTaxCode);
    assign('startDate', dto.startDate);
    assign('endDate', dto.endDate);
    assign('carryOverFromYear', dto.carryOverFromYear);
    if (dto.budgetLine !== undefined) item.budgetLine = { ...item.budgetLine, ...dto.budgetLine };

    this.recompute(item);
    item.progressLogs.push(
      this.buildLog('Sửa thông tin hạng mục', user, {
        plannedDong: item.plannedDong,
        actualDong: item.actualDong,
        note: dto.note ?? '',
      }),
    );
    await item.save();
    return this.withProgress(item.toObject() as LeanBudgetItem);
  }

  /**
   * Điều chỉnh dự toán — đường DUY NHẤT để đổi kế hoạch vốn.
   *
   * Bắt buộc có số quyết định và lý do: điều chỉnh dự toán ngoài đời luôn dựa
   * trên một quyết định hành chính. Không có căn cứ thì cuối năm không giải
   * trình được vì sao kế hoạch vốn khác quyết định giao đầu năm.
   */
  async addAdjustment(code: string, dto: CreateAdjustmentDto, user?: JwtPayload) {
    const item = await this.findWritable(code, 'điều chỉnh dự toán');

    if (!Number.isSafeInteger(dto.deltaDong) || dto.deltaDong === 0) {
      throw new BadRequestException('Mức điều chỉnh phải là số nguyên khác 0 (đơn vị: đồng)');
    }

    const nextPlanned = item.plannedDong + Math.trunc(dto.deltaDong);
    if (nextPlanned < 0) {
      throw new BadRequestException(
        `Điều chỉnh làm kế hoạch vốn thành số âm (${formatVnd(nextPlanned)}). Vui lòng kiểm tra lại mức điều chỉnh.`,
      );
    }
    if (nextPlanned < item.actualDong) {
      throw new BadRequestException(
        `Kế hoạch vốn sau điều chỉnh (${formatVnd(nextPlanned)}) thấp hơn số đã giải ngân ` +
          `(${formatVnd(item.actualDong)}). Muốn giảm dự toán tới mức này thì phải thu hồi phần đã chi trước.`,
      );
    }

    item.adjustments.push({
      decisionNo: dto.decisionNo.trim(),
      decidedAt: dto.decidedAt.trim(),
      deltaDong: Math.trunc(dto.deltaDong),
      reason: dto.reason.trim(),
      fileIds: dto.fileIds ?? [],
      by: user?.displayName ?? SYSTEM_AUTHOR,
      recordedAt: new Date(),
    });

    this.recompute(item);
    const huong = dto.deltaDong > 0 ? 'Tăng' : 'Giảm';
    item.progressLogs.push(
      this.buildLog('Điều chỉnh dự toán', user, {
        plannedDong: item.plannedDong,
        actualDong: item.actualDong,
        note:
          `${huong} ${formatVnd(Math.abs(dto.deltaDong))} theo Quyết định ${dto.decisionNo} ` +
          `ngày ${dto.decidedAt}. Lý do: ${dto.reason}`,
      }),
    );
    item.comments.push(
      this.buildComment(
        `Điều chỉnh dự toán: ${huong.toLowerCase()} ${formatVnd(Math.abs(dto.deltaDong))} ` +
          `theo Quyết định ${dto.decisionNo}. Kế hoạch vốn hiện hành: ${formatVnd(item.plannedDong)}`,
        user,
      ),
    );
    await item.save();
    return this.withProgress(item.toObject() as LeanBudgetItem);
  }

  /**
   * Đổi trạng thái hồ sơ theo workflow.
   *
   * Chỉ cho những bước chuyển khai trong `STATUS_TRANSITIONS`; mức quyền do
   * controller kiểm trước khi gọi vào đây (`requiredLevelFor`).
   */
  async changeStatus(code: string, dto: ChangeBudgetStatusDto, user?: JwtPayload) {
    const item = await this.findOrFail(code);
    const from = item.approvalStatus;
    const to = dto.status;

    const allowed = STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.some((t) => t.to === to)) {
      const options = allowed.map((t) => BUDGET_APPROVAL_LABELS[t.to]).join(', ') || 'không còn bước nào';
      throw new BadRequestException(
        `Hạng mục đang ở trạng thái "${BUDGET_APPROVAL_LABELS[from]}" nên không chuyển được sang ` +
          `"${BUDGET_APPROVAL_LABELS[to]}". Bước chuyển hợp lệ: ${options}.`,
      );
    }
    if (STATUS_NEEDS_REASON.includes(to) && !dto.note?.trim()) {
      throw new BadRequestException(
        `Chuyển sang "${BUDGET_APPROVAL_LABELS[to]}" phải nêu lý do để người sau truy được vì sao.`,
      );
    }
    if (to === 'quyet-toan') {
      const pending = (item.requests ?? []).filter(
        (r) => r.status === 'pending' || r.status === 'approved',
      );
      if (pending.length > 0) {
        throw new BadRequestException(
          `Còn ${pending.length} đề nghị giải ngân chưa ghi nhận đã chi. Phải xử lý hết trước khi quyết toán.`,
        );
      }
    }

    item.approvalStatus = to;
    item.statusNote = dto.note?.trim() ?? '';
    this.recompute(item);
    item.progressLogs.push(
      this.buildLog(`Chuyển trạng thái sang ${BUDGET_APPROVAL_LABELS[to]}`, user, {
        fromStatus: from,
        toStatus: to,
        plannedDong: item.plannedDong,
        actualDong: item.actualDong,
        note: dto.note?.trim() ?? '',
        lateReason: dto.lateReason?.trim() ?? '',
      }),
    );
    item.comments.push(
      this.buildComment(
        `${BUDGET_APPROVAL_LABELS[from]} → ${BUDGET_APPROVAL_LABELS[to]}` +
          (dto.note?.trim() ? `. ${dto.note.trim()}` : ''),
        user,
      ),
    );
    await item.save();

    this.logger.log(`Hạng mục ${code}: ${from} → ${to} bởi ${user?.username ?? 'không rõ'}`);
    return this.withProgress(item.toObject() as LeanBudgetItem);
  }

  /** Mức quyền tối thiểu để chuyển sang một trạng thái; null nếu bước không hợp lệ */
  requiredLevelFor(from: BudgetApprovalStatus, to: BudgetApprovalStatus) {
    return (STATUS_TRANSITIONS[from] ?? []).find((t) => t.to === to)?.level ?? null;
  }

  /**
   * Ghi nhận trực tiếp một giao dịch chi trả hoặc hoàn trả.
   *
   * Đường chính là qua đề nghị giải ngân (`createRequest` → duyệt → ghi nhận đã
   * chi). Đường này dành cho khoản đã chi trước khi hệ thống vận hành, và cho
   * giao dịch hoàn trả — hoàn trả không có "đề nghị" nào cả.
   */
  async addEntry(code: string, dto: CreateEntryDto, user?: JwtPayload) {
    const item = await this.findWritable(code, 'ghi nhận giao dịch');
    this.assertApproved(item, 'ghi nhận giao dịch giải ngân');
    this.assertVnd(dto.amountDong, 'Số tiền giao dịch');
    if (dto.amountDong <= 0) throw new BadRequestException('Số tiền giao dịch phải lớn hơn 0');

    const type = dto.type ?? 'chi';
    if (type === 'chi') {
      const remaining = this.remainingBudget(item);
      if (dto.amountDong > remaining) {
        throw new BadRequestException(
          `Số tiền vượt phần vốn còn lại (${formatVnd(remaining)}, đã trừ các đề nghị đang chờ duyệt). ` +
            'Cần chi thêm thì phải điều chỉnh dự toán trước.',
        );
      }
    } else if (dto.amountDong > item.actualDong) {
      throw new BadRequestException(
        `Số hoàn trả (${formatVnd(dto.amountDong)}) lớn hơn số đã giải ngân (${formatVnd(item.actualDong)}).`,
      );
    }

    item.entries.push({
      date: dto.date,
      type,
      amountDong: Math.trunc(dto.amountDong),
      content: dto.content,
      voucherNo: dto.voucherNo ?? '',
      vendor: dto.vendor ?? '',
      vendorTaxCode: dto.vendorTaxCode ?? '',
      fileIds: dto.fileIds ?? [],
      by: user?.displayName ?? SYSTEM_AUTHOR,
      requestCode: '',
      recordedAt: new Date(),
    });

    this.recompute(item);
    const label = DISBURSEMENT_ENTRY_TYPE_LABELS[type];
    item.progressLogs.push(
      this.buildLog(label, user, {
        plannedDong: item.plannedDong,
        actualDong: item.actualDong,
        note: `${label} ${formatVnd(dto.amountDong)} ngày ${dto.date}${dto.voucherNo ? `, chứng từ ${dto.voucherNo}` : ''}`,
      }),
    );
    await item.save();

    return {
      ...this.withProgress(item.toObject() as LeanBudgetItem),
      entry: item.entries[item.entries.length - 1],
    };
  }

  /** Gắn một văn bản / hồ sơ vào hạng mục */
  async addDocument(code: string, dto: AddBudgetDocumentDto, user?: JwtPayload) {
    const item = await this.findWritable(code, 'gắn hồ sơ');
    item.documents.push({
      refNo: dto.refNo ?? '',
      docType: dto.docType ?? '',
      issuedDate: dto.issuedDate ?? '',
      issuer: dto.issuer ?? '',
      summary: dto.summary ?? '',
      fileId: dto.fileId,
      addedBy: user?.displayName ?? SYSTEM_AUTHOR,
      addedAt: new Date(),
    });
    await item.save();
    return this.withProgress(item.toObject() as LeanBudgetItem);
  }

  /**
   * Gỡ một hồ sơ khỏi hạng mục — chỉ bỏ liên kết, tệp vẫn còn trong kho tệp.
   * Không gỡ được khi hồ sơ là căn cứ của một lần điều chỉnh dự toán.
   */
  async removeDocument(code: string, fileId: string, user?: JwtPayload) {
    const item = await this.findWritable(code, 'gỡ hồ sơ');
    const index = item.documents.findIndex((d) => d.fileId === fileId);
    if (index < 0) throw new NotFoundException(`Hạng mục ${code} không có hồ sơ ${fileId}`);

    const usedByAdjustment = (item.adjustments ?? []).some((a) => a.fileIds?.includes(fileId));
    if (usedByAdjustment) {
      throw new BadRequestException(
        'Hồ sơ này là căn cứ của một lần điều chỉnh dự toán nên không gỡ được. ' +
          'Gỡ căn cứ là mất cơ sở giải trình cho con số kế hoạch vốn.',
      );
    }

    const [removed] = item.documents.splice(index, 1);
    item.markModified('documents');
    item.progressLogs.push(
      this.buildLog('Gỡ hồ sơ', user, {
        plannedDong: item.plannedDong,
        actualDong: item.actualDong,
        note: `Gỡ hồ sơ ${removed.refNo || removed.fileId}`,
      }),
    );
    await item.save();
    return this.withProgress(item.toObject() as LeanBudgetItem);
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
    const item = await this.findWritable(code, 'thêm vướng mắc');
    item.obstacles.push({
      content: dto.content,
      owner: dto.owner ?? '',
      deadline: dto.deadline ?? '',
    });
    await item.save();
    return { code: item.code, obstacles: item.obstacles };
  }

  /** Đánh dấu vướng mắc đã tháo gỡ — gỡ khỏi danh sách và ghi vào trao đổi */
  async resolveObstacle(code: string, index: number, user?: JwtPayload) {
    const item = await this.findWritable(code, 'tháo gỡ vướng mắc');
    if (!Number.isInteger(index) || index < 0 || index >= item.obstacles.length) {
      throw new NotFoundException('Không tìm thấy vướng mắc cần tháo gỡ');
    }

    const [removed] = item.obstacles.splice(index, 1);
    item.markModified('obstacles');
    item.comments.push(this.buildComment(`Đã tháo gỡ vướng mắc: ${removed.content}`, user, true));
    await item.save();

    return { code: item.code, resolved: removed, obstacles: item.obstacles };
  }

  /* ─────────────────────── Đề nghị giải ngân ─────────────────────── */

  /**
   * Gửi đề nghị giải ngân đợt tiếp theo — bước đầu của luồng một cấp duyệt.
   *
   * Chặn tổng đề nghị vượt kế hoạch vốn: phần vốn còn lại tính theo cả số đã chi
   * LẪN các đề nghị đang treo (pending + approved). Nếu chỉ trừ số đã chi thì
   * gửi ba đề nghị liên tiếp, mỗi cái vừa đúng phần còn lại, sẽ lọt hết và tổng
   * cam kết vượt vốn giao.
   */
  async createRequest(code: string, dto: CreateDisbursementRequestDto, user?: JwtPayload) {
    const item = await this.findWritable(code, 'gửi đề nghị giải ngân');
    this.assertApproved(item, 'gửi đề nghị giải ngân');
    this.assertVnd(dto.amountDong, 'Số tiền đề nghị');
    if (dto.amountDong <= 0) throw new BadRequestException('Số tiền đề nghị phải lớn hơn 0');

    const remaining = this.remainingBudget(item);
    if (dto.amountDong > remaining) {
      throw new BadRequestException(
        `Số tiền đề nghị vượt phần vốn còn lại (${formatVnd(remaining)}, đã trừ các đề nghị đang chờ duyệt)`,
      );
    }

    const request: DisbursementRequest = {
      code: this.nextRequestCode(item),
      amountDong: Math.trunc(dto.amountDong),
      content: dto.content,
      vendor: dto.vendor ?? '',
      vendorTaxCode: dto.vendorTaxCode ?? '',
      status: 'pending',
      requestedBy: user?.displayName ?? SYSTEM_AUTHOR,
      requestedAt: this.nowLabel(),
      decidedBy: '',
      decidedAt: '',
      rejectReason: '',
      voucherNo: '',
      disbursedAt: '',
      fileIds: dto.fileIds ?? [],
    };
    item.requests.push(request);

    const vendorLabel = dto.vendor ? ` — đơn vị thụ hưởng: ${dto.vendor}` : '';
    item.comments.push(
      this.buildComment(
        `Gửi đề nghị giải ngân ${request.code}: ${formatVnd(dto.amountDong)} cho "${dto.content}"${vendorLabel}`,
        user,
      ),
    );
    await item.save();

    this.logger.log(`Đề nghị giải ngân ${code}/${request.code}: ${formatVnd(dto.amountDong)}`);
    return {
      code: item.code,
      request,
      remainingDong: this.remainingBudget(item),
      message: 'Đề nghị giải ngân chờ duyệt',
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
    const countBy = (status: DisbursementRequestStatus) =>
      all.filter((r) => r.status === status).length;

    return {
      year,
      items: rows,
      summary: {
        pending: countBy('pending'),
        approved: countBy('approved'),
        rejected: countBy('rejected'),
        disbursed: countBy('disbursed'),
        /** Tổng tiền đang chờ duyệt — phần ngân sách đã cam kết nhưng chưa quyết */
        pendingAmountDong: sumVnd(
          all.filter((r) => r.status === 'pending').map((r) => r.amountDong ?? 0),
        ),
      },
    };
  }

  /** Duyệt đề nghị: chuyển pending → approved. Chưa cộng tiền vào luỹ kế. */
  async approveRequest(code: string, requestCode: string, user?: JwtPayload) {
    const item = await this.findWritable(code, 'duyệt đề nghị');
    const request = this.findRequestOrFail(item, requestCode);
    this.assertRequestStatus(request, 'pending', 'duyệt');

    request.status = 'approved';
    request.decidedBy = user?.displayName ?? SYSTEM_AUTHOR;
    request.decidedAt = this.nowLabel();

    item.comments.push(
      this.buildComment(
        `Đã duyệt đề nghị giải ngân ${request.code}: ${formatVnd(request.amountDong)} cho "${request.content}"`,
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
    const item = await this.findWritable(code, 'từ chối đề nghị');
    const request = this.findRequestOrFail(item, requestCode);
    this.assertRequestStatus(request, 'pending', 'từ chối');

    request.status = 'rejected';
    request.rejectReason = dto.reason;
    request.decidedBy = user?.displayName ?? SYSTEM_AUTHOR;
    request.decidedAt = this.nowLabel();

    item.comments.push(
      this.buildComment(`Đã từ chối đề nghị giải ngân ${request.code}. Lý do: ${dto.reason}`, user),
    );
    await item.save();
    return { code: item.code, request };
  }

  /**
   * Ghi nhận đề nghị đã chi thật: approved → disbursed.
   *
   * ĐÂY là chỗ duy nhất tiền của một đề nghị được cộng vào luỹ kế đã chi, và
   * cùng lúc sinh một giao dịch trong sổ — nhờ vậy mỗi khoản chi đều truy ngược
   * được về đề nghị đã duyệt sinh ra nó (`entry.requestCode`).
   */
  async disburseRequest(
    code: string,
    requestCode: string,
    dto: DisburseRequestDto,
    user?: JwtPayload,
  ) {
    const item = await this.findWritable(code, 'ghi nhận đã chi');
    const request = this.findRequestOrFail(item, requestCode);
    this.assertRequestStatus(request, 'approved', 'ghi nhận đã chi');

    const date = dto.date?.trim() || this.todayLabel();
    request.status = 'disbursed';
    request.voucherNo = dto.voucherNo;
    request.disbursedAt = date;

    item.entries.push({
      date,
      type: 'chi',
      amountDong: request.amountDong,
      content: request.content,
      voucherNo: dto.voucherNo,
      vendor: request.vendor,
      vendorTaxCode: request.vendorTaxCode ?? '',
      fileIds: dto.fileIds ?? [],
      by: user?.displayName ?? SYSTEM_AUTHOR,
      requestCode: request.code,
      recordedAt: new Date(),
    });

    this.recompute(item);
    item.progressLogs.push(
      this.buildLog('Ghi nhận đã chi', user, {
        plannedDong: item.plannedDong,
        actualDong: item.actualDong,
        note: `Đề nghị ${request.code}: ${formatVnd(request.amountDong)}, chứng từ ${dto.voucherNo}`,
      }),
    );
    item.comments.push(
      this.buildComment(
        `Đã giải ngân đề nghị ${request.code}: ${formatVnd(request.amountDong)}, chứng từ ${dto.voucherNo}`,
        user,
      ),
    );
    await item.save();

    return {
      ...this.withProgress(item.toObject() as LeanBudgetItem),
      request,
      entry: item.entries[item.entries.length - 1],
    };
  }

  /* ───────────────────────────── Xoá mềm ───────────────────────────── */

  /**
   * Xoá mềm hạng mục: bật cờ `isDeleted` chứ KHÔNG xoá tài liệu.
   *
   * Hạng mục đã phát sinh chứng từ là số liệu quyết toán ngân sách — xoá cứng là
   * mất dấu tiền đã giải ngân, và không có đường phục hồi.
   *
   * Bộ lọc `NOT_DELETED` trong `findOneAndUpdate` là chốt quan trọng: gọi xoá
   * lần hai phải trả 404 chứ không được ghi đè mốc xoá và người xoá của lần
   * đầu — mất mốc đó là mất vết ai xoá thật.
   */
  async softDelete(code: string, dto: DeleteBudgetItemDto, user?: JwtPayload) {
    const actorId = user?.sub ?? '';
    const updated = await this.budgetModel
      .findOneAndUpdate({ code, ...NOT_DELETED }, softDeleteUpdate(actorId, dto.reason), { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    this.logger.warn(
      `Xoá mềm hạng mục ${code} bởi ${user?.username ?? SYSTEM_AUTHOR}` + (dto.reason?.trim() ? `. Lý do: ${dto.reason.trim()}` : ''),
    );
    return this.withProgress(updated as LeanBudgetItem);
  }

  /** Khôi phục hạng mục đã xoá mềm — bản ghi trở lại danh sách đang dùng */
  async restore(code: string) {
    const updated = await this.budgetModel
      .findOneAndUpdate({ code, ...IS_DELETED }, softRestoreUpdate(), { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Không tìm thấy hạng mục đã xoá ${code}`);
    this.logger.log(`Đã khôi phục hạng mục ${code}`);
    return this.withProgress(updated as LeanBudgetItem);
  }

  /* ───────────────────────────── Tiện ích nội bộ ───────────────────────────── */

  /** Bản ghi ghi được; ném 404 nếu không có */
  private async findOrFail(code: string): Promise<BudgetItemDocument> {
    const item = await this.budgetModel.findOne({ code }).exec();
    if (!item) throw new NotFoundException(`Không tìm thấy hạng mục ${code}`);
    return item;
  }

  /**
   * Bản ghi ghi được VÀ hồ sơ chưa chốt.
   *
   * Hạng mục đã huỷ hoặc đã quyết toán thì khoá mọi đường ghi: quyết toán là mốc
   * chốt số liệu năm ngân sách, sửa sau đó là làm lệch báo cáo đã gửi cấp trên.
   */
  private async findWritable(code: string, action: string): Promise<BudgetItemDocument> {
    const item = await this.findOrFail(code);
    if (CLOSED_STATUSES.includes(item.approvalStatus)) {
      throw new BadRequestException(
        `Hạng mục ${code} đang ở trạng thái "${BUDGET_APPROVAL_LABELS[item.approvalStatus]}" ` +
          `nên không ${action} được nữa.`,
      );
    }
    return item;
  }

  /** Chỉ hạng mục ĐÃ PHÊ DUYỆT mới được phát sinh tiền */
  private assertApproved(item: BudgetItemDocument, action: string): void {
    if (item.approvalStatus !== 'da-duyet') {
      throw new BadRequestException(
        `Hạng mục đang ở trạng thái "${BUDGET_APPROVAL_LABELS[item.approvalStatus]}". ` +
          `Phải được phê duyệt trước khi ${action}.`,
      );
    }
  }

  private assertVnd(value: number, label: string): void {
    if (!isValidVnd(value)) {
      throw new BadRequestException(
        `${label} phải là số nguyên không âm, đơn vị đồng (ví dụ 850000000 cho 850 triệu đồng).`,
      );
    }
  }

  /** Ngày bắt đầu không được sau ngày kết thúc */
  private assertPlanPeriod(startDate?: string, endDate?: string): void {
    if (!startDate?.trim() || !endDate?.trim()) return;
    const start = this.toDate(startDate);
    const end = this.toDate(endDate);
    if (!start || !end) {
      throw new BadRequestException('Mốc kế hoạch phải theo định dạng dd/MM/yyyy');
    }
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('Ngày bắt đầu kế hoạch không được sau ngày kết thúc');
    }
  }

  /**
   * Tổng kế hoạch quý không được vượt kế hoạch vốn.
   *
   * Vượt là bảng kế hoạch tự mâu thuẫn với dự toán được giao, và mọi kết luận
   * tiến độ sau đó đều dựa trên con số không có căn cứ.
   */
  private assertQuarterPlans(
    quarterPlans: { quarter: number; amountDong: number }[] | undefined,
    plannedDong: number,
  ): void {
    if (!quarterPlans?.length) return;
    const seen = new Set<number>();
    for (const plan of quarterPlans) {
      if (seen.has(plan.quarter)) {
        throw new BadRequestException(`Quý ${plan.quarter} bị khai hai lần trong kế hoạch`);
      }
      seen.add(plan.quarter);
      this.assertVnd(plan.amountDong, `Kế hoạch quý ${plan.quarter}`);
    }
    const total = sumVnd(quarterPlans.map((q) => q.amountDong));
    if (total > plannedDong) {
      throw new BadRequestException(
        `Tổng kế hoạch 4 quý (${formatVnd(total)}) vượt kế hoạch vốn (${formatVnd(plannedDong)}).`,
      );
    }
  }

  /**
   * Phần vốn còn có thể cam kết = kế hoạch vốn − đã chi − đang treo.
   * "Đang treo" gồm cả `pending` và `approved`: đã duyệt là đã cam kết, dù tiền
   * chưa ra khỏi kho bạc.
   */
  private remainingBudget(item: BudgetItemDocument): number {
    const committed = sumVnd(
      (item.requests ?? [])
        .filter((r) => r.status === 'pending' || r.status === 'approved')
        .map((r) => r.amountDong ?? 0),
    );
    return item.plannedDong - item.actualDong - committed;
  }

  private findRequestOrFail(item: BudgetItemDocument, requestCode: string): DisbursementRequest {
    const request = (item.requests ?? []).find((r) => r.code === requestCode);
    if (!request) {
      throw new NotFoundException(`Hạng mục ${item.code} không có đề nghị ${requestCode}`);
    }
    return request;
  }

  private assertRequestStatus(
    request: DisbursementRequest,
    expected: DisbursementRequestStatus,
    action: string,
  ): void {
    if (request.status !== expected) {
      throw new BadRequestException(
        `Đề nghị ${request.code} đang ở trạng thái "${request.status}" nên không ${action} được.`,
      );
    }
  }

  /** Mã hạng mục kế tiếp: HM-01, HM-02… */
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

  /** Mã đề nghị kế tiếp trong phạm vi hạng mục */
  private nextRequestCode(item: BudgetItemDocument): string {
    const numbers = (item.requests ?? []).map((r) =>
      Number.parseInt(r.code.slice(REQUEST_PREFIX.length), 10),
    );
    const next = numbers.length > 0 ? Math.max(...numbers.filter(Number.isFinite)) + 1 : 1;
    return `${REQUEST_PREFIX}${String(next).padStart(REQUEST_DIGITS, '0')}`;
  }

  /**
   * Dựng bình luận theo khuôn `Comment` dùng chung (`@vigov/shared`).
   *
   * v2 lưu id người gửi và thời điểm dạng số; chữ viết tắt và màu avatar là
   * cách trình bày nên client tự tính từ tên đã resolve.
   */
  private buildComment(content: string, user?: JwtPayload, system = false): Comment {
    return comment(content, { authorId: system ? '' : (user?.sub ?? '') });
  }

  /** Dựng một mốc lịch sử tiến độ */
  private buildLog(
    action: string,
    user: JwtPayload | undefined,
    fields: {
      fromStatus?: string;
      toStatus?: string;
      plannedDong: number;
      actualDong: number;
      note?: string;
      lateReason?: string;
    },
  ) {
    return {
      at: new Date(),
      by: user?.displayName ?? SYSTEM_AUTHOR,
      action,
      fromStatus: fields.fromStatus ?? '',
      toStatus: fields.toStatus ?? '',
      plannedDong: fields.plannedDong,
      actualDong: fields.actualDong,
      note: fields.note ?? '',
      lateReason: fields.lateReason ?? '',
    };
  }

  /** Viết tắt tên hiển thị: "Nguyễn Văn A" → "NA" */
  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
    return `${first}${last}`.toUpperCase();
  }

  /** dd/MM/yyyy HH:mm — định dạng hiển thị dùng chung với các phân hệ khác */
  private nowLabel(): string {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
  }

  private todayLabel(): string {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
  }

  private toDate(value: string): Date | null {
    const matched = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((value ?? '').trim());
    if (!matched) return null;
    const date = new Date(Number(matched[3]), Number(matched[2]) - 1, Number(matched[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
