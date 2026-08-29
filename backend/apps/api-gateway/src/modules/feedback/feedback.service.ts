import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  EVENTS,
  Feedback,
  SlaRule,
  type FeedbackAssignedEvent,
  type FeedbackCreatedEvent,
  type FeedbackDocument,
  type FeedbackResolvedEvent,
  type SlaRuleDocument,
} from '@vigov/shared';
import { NotificationService } from '../notification/notification.service';
import { REALTIME_EVENTS, RealtimeService } from '../realtime/realtime.service';
import {
  AssignFeedbackDto,
  CreateCitizenFeedbackDto,
  ListFeedbackQueryDto,
  RateFeedbackDto,
  ResolveFeedbackDto,
  TransferFeedbackDto,
} from './dto/feedback.dto';

/** Phân trang danh sách phản ánh */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Tiền tố mã phiếu hiển thị: #PA-2026-0141 */
const FEEDBACK_CODE_PREFIX = '#PA-';
const CODE_SEQ_DIGITS = 4;
/** Số lần thử lại khi hai phiếu cùng sinh một số thứ tự (unique index chặn) */
const CODE_MAX_RETRY = 5;
const MONGO_DUPLICATE_KEY = 11000;

/** SLA mặc định khi lĩnh vực chưa có cấu hình trong sla_rules */
const DEFAULT_RESOLVE_DAYS = 7;

/** Cửa sổ chống spam: đếm số phiếu công dân gửi trong 24 giờ gần nhất */
const SPAM_WINDOW_HOURS = 24;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Trường trả về cho công dân — ẩn thông tin điều hành nội bộ */
const CITIZEN_PROJECTION =
  'code categoryKey title description location lat lng sentAt status slaDueAt imageFileIds resultImageFileIds channel timeline rating ratingComment createdAt updatedAt';

/**
 * Che số điện thoại công dân trước khi trả ra Web Quản trị — giữ 3 số đầu và 3 số
 * cuối ("0987654321" → "098•••321"), thống nhất với chính sách của phân hệ Người
 * dùng (UsersService.maskPhone). Vai trò nào được xem số thật để liên hệ là câu
 * hỏi mở #15; trước khi khách chốt thì KHÔNG endpoint nào trả số đầy đủ.
 */
const PHONE_MASK_HEAD = 3;
const PHONE_MASK_TAIL = 3;
const PHONE_MASK_FILL = '•••';

