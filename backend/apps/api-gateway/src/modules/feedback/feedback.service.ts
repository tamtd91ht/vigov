import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  EVENTS,
  Feedback,
  IS_DELETED,
  NOT_DELETED,
  SlaRule,
  markDeleted,
  type FeedbackAssignedEvent,
  type FeedbackCreatedEvent,
  type FeedbackDocument,
  type FeedbackResolvedEvent,
  type SlaRuleDocument,
} from '@vigov/shared';
import { FilesService } from '../files/files.service';
import { NotificationService } from '../notification/notification.service';
import { REALTIME_EVENTS, RealtimeService } from '../realtime/realtime.service';
import {
  AssignFeedbackDto,
  CreateCitizenFeedbackDto,
  CreateStaffFeedbackDto,
  DecideWithdrawDto,
  ListFeedbackQueryDto,
  RateFeedbackDto,
  ResolveFeedbackDto,
  TransferFeedbackDto,
  UpdateCitizenFeedbackDto,
  WithdrawFeedbackDto,
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

/**
 * Hiệu lực link đọc ảnh cấp cho công dân (giây).
 *
 * 1 giờ, dài hơn mặc định 5 phút của kho tệp: người dân mở màn "Phản ánh của
 * tôi" rồi để đó, cuộn lại sau vài chục phút vẫn phải thấy ảnh chứ không phải
 * ô ảnh vỡ. Vẫn ngắn hơn nhiều một phiên đăng nhập, nên link lỡ bị chia sẻ ra
 * ngoài cũng tự hết hiệu lực.
 */
const CITIZEN_IMAGE_URL_TTL_SECONDS = 60 * 60;

/** Trường trả về cho công dân — ẩn thông tin điều hành nội bộ */
const CITIZEN_PROJECTION =
  'code categoryKey title description location lat lng sentAt status slaDueAt imageFileIds resultImageFileIds channel timeline rating ratingComment createdAt updatedAt ' +
  // Mini App cần biết yêu cầu thu hồi đang ở đâu để hiện đúng ghi chú cho người dân.
  // `assignee`/`department` chỉ để TÍNH cờ "đã có người tiếp nhận" — `citizenView`
  // xoá hai trường này trước khi trả ra, chúng là thông tin điều hành nội bộ.
  'withdrawStatus withdrawRequestedAt withdrawReason withdrawDecidedAt withdrawDecisionNote assignee department';

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
    private readonly files: FilesService,
  ) {}

  /**
   * Ảnh gắn vào phiếu phản ánh PHẢI là tệp riêng tư (TB-09).
   *
   * Ảnh hiện trường có thể chứa mặt người, biển số xe, cửa nhà — dữ liệu cá
   * nhân theo NĐ 13/2023. `GET /files/:id` để `@Public()` nên tệp không đánh
   * dấu riêng tư là ai có mã tệp cũng đọc được, không cần đăng nhập.
   */
  private async assertImagesPrivate(fileIds: string[] | undefined, label: string): Promise<void> {
    for (const fileId of fileIds ?? []) {
      await this.files.findPrivateById(fileId, label);
    }
  }

  /**
   * Bản ghi trả cho CÔNG DÂN, kèm link đọc ảnh dùng được ngay.
   *
   * Bản ghi chỉ lưu MÃ tệp, mà ảnh phản ánh đều là tệp riêng tư nên `<img src>`
   * trỏ vào `/files/<id>` sẽ bị từ chối. Trước đây Mini App không có đường nào
   * lấy ảnh về nên vẽ ô màu giữ chỗ — người dân gửi ảnh xong không bao giờ xem
   * lại được chính ảnh mình gửi.
   *
   * Quyền đã được kiểm ngay ở truy vấn (`{ code, citizenPhone }` / `listMine`
   * lọc theo `citizenPhone`), nên ở đây chỉ còn việc ký link — xem chú thích
   * `FilesService.mintSignedUrl` về việc vì sao không đi qua `assertCanSign`.
   */
  private citizenView<
    T extends {
      slaDueAt?: Date | null;
      imageFileIds?: string[];
      resultImageFileIds?: string[];
      status?: string;
      assignee?: string;
      department?: string;
      withdrawStatus?: string;
    },
  >(doc: T) {
    const sign = (ids?: string[]) =>
      (ids ?? []).map((id) => this.files.mintSignedUrl(id, CITIZEN_IMAGE_URL_TTL_SECONDS));

    /*
     * `assignee` và `department` là thông tin điều hành nội bộ — công dân không
     * cần biết phiếu đang nằm trên bàn ai. Nhưng Mini App PHẢI biết phiếu đã có
     * người tiếp nhận chưa, để hiện đúng nút: "Sửa / Thu hồi ngay" hay "Xin thu
     * hồi". Vì vậy rút gọn thành một cờ boolean rồi bỏ hai trường gốc đi.
     */
    const { assignee, department, ...rest } = doc as T & { assignee?: string; department?: string };
    const accepted =
      (doc.status ?? 'received') !== 'received' ||
      Boolean(assignee?.trim()) ||
      Boolean(department?.trim());

    return {
      ...withSlaHoursLeft(rest as T),
      imageUrls: sign(doc.imageFileIds),
      resultImageUrls: sign(doc.resultImageFileIds),
      /** Đã có cán bộ tiếp nhận — Mini App khoá sửa và chuyển sang đường xin thu hồi */
      accepted,
      /** Sửa tiêu đề / nội dung được không (chỉ khi chưa ai tiếp nhận, chưa xin thu hồi) */
      canEdit: !accepted && (doc.withdrawStatus ?? 'none') !== 'pending',
      /** Gỡ được ngay không, hay phải chờ cán bộ duyệt */
      canWithdrawDirectly: !accepted,
    };
  }

  // ---------------------------------------------------------------------------
  // Nhóm nghiệp vụ CÁN BỘ (Web Quản trị)
  // ---------------------------------------------------------------------------

  /** Danh sách phản ánh có lọc + phân trang, kèm số giờ còn lại theo SLA */
  async list(query: ListFeedbackQueryDto) {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    /*
     * Mặc định CHỈ hiện phiếu chưa gỡ. `deleted=true` mở bộ lọc "đã gỡ" để cán bộ
     * tra lại phiếu công dân đã thu hồi — phiếu vẫn là tài liệu hành chính, chỉ
     * không còn nằm trong hàng đợi xử lý.
     */
    const filter: FilterQuery<FeedbackDocument> = query.deleted ? IS_DELETED : { ...NOT_DELETED };
    if (query.categoryKey) filter.categoryKey = query.categoryKey;
    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.assignee) filter.assignee = query.assignee;
    if (query.withdrawStatus) filter.withdrawStatus = query.withdrawStatus;
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
    const inMonth: FilterQuery<FeedbackDocument> = {
      ...NOT_DELETED,
      createdAt: { $gte: from, $lt: to },
    };

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
    const doc = await this.feedbackModel.findOne({ code, ...NOT_DELETED }).lean().exec();
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
    /*
     * Ảnh nghiệm thu cũng phải là tệp riêng tư, y như ảnh hiện trường: "đã tháo
     * biển quảng cáo nhà số 12" là ảnh của một căn nhà cụ thể, không phải ảnh vô
     * danh của hạ tầng công. Công dân vẫn xem được vì `citizenView` tự cấp link
     * ký sẵn cho phiếu của chính họ — không tệp nào cần để công khai.
     */
    await this.assertImagesPrivate(dto.resultImageFileIds, 'Ảnh nghiệm thu');

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

  /**
   * Cán bộ lập phiếu hộ người dân đến trình bày TRỰC TIẾP tại xã (WBS #6).
   *
   * Ba điểm khác luồng công dân tự gửi, đều có lý do:
   *   · KHÔNG chạy `assertNotSpamming` — hạn mức 5 phiếu/ngày là để chặn công
   *     dân spam qua app. Đếm theo số điện thoại người dân ở đây thì một hộ
   *     đến trình bày nhiều vụ việc trong ngày sẽ bị chặn oan, mà thao tác lại
   *     do cán bộ thực hiện tại trụ sở nên đã có người chịu trách nhiệm.
   *   · `channel: 'web'` — phiếu vào hệ thống từ Web Quản trị, không qua thiết
   *     bị của người dân. Việc "ai lập phiếu" nằm ở `source`, không ở `channel`.
   *   · Không gửi thông báo cho công dân — người dân đang đứng tại quầy, và có
   *     thể không để lại số điện thoại để nhắn ZNS.
   *
   * SLA và hạn xử lý dùng CHUNG `resolveSla` với luồng công dân gửi, mã phiếu
   * dùng chung `createWithUniqueCode`, nên hai đường vào không thể lệch nhau.
   */
  async createByStaff(dto: CreateStaffFeedbackDto, actor: string) {
    // Ảnh hiện trường do cán bộ chụp hộ dân cũng phải là tệp riêng tư (TB-09)
    await this.assertImagesPrivate(dto.imageFileIds, 'Ảnh hiện trường');

    const { resolveDays, sentAt, slaDueAt } = await this.resolveSla(dto.categoryKey);

    const payload = buildNewFeedbackPayload({
      categoryKey: dto.categoryKey,
      title: dto.title,
      description: dto.description,
      location: dto.location,
      sentAt,
      slaDueAt,
      imageFileIds: dto.imageFileIds,
      citizenPhone: dto.citizenPhone ?? '',
      citizenName: dto.citizenName ?? '',
      area: dto.area ?? '',
      channel: 'web',
      source: 'offline',
      openingStep: {
        title: 'Cán bộ tiếp nhận trực tiếp tại xã',
        // Ghi rõ ai LẬP phiếu và ai là người trình bày — hai người khác nhau
        meta: [timeLabel(sentAt), `Cán bộ lập: ${actor}`, citizenLabel(dto.citizenName)]
          .filter(Boolean)
          .join(' · '),
      },
    });

    const created = await this.createWithUniqueCode(payload, sentAt.getFullYear());

    const event: FeedbackCreatedEvent = {
      feedbackId: String(created._id),
      code: created.code,
      citizenPhone: created.citizenPhone,
      categoryKey: created.categoryKey,
      slaHours: resolveDays * 24,
    };
    this.logger.log(
      `${EVENTS.FEEDBACK_CREATED}: ${event.code} (${event.categoryKey}) — lập trực tiếp bởi ${actor}`,
    );

    // Cán bộ khác đang mở danh sách phải thấy phiếu mới ngay (P5-05)
    this.emitChanged('created', created);

    return toStaffView(created.toObject());
  }

  // ---------------------------------------------------------------------------
  // Nhóm nghiệp vụ CÔNG DÂN (Zalo Mini App)
  // ---------------------------------------------------------------------------

  /** Công dân gửi phản ánh mới */
  async createByCitizen(dto: CreateCitizenFeedbackDto, citizenPhone: string, citizenName: string) {
    await this.assertNotSpamming(citizenPhone);
    // Ảnh hiện trường công dân gửi kèm phải là tệp riêng tư (TB-09)
    await this.assertImagesPrivate(dto.imageFileIds, 'Ảnh hiện trường');

    const { resolveDays, sentAt, slaDueAt } = await this.resolveSla(dto.categoryKey);
    const channel = dto.channel ?? 'app';

    const payload = {
      ...buildNewFeedbackPayload({
        categoryKey: dto.categoryKey,
        title: dto.title,
        description: dto.description,
        location: dto.location ?? '',
        sentAt,
        slaDueAt,
        imageFileIds: dto.imageFileIds,
        citizenPhone,
        citizenName: dto.citizenName ?? citizenName,
        channel,
        source: 'app',
        openingStep: {
          title: 'Công dân gửi phản ánh',
          meta: `${timeLabel(sentAt)} · ${CHANNEL_LABELS[channel] ?? channel}`,
        },
      }),
      lat: dto.lat,
      lng: dto.lng,
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

    return this.citizenView(created.toObject());
  }

  /** Danh sách phản ánh của chính công dân đang đăng nhập */
  async listMine(citizenPhone: string, query: ListFeedbackQueryDto) {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const filter: FilterQuery<FeedbackDocument> = { citizenPhone, ...NOT_DELETED };
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

    return { items: items.map((item) => this.citizenView(item)), total, page, limit };
  }

  /** Chi tiết phiếu của chính công dân — không phải của mình thì coi như không tồn tại */
  async detailMine(code: string, citizenPhone: string) {
    const doc = await this.feedbackModel
      .findOne({ code, citizenPhone, ...NOT_DELETED })
      .select(CITIZEN_PROJECTION)
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    return this.citizenView(doc);
  }

  /** Công dân đánh giá 1–5 sao, chỉ mở khi phiếu đã xử lý xong */
  async rateMine(code: string, citizenPhone: string, dto: RateFeedbackDto) {
    const fb = await this.findOwnActive(code, citizenPhone);
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

  /**
   * Sửa tiêu đề / mô tả phiếu của chính công dân — CHỈ khi chưa ai tiếp nhận.
   *
   * Mở cửa sổ sửa sau khi đã có cán bộ tiếp nhận là cho phép đổi nội dung dưới
   * chân người đang xử lý: cán bộ đọc một đằng, phiếu ghi một nẻo, và bản ghi
   * mất giá trị đối chứng. Vì vậy điều kiện giống hệt điều kiện gỡ thẳng.
   *
   * Mọi lần sửa đều ghi timeline — phiếu phản ánh là tài liệu hành chính, nội
   * dung đổi lúc nào và đổi những trường nào phải truy được.
   */
  async updateMine(code: string, citizenPhone: string, dto: UpdateCitizenFeedbackDto) {
    const fb = await this.findOwnActive(code, citizenPhone);
    this.assertNotAccepted(fb, 'sửa');

    const changed: string[] = [];
    if (dto.title !== undefined && dto.title !== fb.title) {
      fb.title = dto.title;
      changed.push('tiêu đề');
    }
    if (dto.description !== undefined && dto.description !== fb.description) {
      fb.description = dto.description;
      changed.push('nội dung');
    }
    if (changed.length === 0) return this.citizenView(fb.toObject());

    pushTimeline(
      fb,
      `Công dân sửa ${changed.join(' và ')}`,
      timeLabel(new Date()),
    );
    await fb.save();
    return this.citizenView(fb.toObject());
  }

  /**
   * Công dân xin thu hồi phiếu của chính mình.
   *
   * Hai đường, quyết định bởi phiếu ĐÃ có người tiếp nhận hay chưa:
   *
   *   • CHƯA ai tiếp nhận → gỡ ngay. Chưa cán bộ nào bỏ công vào phiếu, giữ lại
   *     chỉ làm nhiễu hàng đợi tiếp nhận.
   *   • ĐÃ có người tiếp nhận → chuyển `pending`, chờ cán bộ có quyền duyệt.
   *     Đã có người bỏ công xác minh, và phiếu có thể đang là căn cứ cho một
   *     nhiệm vụ đã giao — người dân không được đơn phương rút.
   *
   * "Gỡ" ở đây là XOÁ MỀM, không phải xoá cứng: phiếu phản ánh là tài liệu hành
   * chính có thời hạn lưu theo quy định. Người dân không còn thấy phiếu, cán bộ
   * vẫn tra được ở bộ lọc "đã gỡ", và nhật ký giữ nguyên.
   */
  async requestWithdraw(code: string, citizenPhone: string, dto: WithdrawFeedbackDto) {
    const fb = await this.findOwnActive(code, citizenPhone);

    if (fb.withdrawStatus === 'pending') {
      throw new HttpException(
        'Yêu cầu thu hồi của phiếu này đang chờ cán bộ xác nhận',
        HttpStatus.CONFLICT,
      );
    }

    const reason = dto.reason?.trim() ?? '';
    const now = new Date();
    fb.withdrawReason = reason;
    fb.withdrawRequestedAt = now;
    const reasonSuffix = reason ? ` · Lý do: ${reason}` : '';

    // Chưa ai tiếp nhận → gỡ ngay, không cần cán bộ duyệt
    if (!this.isAccepted(fb)) {
      fb.withdrawStatus = 'approved';
      fb.withdrawDecidedAt = now;
      pushTimeline(fb, 'Công dân thu hồi phản ánh', `${timeLabel(now)}${reasonSuffix}`);
      markDeleted(fb, citizenPhone, reason || 'Công dân tự thu hồi khi chưa có người tiếp nhận');
      await fb.save();
      this.emitChanged('withdrawn', fb);
      return { code: fb.code, removed: true, withdrawStatus: fb.withdrawStatus };
    }

    // Đã có người tiếp nhận → chờ cán bộ xác nhận
    fb.withdrawStatus = 'pending';
    pushTimeline(
      fb,
      'Công dân xin thu hồi phản ánh — chờ cán bộ xác nhận',
      `${timeLabel(now)}${reasonSuffix}`,
    );
    await fb.save();
    this.emitChanged('withdraw-requested', fb);
    return { code: fb.code, removed: false, withdrawStatus: fb.withdrawStatus };
  }

  /** Cán bộ ĐỒNG Ý thu hồi — phiếu được gỡ khỏi màn hình người dân (xoá mềm) */
  async approveWithdraw(code: string, dto: DecideWithdrawDto, actor: string) {
    const fb = await this.findPendingWithdraw(code);
    const note = dto.note?.trim() ?? '';
    const now = new Date();

    fb.withdrawStatus = 'approved';
    fb.withdrawDecidedAt = now;
    fb.withdrawDecidedBy = actor;
    fb.withdrawDecisionNote = note;
    pushTimeline(
      fb,
      'Cán bộ đồng ý thu hồi — phiếu đã gỡ',
      `${timeLabel(now)} · ${actor}${note ? ` · ${note}` : ''}`,
    );
    markDeleted(fb, actor, fb.withdrawReason || 'Công dân xin thu hồi, cán bộ đồng ý');
    await fb.save();

    this.emitChanged('withdrawn', fb);
    return { code: fb.code, withdrawStatus: fb.withdrawStatus, removed: true };
  }

  /**
   * Cán bộ TỪ CHỐI thu hồi — phiếu quay lại xử lý bình thường.
   *
   * `note` bắt buộc ở DTO: người dân phải đọc được vì sao đơn của mình không
   * được gỡ, nếu không họ chỉ thấy yêu cầu im lặng biến mất rồi gửi lại.
   */
  async rejectWithdraw(code: string, dto: DecideWithdrawDto, actor: string) {
    const fb = await this.findPendingWithdraw(code);
    const note = (dto.note ?? '').trim();
    const now = new Date();

    fb.withdrawStatus = 'rejected';
    fb.withdrawDecidedAt = now;
    fb.withdrawDecidedBy = actor;
    fb.withdrawDecisionNote = note;
    pushTimeline(fb, 'Cán bộ từ chối thu hồi', `${timeLabel(now)} · ${actor} · ${note}`);
    await fb.save();

    this.emitChanged('withdraw-rejected', fb);
    return { code: fb.code, withdrawStatus: fb.withdrawStatus, removed: false };
  }

  // ---------------------------------------------------------------------------
  // Hỗ trợ nội bộ
  // ---------------------------------------------------------------------------

  /**
   * Phiếu ĐÃ có người tiếp nhận hay chưa.
   *
   * "Chưa ai tiếp nhận" = còn nguyên trạng thái `received` VÀ chưa phân công ai.
   * Kiểm cả hai chứ không riêng trạng thái: `assign()` có nhánh giữ nguyên
   * `received` khi phiếu được giao mà chưa ai bắt tay làm, nên chỉ nhìn trạng
   * thái sẽ cho người dân gỡ mất phiếu đã nằm trên bàn một cán bộ.
   */
  private isAccepted(fb: FeedbackDocument): boolean {
    return fb.status !== 'received' || Boolean(fb.assignee?.trim()) || Boolean(fb.department?.trim());
  }

  /** Chặn thao tác chỉ dành cho phiếu chưa ai tiếp nhận, kèm lời giải thích cho dân */
  private assertNotAccepted(fb: FeedbackDocument, action: string): void {
    if (this.isAccepted(fb)) {
      throw new HttpException(
        `Phản ánh đã có cán bộ tiếp nhận nên không ${action} trực tiếp được. ` +
          'Quý vị có thể gửi yêu cầu thu hồi để cán bộ xem xét.',
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Phiếu của chính công dân và CHƯA bị gỡ — không thoả thì coi như không tồn tại */
  private async findOwnActive(code: string, citizenPhone: string): Promise<FeedbackDocument> {
    const fb = await this.feedbackModel.findOne({ code, citizenPhone, ...NOT_DELETED }).exec();
    if (!fb) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    return fb;
  }

  /** Phiếu đang chờ duyệt thu hồi — dùng cho hai đường quyết định của cán bộ */
  private async findPendingWithdraw(code: string): Promise<FeedbackDocument> {
    const fb = await this.feedbackModel.findOne({ code, ...NOT_DELETED }).exec();
    if (!fb) throw new NotFoundException(`Không tìm thấy phiếu phản ánh ${code}`);
    if (fb.withdrawStatus !== 'pending') {
      throw new HttpException(
        'Phiếu này không có yêu cầu thu hồi nào đang chờ xác nhận',
        HttpStatus.CONFLICT,
      );
    }
    return fb;
  }

  /**
   * Phát tín hiệu "phiếu phản ánh vừa đổi" qua Socket.IO (P5-05).
   *
   * Chỉ gửi {type, code, status, at} — client nhận rồi tự gọi lại API để lấy bản ghi
   * đã lọc theo quyền, nhờ vậy không rò rỉ SĐT công dân qua kênh WebSocket.
   * RealtimeService nuốt mọi lỗi nên lời gọi này không thể làm hỏng nghiệp vụ.
   */
  private emitChanged(
    type:
      | 'created'
      | 'assigned'
      | 'resolved'
      | 'withdraw-requested'
      | 'withdraw-rejected'
      | 'withdrawn',
    fb: FeedbackDocument,
  ): void {
    this.realtime.emitChange(
      REALTIME_EVENTS.FEEDBACK_CHANGED,
      { type, code: fb.code, status: fb.status, at: new Date().toISOString() },
      { department: fb.department, user: fb.assignee },
    );
  }

  /**
   * Hạn xử lý theo lĩnh vực — DÙNG CHUNG cho cả hai đường tạo phiếu.
   *
   * Tách ra để luồng công dân tự gửi và luồng cán bộ lập hộ không thể tính SLA
   * khác nhau: nhân bản mấy dòng này là mở đường cho hai con số hạn xử lý của
   * cùng một lĩnh vực, và sai lệch đó chỉ lộ ra khi đối chiếu báo cáo đúng hạn.
   */
  private async resolveSla(categoryKey: string): Promise<{ resolveDays: number; sentAt: Date; slaDueAt: Date }> {
    const sla = await this.slaRuleModel.findOne({ categoryKey }).lean().exec();
    const resolveDays = sla?.resolveDays ?? DEFAULT_RESOLVE_DAYS;
    const sentAt = new Date();
    return { resolveDays, sentAt, slaDueAt: addResolveDays(sentAt, resolveDays) };
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

/** Nhãn người dân trình bày cho nhật ký; bỏ trống khi không ghi được tên */
function citizenLabel(citizenName: string | undefined): string | undefined {
  const name = citizenName?.trim();
  return name ? `Người dân: ${name}` : undefined;
}

/** Tham số dựng bản ghi phiếu mới — chung cho cả hai đường tạo phiếu */
interface NewFeedbackInput {
  categoryKey: string;
  title: string;
  description: string;
  location: string;
  sentAt: Date;
  slaDueAt: Date;
  imageFileIds?: string[];
  citizenPhone: string;
  citizenName: string;
  area?: string;
  channel: string;
  source: 'app' | 'offline';
  /** Mốc đầu tiên của nhật ký — nói AI đã đưa phiếu vào hệ thống */
  openingStep: { title: string; meta: string };
}

/**
 * Bản ghi phiếu ở trạng thái vừa tiếp nhận.
 *
 * Một hàm duy nhất cho cả hai đường vào để những thứ dễ quên — `status`,
 * `sentAt` dạng chuỗi hiển thị, `rating: 0`, mốc "chờ phân công" kèm hạn SLA —
 * luôn có mặt và giống hệt nhau ở cả hai luồng.
 */
function buildNewFeedbackPayload(input: NewFeedbackInput): Record<string, unknown> {
  return {
    categoryKey: input.categoryKey,
    title: input.title,
    description: input.description,
    location: input.location,
    sentAt: timeLabel(input.sentAt),
    status: 'received',
    slaDueAt: input.slaDueAt,
    imageFileIds: input.imageFileIds ?? [],
    resultImageFileIds: [],
    citizenPhone: input.citizenPhone,
    citizenName: input.citizenName,
    area: input.area ?? '',
    channel: input.channel,
    source: input.source,
    assignee: '',
    department: '',
    rating: 0,
    timeline: [
      { title: input.openingStep.title, meta: input.openingStep.meta, state: 'ok' },
      {
        title: 'Chờ tiếp nhận & phân công',
        meta: `Hạn xử lý theo SLA: ${timeLabel(input.slaDueAt)}`,
        state: 'cur',
      },
    ],
  };
}

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