/** Nhãn kênh gửi hiển thị trên timeline */
const CHANNEL_LABELS: Record<string, string> = {
  app: 'Ứng dụng công dân',
  zalo: 'Zalo Mini App',
  web: 'Cổng thông tin',
};

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(SlaRule.name) private readonly slaRuleModel: Model<SlaRuleDocument>,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Nhóm nghiệp vụ CÁN BỘ (Web Quản trị)
  // ---------------------------------------------------------------------------

  /** Danh sách phản ánh có lọc + phân trang, kèm số giờ còn lại theo SLA */
  async list(query: ListFeedbackQueryDto) {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const filter: FilterQuery<FeedbackDocument> = {};
    if (query.categoryKey) filter.categoryKey = query.categoryKey;
    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.assignee) filter.assignee = query.assignee;
    if (query.q?.trim()) {
      const keyword = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ code: keyword }, { title: keyword }, { description: keyword }, { location: keyword }];
    }

    const [items, total] = await Promise.all([
      this.feedbackModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.feedbackModel.countDocuments(filter).exec(),
    ]);

    return { items: items.map((item) => toStaffView(item)), total, page, limit };
  }

  /**
   * 4 thẻ thống kê đầu trang Phản ánh (WBS #6).
   * Mốc thời gian dùng createdAt (Date do timestamps sinh) thay vì sentAt (chuỗi hiển thị).
   */
  async stats() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inMonth: FilterQuery<FeedbackDocument> = { createdAt: { $gte: from, $lt: to } };

    const [received, resolved, onTime, rating] = await Promise.all([
      this.feedbackModel.countDocuments(inMonth).exec(),
      this.feedbackModel.countDocuments({ ...inMonth, status: 'resolved' }).exec(),
      // Đúng hạn = thời điểm cập nhật cuối (lúc xác nhận xử lý xong) <= slaDueAt.
      // Phiếu không có slaDueAt bị tính là quá hạn để không thổi phồng chỉ số.
      this.feedbackModel
        .aggregate<{ total: number; onTime: number }>([
          { $match: { ...inMonth, status: 'resolved' } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              onTime: {
                $sum: {
                  $cond: [
                    { $and: [{ $ne: ['$slaDueAt', null] }, { $lte: ['$updatedAt', '$slaDueAt'] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
      this.feedbackModel
        .aggregate<{ avg: number; count: number }>([
          { $match: { ...inMonth, rating: { $gt: 0 } } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const onTimeTotal = onTime[0]?.total ?? 0;
    const onTimeCount = onTime[0]?.onTime ?? 0;

    return {
      month: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
      /** Thẻ 1: tổng phản ánh tiếp nhận trong tháng */
      receivedThisMonth: received,
      /** Thẻ 2: số phản ánh đã xử lý xong trong tháng */
      resolvedThisMonth: resolved,
      /** Thẻ 3: tỷ lệ xử lý đúng hạn (%) */
      onTimeRate: onTimeTotal === 0 ? 0 : Math.round((onTimeCount / onTimeTotal) * 100),
      /** Thẻ 4: điểm hài lòng trung bình (thang 5) */
      avgRating: rating[0] ? Math.round(rating[0].avg * 10) / 10 : 0,
      ratedCount: rating[0]?.count ?? 0,
    };
  }

  /** Chi tiết một phiếu phản ánh */
  async detail(code: string) {
    const doc = await this.feedbackModel.findOne({ code }).lean().exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    return toStaffView(doc);
  }

  /** Phân công cán bộ + bộ phận xử lý; phiếu chuyển sang trạng thái đang xử lý */
  async assign(code: string, dto: AssignFeedbackDto, actor: string) {
    const fb = await this.findOrFail(code);
    fb.assignee = dto.assignee;
    fb.department = dto.department;
    if (fb.status === 'received') fb.status = 'processing';
    pushTimeline(
      fb,
      `Phân công ${dto.assignee} — ${dto.department}`,
      [timeLabel(new Date()), actor, dto.note].filter(Boolean).join(' · '),
    );
    await fb.save();

    const event: FeedbackAssignedEvent = {
      feedbackId: String(fb._id),
      code: fb.code,
      title: fb.title,
      categoryKey: fb.categoryKey,
      department: fb.department,
      assignee: fb.assignee,
    };
    // P3-30 sẽ đẩy sự kiện này qua RabbitMQ để module Workflow tạo nhiệm vụ xử lý.
    this.logger.log(`${EVENTS.FEEDBACK_ASSIGNED}: ${event.code} → ${event.assignee}`);

    // Báo công dân biết phản ánh đã được tiếp nhận và có cán bộ thụ lý
    await this.notifications.notifyFeedbackReceived({
      code: fb.code,
      citizenPhone: fb.citizenPhone,
      title: fb.title,
      slaDueAt: fb.slaDueAt,
      department: fb.department,
    });
    // Báo cán bộ được phân công qua chuông in-app
    await this.notifications.notifyStaff(
      dto.assignee,
      `Bạn được phân công xử lý phản ánh ${fb.code}`,
      fb.title,
      { feedbackCode: fb.code },
    );

    // Cập nhật thời gian thực (P5-05): bộ phận chủ trì và cán bộ vừa nhận việc thấy ngay
    this.emitChanged('assigned', fb);

    return toStaffView(fb.toObject());
  }

  /** Xác nhận đã xử lý xong + gửi kết quả cho công dân */
  async resolve(code: string, dto: ResolveFeedbackDto, actor: string) {
    const fb = await this.findOrFail(code);
    const resolvedAt = new Date();
    fb.status = 'resolved';
    if (dto.resultImageFileIds?.length) fb.resultImageFileIds = dto.resultImageFileIds;
    pushTimeline(fb, 'Đã xử lý xong', `${timeLabel(resolvedAt)} · ${actor} · ${dto.note}`);
    await fb.save();

    const event: FeedbackResolvedEvent = {
      feedbackId: String(fb._id),
      code: fb.code,
      citizenPhone: fb.citizenPhone,
      title: fb.title,
      resolvedAt: resolvedAt.toISOString(),
    };
    this.logger.log(`${EVENTS.FEEDBACK_RESOLVED}: ${event.code}`);

    // Câu hỏi mở #9 — tự động gửi kết quả qua Zalo hay để cán bộ bấm gửi thủ công?
    // Chốt tạm: BẬT tự động; nếu khách yêu cầu duyệt trước khi gửi thì thêm cờ
    // cấu hình và chuyển lời gọi này sang một endpoint gửi riêng.
    await this.notifications.notifyFeedbackResolved({
      code: fb.code,
      citizenPhone: fb.citizenPhone,
      title: fb.title,
      resolvedAt: timeLabel(resolvedAt),
      note: dto.note,
    });

    // Cập nhật thời gian thực (P5-05)
    this.emitChanged('resolved', fb);

    return toStaffView(fb.toObject());
  }

  /** Chuyển phản ánh sang bộ phận khác (sai địa chỉ / vượt thẩm quyền) */
  async transfer(code: string, dto: TransferFeedbackDto, actor: string) {
    const fb = await this.findOrFail(code);
    const previous = fb.department || 'chưa phân công';
    fb.department = dto.department;
    // Chuyển bộ phận thì cán bộ cũ hết trách nhiệm, trừ khi bàn giao đích danh
    fb.assignee = dto.assignee ?? '';
    if (fb.status === 'received' && dto.assignee) fb.status = 'processing';
    pushTimeline(
      fb,
      `Chuyển từ ${previous} sang ${dto.department}`,
      `${timeLabel(new Date())} · ${actor} · ${dto.reason}`,
    );
    await fb.save();

    if (dto.assignee) {
      await this.notifications.notifyStaff(
        dto.assignee,
        `Phản ánh ${fb.code} được chuyển tới bạn`,
        fb.title,
        { feedbackCode: fb.code },
      );
    }
    return toStaffView(fb.toObject());
  }

  // ---------------------------------------------------------------------------
  // Nhóm nghiệp vụ CÔNG DÂN (app Flutter / Zalo Mini App)
  // ---------------------------------------------------------------------------

  /** Công dân gửi phản ánh mới */
  async createByCitizen(dto: CreateCitizenFeedbackDto, citizenPhone: string, citizenName: string) {
    await this.assertNotSpamming(citizenPhone);

    const sla = await this.slaRuleModel.findOne({ categoryKey: dto.categoryKey }).lean().exec();
    const resolveDays = sla?.resolveDays ?? DEFAULT_RESOLVE_DAYS;
    const sentAt = new Date();
    const slaDueAt = addResolveDays(sentAt, resolveDays);
    const channel = dto.channel ?? 'app';

    const payload = {
      categoryKey: dto.categoryKey,
      title: dto.title,
      description: dto.description,
      location: dto.location ?? '',
      lat: dto.lat,
      lng: dto.lng,
      sentAt: timeLabel(sentAt),
      status: 'received',
      slaDueAt,
      imageFileIds: dto.imageFileIds ?? [],
      resultImageFileIds: [],
      citizenPhone,
      citizenName: dto.citizenName ?? citizenName,
      channel,
      assignee: '',
      department: '',
      rating: 0,
      timeline: [
        {
          title: 'Công dân gửi phản ánh',
          meta: `${timeLabel(sentAt)} · ${CHANNEL_LABELS[channel] ?? channel}`,
          state: 'ok',
        },
        {
          title: 'Chờ tiếp nhận & phân công',
          meta: `Hạn xử lý theo SLA: ${timeLabel(slaDueAt)}`,
          state: 'cur',
        },
      ],
    };

    const created = await this.createWithUniqueCode(payload, sentAt.getFullYear());

    const event: FeedbackCreatedEvent = {
      feedbackId: String(created._id),
      code: created.code,
      citizenPhone,
      categoryKey: created.categoryKey,
      slaHours: resolveDays * 24,
    };
    this.logger.log(`${EVENTS.FEEDBACK_CREATED}: ${event.code} (${event.categoryKey})`);

    await this.notifications.notifyFeedbackReceived({
      code: created.code,
      citizenPhone,
      title: created.title,
      slaDueAt,
    });

    // Cập nhật thời gian thực (P5-05): cán bộ tiếp nhận thấy phiếu mới ngay trên màn hình
    this.emitChanged('created', created);

    return withSlaHoursLeft(created.toObject());
  }

  /** Danh sách phản ánh của chính công dân đang đăng nhập */
  async listMine(citizenPhone: string, query: ListFeedbackQueryDto) {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const filter: FilterQuery<FeedbackDocument> = { citizenPhone };
    if (query.status) filter.status = query.status;
    if (query.categoryKey) filter.categoryKey = query.categoryKey;

    const [items, total] = await Promise.all([
      this.feedbackModel
        .find(filter)
        .select(CITIZEN_PROJECTION)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.feedbackModel.countDocuments(filter).exec(),
    ]);

    return { items: items.map((item) => withSlaHoursLeft(item)), total, page, limit };
  }

  /** Chi tiết phiếu của chính công dân — không phải của mình thì coi như không tồn tại */
  async detailMine(code: string, citizenPhone: string) {
    const doc = await this.feedbackModel
      .findOne({ code, citizenPhone })
      .select(CITIZEN_PROJECTION)
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    return withSlaHoursLeft(doc);
  }

  /** Công dân đánh giá 1–5 sao, chỉ mở khi phiếu đã xử lý xong */
  async rateMine(code: string, citizenPhone: string, dto: RateFeedbackDto) {
    const fb = await this.feedbackModel.findOne({ code, citizenPhone }).exec();
    if (!fb) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    if (fb.status !== 'resolved') {
      throw new HttpException(
        'Chỉ đánh giá được khi phản ánh đã xử lý xong',
        HttpStatus.CONFLICT,
      );
    }

    fb.rating = dto.rating;
    fb.ratingComment = dto.ratingComment ?? '';
    pushTimeline(fb, `Công dân đánh giá ${dto.rating}/5 sao`, `${timeLabel(new Date())}${dto.ratingComment ? ` · ${dto.ratingComment}` : ''}`);
    await fb.save();

    return { code: fb.code, rating: fb.rating, ratingComment: fb.ratingComment };
  }

  // ---------------------------------------------------------------------------
  // Hỗ trợ nội bộ
  // ---------------------------------------------------------------------------

  /**
   * Phát tín hiệu "phiếu phản ánh vừa đổi" qua Socket.IO (P5-05).
   *
   * Chỉ gửi {type, code, status, at} — client nhận rồi tự gọi lại API để lấy bản ghi
   * đã lọc theo quyền, nhờ vậy không rò rỉ SĐT công dân qua kênh WebSocket.
   * RealtimeService nuốt mọi lỗi nên lời gọi này không thể làm hỏng nghiệp vụ.
   */
  private emitChanged(type: 'created' | 'assigned' | 'resolved', fb: FeedbackDocument): void {
    this.realtime.emitChange(
      REALTIME_EVENTS.FEEDBACK_CHANGED,
      { type, code: fb.code, status: fb.status, at: new Date().toISOString() },
      { department: fb.department, user: fb.assignee },
    );
  }

  private async findOrFail(code: string): Promise<FeedbackDocument> {
    const fb = await this.feedbackModel.findOne({ code }).exec();
    if (!fb) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    return fb;
  }

  /**
   * Chống spam: một công dân chỉ được gửi tối đa security.feedbackMaxPerDay
   * phiếu trong 24 giờ. Vượt ngưỡng trả 429 để app hiển thị thông báo rõ ràng.
   */
  private async assertNotSpamming(citizenPhone: string): Promise<void> {
    const maxPerDay = this.config.get<number>('security.feedbackMaxPerDay', 5);
    const since = new Date(Date.now() - SPAM_WINDOW_HOURS * MS_PER_HOUR);
    const sentRecently = await this.feedbackModel
      .countDocuments({ citizenPhone, createdAt: { $gte: since } })
      .exec();

    if (sentRecently >= maxPerDay) {
      throw new HttpException(
        `Quý vị đã gửi ${sentRecently} phản ánh trong ${SPAM_WINDOW_HOURS} giờ qua. ` +
          `Mỗi người chỉ được gửi tối đa ${maxPerDay} phản ánh mỗi ngày, vui lòng thử lại sau.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Sinh mã #PA-<năm>-<4 chữ số> và tạo phiếu.
   * Unique index trên `code` là chốt chặn cuối khi hai yêu cầu vào cùng lúc —
   * gặp lỗi trùng khoá thì lấy lại số thứ tự và thử lại.
   */
  private async createWithUniqueCode(
    payload: Record<string, unknown>,
    year: number,
  ): Promise<FeedbackDocument> {
    for (let attempt = 0; attempt < CODE_MAX_RETRY; attempt += 1) {
      const code = await this.nextCode(year);
      try {
        return await this.feedbackModel.create({ ...payload, code });
      } catch (err) {
        if ((err as { code?: number }).code === MONGO_DUPLICATE_KEY) {
          this.logger.warn(`Mã phiếu ${code} bị trùng, sinh lại (lần ${attempt + 1})`);
          continue;
        }
        throw err;
      }
    }
    throw new HttpException(
      'Hệ thống đang bận, vui lòng gửi lại phản ánh sau ít phút',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /** Số thứ tự tiếp theo trong năm, đánh lại từ 0001 mỗi năm */
  private async nextCode(year: number): Promise<string> {
    const prefix = `${FEEDBACK_CODE_PREFIX}${year}-`;
    const latest = await this.feedbackModel
      .findOne({ code: new RegExp(`^${escapeRegex(prefix)}`) })
      .sort({ code: -1 })
      .select('code')
      .lean()
      .exec();

    const lastSeq = latest ? Number.parseInt(latest.code.slice(prefix.length), 10) : 0;
    const nextSeq = (Number.isNaN(lastSeq) ? 0 : lastSeq) + 1;
    return `${prefix}${String(nextSeq).padStart(CODE_SEQ_DIGITS, '0')}`;
  }
}

// -----------------------------------------------------------------------------
// Hàm thuần dùng chung trong module
// -----------------------------------------------------------------------------

/**
 * Hạn xử lý = ngày gửi + resolveDays.
 * TẠM cộng ngày lịch cho đơn giản. Ngày làm việc thật phải trừ thứ Bảy, Chủ nhật
 * và ngày nghỉ lễ theo lịch nhà nước — bổ sung khi module Cấu hình có bảng ngày nghỉ.
 */
function addResolveDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/** Số giờ còn lại tới hạn SLA; giá trị ÂM nghĩa là đã quá hạn */
function hoursLeft(slaDueAt?: Date | null): number | null {
  if (!slaDueAt) return null;
  return Math.round(((new Date(slaDueAt).getTime() - Date.now()) / MS_PER_HOUR) * 10) / 10;
}

/** Bổ sung slaHoursLeft cho bản ghi trả về FE */
function withSlaHoursLeft<T extends { slaDueAt?: Date | null }>(doc: T): T & { slaHoursLeft: number | null } {
  return { ...doc, slaHoursLeft: hoursLeft(doc.slaDueAt) };
}

/** Che số điện thoại: "0987654321" → "098•••321" */
function maskPhone(phone?: string): string {
  if (!phone) return '';
  if (phone.length <= PHONE_MASK_HEAD + PHONE_MASK_TAIL) return phone;
  return `${phone.slice(0, PHONE_MASK_HEAD)}${PHONE_MASK_FILL}${phone.slice(-PHONE_MASK_TAIL)}`;
}

/**
 * Bản ghi phản ánh trả về cho CÁN BỘ: đủ trường điều hành nhưng số điện thoại
 * công dân luôn ở dạng che (xem chú thích PHONE_MASK_HEAD phía trên).
 */
function toStaffView<T extends { slaDueAt?: Date | null; citizenPhone?: string }>(doc: T) {
  return { ...withSlaHoursLeft(doc), citizenPhone: maskPhone(doc.citizenPhone) };
}

/** Ghi một mốc mới vào timeline; các mốc cũ chuyển sang trạng thái đã xong */
function pushTimeline(fb: FeedbackDocument, title: string, meta: string): void {
  fb.timeline.forEach((step) => {
    step.state = 'ok';
  });
  fb.timeline.push({ title, meta, state: 'cur' });
}

/** dd/MM/yyyy HH:mm — giữ nguyên định dạng hiển thị của FE */
function timeLabel(value: Date): string {
  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const hh = String(value.getHours()).padStart(2, '0');
  const mi = String(value.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${value.getFullYear()} ${hh}:${mi}`;
}

/** Thoát ký tự đặc biệt trước khi ghép vào RegExp tìm kiếm */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
