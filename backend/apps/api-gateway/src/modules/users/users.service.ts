import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  BlacklistRecord,
  type BlacklistRecordDocument,
  CitizenUser,
  type CitizenUserDocument,
  LoginSession,
  type LoginSessionDocument,
  SessionRegistry,
  StaffUser,
  type StaffUserDocument,
  findRole,
} from '@vigov/shared';
import {
  ChangeStaffPasswordDto,
  CreateBlacklistDto,
  CreateStaffDto,
  ListBlacklistQueryDto,
  ListCitizensQueryDto,
  ListSessionsQueryDto,
  UpdateStaffDto,
} from './dto/users.dto';

/** Phân trang mặc định của danh sách công dân */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
/** Số bản ghi tối đa trả về cho các danh sách không phân trang (phiên, blacklist, cán bộ) */
const LIST_HARD_LIMIT = 200;

/** Cấu hình che số điện thoại: giữ 3 số đầu + 3 số cuối */
const PHONE_MASK_HEAD = 3;
const PHONE_MASK_TAIL = 3;
const PHONE_MASK_FILL = '•••';

/**
 * Số điện thoại di động Việt Nam: 10 chữ số bắt đầu bằng 0.
 * Dùng để chỉ che ĐÚNG giá trị là số điện thoại — `subject` của phiên đăng nhập
 * có thể là username cán bộ (phiên web), che nhầm sẽ ra chuỗi hỏng "Thắ•••yễn".
 */
const PHONE_PATTERN = /^0\d{9}$/;

/**
 * Số điện thoại NẰM LẪN trong một chuỗi mô tả, ví dụ subject của bản ghi chặn
 * dạng "Cường Đỗ · 0941234671". Dữ liệu cũ trong CSDL có kiểu này nên phải che
 * ở tầng API, nếu không là lộ SĐT thật ra ngoài.
 */
const EMBEDDED_PHONE_PATTERN = /(?<!\d)0\d{9}(?!\d)/g;

/** Kênh đăng nhập của công dân (phiên 'web' là của cán bộ) */
const CITIZEN_SESSION_KINDS = ['app', 'zalo'];

/**
 * Cửa sổ tính "công dân hoạt động gần đây" cho thẻ thống kê.
 * Mặc định 30 ngày, có thể chỉnh bằng biến môi trường CITIZEN_ACTIVE_WINDOW_DAYS.
 */
const DEFAULT_ACTIVE_WINDOW_DAYS = 30;
const ACTIVE_WINDOW_ENV_KEY = 'CITIZEN_ACTIVE_WINDOW_DAYS';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Sinh mật khẩu tạm */
const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const BCRYPT_ROUNDS = 10;

/** Khoá vai trò quản trị — không được xoá tài khoản quản trị hoạt động cuối cùng */
const ADMIN_ROLE_KEY = 'admin';

/** Bảng màu avatar cán bộ — đồng bộ biến CSS của admin-web */
const AVATAR_COLORS = ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--purple)', 'var(--teal)', 'var(--pink)'];

@Injectable()
export class UsersService {
  /** Ngưỡng "hoạt động gần đây" (ngày) — đọc qua ConfigService, không hardcode tại chỗ dùng */
  private readonly activeWindowDays: number;

  constructor(
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(LoginSession.name) private readonly sessionModel: Model<LoginSessionDocument>,
    @InjectModel(BlacklistRecord.name) private readonly blacklistModel: Model<BlacklistRecordDocument>,
    private readonly config: ConfigService,
    private readonly sessions: SessionRegistry,
  ) {
    const configured = Number(this.config.get<string | number>(ACTIVE_WINDOW_ENV_KEY, DEFAULT_ACTIVE_WINDOW_DAYS));
    this.activeWindowDays = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_ACTIVE_WINDOW_DAYS;
  }

  // ─── Tiện ích ────────────────────────────────────────────────────────────

  /**
   * Che số điện thoại trước khi trả ra API: "0987654321" → "098•••321".
   * Web Quản trị chỉ hiển thị bản che; số đầy đủ (nếu cần liên hệ) là câu hỏi
   * mở #15 — chờ khách xác nhận vai trò nào được xem số thật.
   */
  maskPhone(phone: string): string {
    if (!phone) return '';
    if (phone.length <= PHONE_MASK_HEAD + PHONE_MASK_TAIL) return phone;
    return `${phone.slice(0, PHONE_MASK_HEAD)}${PHONE_MASK_FILL}${phone.slice(-PHONE_MASK_TAIL)}`;
  }

  /**
   * Chỉ che khi giá trị ĐÚNG là số điện thoại.
   * `subject` của phiên/bản ghi chặn có thể là username cán bộ, mã thiết bị hay IP —
   * những giá trị đó phải giữ nguyên, che nhầm sẽ hỏng dữ liệu hiển thị.
   */
  private maskIfPhone(value: string): string {
    return PHONE_PATTERN.test(value ?? '') ? this.maskPhone(value) : value;
  }

  /** Che mọi số điện thoại xuất hiện bên trong chuỗi, giữ nguyên phần chữ còn lại */
  private maskPhonesInText(value: string): string {
    if (!value) return '';
    return value.replace(EMBEDDED_PHONE_PATTERN, (phone) => this.maskPhone(phone));
  }

  /**
   * Chuẩn hoá bản ghi công dân trả ra API (số điện thoại luôn ở dạng che).
   * `id` là khoá duy nhất Web Quản trị dùng được để thao tác tiếp (xem chi tiết,
   * khoá/mở khoá) vì SĐT trả ra đã bị che nên không tra ngược được.
   */
  private toCitizenView(doc: CitizenUserDocument, lastActiveAt?: Date) {
    return {
      id: String(doc._id),
      phone: this.maskPhone(doc.phone),
      displayName: doc.displayName,
      area: doc.area,
      channel: doc.channel,
      feedbackCount: doc.feedbackCount,
      status: doc.status,
      lockReason: doc.lockReason,
      // Ngày đăng ký — do `timestamps: true` của CitizenUserSchema tự gán
      createdAt: doc.get('createdAt') as Date | undefined,
      // Lần hoạt động gần nhất — suy từ phiên đăng nhập, chỉ có khi tra được
      lastActiveAt: lastActiveAt ?? (doc.get('lastActiveAt') as Date | undefined),
    };
  }

  /**
   * Lần đăng nhập gần nhất của từng số điện thoại (một truy vấn gộp cho cả trang).
   * Bảng công dân không lưu mốc hoạt động nên phải lấy từ `login_sessions`.
   */
  private async lastActiveByPhone(phones: string[]): Promise<Map<string, Date>> {
    if (phones.length === 0) return new Map();
    const rows = await this.sessionModel
      .aggregate<{ _id: string; lastActiveAt: Date }>([
        { $match: { subject: { $in: phones }, kind: { $in: CITIZEN_SESSION_KINDS } } },
        { $group: { _id: '$subject', lastActiveAt: { $max: '$lastActiveAt' } } },
      ])
      .exec();
    return new Map(rows.map((r) => [r._id, r.lastActiveAt]));
  }

  /** Chuẩn hoá bản ghi cán bộ — KHÔNG bao giờ kèm passwordHash */
  private toStaffView(doc: StaffUserDocument) {
    return {
      id: String(doc._id),
      username: doc.username,
      displayName: doc.displayName,
      initials: doc.initials,
      color: doc.color,
      department: doc.department,
      roleKey: doc.roleKey,
      roleLabel: findRole(doc.roleKey)?.label ?? doc.roleKey,
      status: doc.status,
      lastLoginAt: doc.lastLoginAt,
    };
  }

  /** Escape ký tự đặc biệt để dùng từ khoá người dùng nhập trong $regex */
  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Kiểm tra ObjectId hợp lệ trước khi truy vấn để tránh lỗi cast */
  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã bản ghi không hợp lệ');
    }
  }

  /** Viết tắt họ tên: "Nguyễn Văn A" → "NA" */
  private initialsOf(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  /** Mật khẩu tạm ngẫu nhiên — chỉ trả về đúng một lần lúc tạo tài khoản */
  private generateTempPassword(): string {
    let out = '';
    for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) {
      out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
    }
    return out;
  }

  // ─── Công dân ────────────────────────────────────────────────────────────

  /** Danh sách công dân có lọc + phân trang; số điện thoại trả ra ở dạng che */
  async listCitizens(query: ListCitizensQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const filter: FilterQuery<CitizenUserDocument> = {};
    if (query.area) filter.area = query.area;
    if (query.status) filter.status = query.status;
    if (query.q) {
      const rx = new RegExp(this.escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ phone: rx }, { displayName: rx }];
    }

    const [items, total] = await Promise.all([
      this.citizenModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.citizenModel.countDocuments(filter).exec(),
    ]);

    const lastActive = await this.lastActiveByPhone(items.map((doc) => doc.phone));
    return {
      items: items.map((doc) => this.toCitizenView(doc, lastActive.get(doc.phone))),
      total,
      page,
      limit,
    };
  }

  /**
   * Thống kê nhanh cho trang Người dùng.
   * `activeLast30Days` đếm số công dân có phiên đăng nhập app/zalo trong cửa sổ
   * cấu hình (mặc định 30 ngày) — đếm theo `login_sessions` vì bảng công dân
   * không lưu mốc hoạt động.
   */
  async citizenStats() {
    const since = new Date(Date.now() - this.activeWindowDays * MS_PER_DAY);
    const [total, locked, activeSubjects] = await Promise.all([
      this.citizenModel.countDocuments().exec(),
      this.citizenModel.countDocuments({ status: 'locked' }).exec(),
      this.sessionModel
        .distinct('subject', { kind: { $in: CITIZEN_SESSION_KINDS }, lastActiveAt: { $gte: since } })
        .exec(),
    ]);
    return {
      total,
      activeLast30Days: activeSubjects.length,
      locked,
      /** Trả kèm cửa sổ thực tế đang áp dụng để giao diện hiển thị đúng nhãn */
      windowDays: this.activeWindowDays,
    };
  }

  /** Chi tiết một công dân theo số điện thoại thật (tham số đường dẫn) */
  async getCitizen(phone: string) {
    return this.findCitizenView({ phone });
  }

  /**
   * Chi tiết công dân theo `id` (_id dạng chuỗi).
   * Danh sách chỉ trả SĐT ĐÃ CHE nên Web Quản trị không có SĐT thật để tra —
   * `id` là khoá thao tác chính, route theo `:phone` giữ lại cho tương thích cũ.
   */
  async getCitizenById(id: string) {
    this.assertObjectId(id);
    return this.findCitizenView({ _id: new Types.ObjectId(id) });
  }

  /** Tra một công dân theo bộ lọc bất kỳ rồi chuẩn hoá kèm mốc hoạt động gần nhất */
  private async findCitizenView(filter: FilterQuery<CitizenUserDocument>) {
    const doc = await this.citizenModel.findOne(filter).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy tài khoản công dân');
    const lastActive = await this.lastActiveByPhone([doc.phone]);
    return this.toCitizenView(doc, lastActive.get(doc.phone));
  }

  /**
   * Khoá tài khoản công dân: đặt status = 'locked' và tạo bản ghi chặn kind 'citizen'.
   * Quyền khoá/mở trực tiếp hiện gắn với `users:edit`; khách hàng có thể muốn
   * tách riêng cho lãnh đạo — chờ xác nhận (câu hỏi mở #15).
   */
  async lockCitizen(phone: string, reason: string, actor: string) {
    return this.lockCitizenBy({ phone }, reason, actor);
  }

  /** Khoá công dân theo `id` — dùng cho Web Quản trị (chỉ biết SĐT đã che) */
  async lockCitizenById(id: string, reason: string, actor: string) {
    this.assertObjectId(id);
    return this.lockCitizenBy({ _id: new Types.ObjectId(id) }, reason, actor);
  }

  /** Mở khoá công dân: bỏ trạng thái khoá và gỡ hiệu lực các bản ghi chặn tương ứng */
  async unlockCitizen(phone: string, actor: string) {
    return this.unlockCitizenBy({ phone }, actor);
  }

  /** Mở khoá công dân theo `id` — dùng cho Web Quản trị (chỉ biết SĐT đã che) */
  async unlockCitizenById(id: string, actor: string) {
    this.assertObjectId(id);
    return this.unlockCitizenBy({ _id: new Types.ObjectId(id) }, actor);
  }

  /** Thân chung của khoá tài khoản — bộ lọc có thể theo SĐT thật hoặc theo _id */
  private async lockCitizenBy(filter: FilterQuery<CitizenUserDocument>, reason: string, actor: string) {
    // Khoá tài khoản phải làm token đang lưu mất hiệu lực ngay (P5-08)
    this.sessions.invalidateAll();
    const doc = await this.citizenModel
      .findOneAndUpdate(filter, { $set: { status: 'locked', lockReason: reason } }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy tài khoản công dân');

    // Bản ghi chặn luôn lưu SĐT thật lấy từ tài liệu, không lấy từ tham số đường dẫn
    await this.blacklistModel.create({ subject: doc.phone, kind: 'citizen', reason, by: actor, active: true });
    return this.toCitizenView(doc);
  }

  /** Thân chung của mở khoá tài khoản */
  private async unlockCitizenBy(filter: FilterQuery<CitizenUserDocument>, actor: string) {
    const doc = await this.citizenModel
      .findOneAndUpdate(filter, { $set: { status: 'active' }, $unset: { lockReason: '' } }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy tài khoản công dân');

    void actor; // người thực hiện đã được AuditInterceptor ghi vết
    await this.blacklistModel
      .updateMany({ subject: doc.phone, kind: 'citizen', active: true }, { $set: { active: false } })
      .exec();
    return this.toCitizenView(doc);
  }

  // ─── Phiên đăng nhập ─────────────────────────────────────────────────────

  /**
   * Danh sách phiên đang hoạt động, lọc theo kênh web/app/zalo.
   * `currentSubject` là tài khoản đang gọi API: phiên MỚI NHẤT của tài khoản đó
   * được gắn cờ `current` để giao diện hiển thị chip "Phiên hiện tại"
   * (Phase 1 JWT chưa mang mã phiên nên phải suy theo subject + thời điểm).
   */
  async listSessions(query: ListSessionsQueryDto, currentSubject?: string) {
    const filter: FilterQuery<LoginSessionDocument> = { revoked: false };
    if (query.kind) filter.kind = query.kind;

    const items = await this.sessionModel.find(filter).sort({ lastActiveAt: -1 }).limit(LIST_HARD_LIMIT).exec();
    // Đã sắp xếp lastActiveAt giảm dần nên phần tử khớp đầu tiên là phiên mới nhất
    const currentIndex = currentSubject ? items.findIndex((doc) => doc.subject === currentSubject) : -1;

    return {
      items: items.map((doc, index) => ({
        id: String(doc._id),
        // Phiên app/zalo có subject là SĐT → che; phiên web là username cán bộ → giữ nguyên
        subject: this.maskIfPhone(doc.subject),
        kind: doc.kind,
        device: doc.device,
        ip: doc.ip,
        startedAt: doc.startedAt,
        lastActiveAt: doc.lastActiveAt,
        current: index === currentIndex,
      })),
      total: items.length,
    };
  }

  /** Thu hồi một phiên đăng nhập cụ thể */
  async revokeSession(id: string) {
    this.assertObjectId(id);
    const doc = await this.sessionModel.findByIdAndUpdate(id, { $set: { revoked: true } }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy phiên đăng nhập');
    // Xoá kết quả đã nhớ để token của phiên này mất hiệu lực ngay lập tức (P5-08)
    this.sessions.invalidate(String(doc._id));
    return { id: String(doc._id), revoked: doc.revoked };
  }

  /**
   * Thu hồi mọi phiên KHÁC của chính người đang đăng nhập.
   * Phase 1 JWT chưa mang mã phiên, nên client có thể truyền `except` để giữ lại
   * phiên hiện tại; không truyền thì thu hồi toàn bộ phiên của tài khoản.
   */
  async revokeOtherSessions(subject: string, exceptId?: string) {
    const filter: FilterQuery<LoginSessionDocument> = { subject, revoked: false };
    if (exceptId && Types.ObjectId.isValid(exceptId)) {
      filter._id = { $ne: new Types.ObjectId(exceptId) };
    }
    const result = await this.sessionModel.updateMany(filter, { $set: { revoked: true } }).exec();
    this.sessions.invalidateAll();
    return { revoked: result.modifiedCount };
  }

  // ─── Danh sách chặn ──────────────────────────────────────────────────────

  /**
   * Danh sách chặn. Phase 1 mở cho `users:view`; việc giới hạn chỉ quản trị viên
   * được xem danh sách này đang chờ khách xác nhận (câu hỏi mở #15).
   */
  async listBlacklist(query: ListBlacklistQueryDto) {
    const filter: FilterQuery<BlacklistRecordDocument> = {};
    if (query.active !== undefined) filter.active = query.active === 'true';
    if (query.kind) filter.kind = query.kind;

    const items = await this.blacklistModel.find(filter).sort({ createdAt: -1 }).limit(LIST_HARD_LIMIT).exec();
    return {
      items: items.map((doc) => ({
        id: String(doc._id),
        // Đối tượng bị chặn là công dân → subject chứa số điện thoại, phải che.
        // Mã thiết bị / IP không khớp mẫu SĐT nên được giữ nguyên.
        subject: this.maskPhonesInText(doc.subject),
        kind: doc.kind,
        reason: doc.reason,
        by: doc.by,
        active: doc.active,
        // Thời điểm lập bản ghi — do `timestamps: true` của BlacklistRecordSchema tự gán
        createdAt: doc.get('createdAt') as Date | undefined,
      })),
      total: items.length,
    };
  }

  /** Thêm bản ghi chặn thủ công */
  async createBlacklist(dto: CreateBlacklistDto, actor: string) {
    const doc = await this.blacklistModel.create({
      subject: dto.subject,
      kind: dto.kind,
      reason: dto.reason,
      by: actor,
      active: true,
    });
    return { id: String(doc._id), subject: doc.subject, kind: doc.kind, reason: doc.reason, active: doc.active };
  }

  /** Gỡ hiệu lực một bản ghi chặn */
  async deactivateBlacklist(id: string) {
    this.assertObjectId(id);
    const doc = await this.blacklistModel.findByIdAndUpdate(id, { $set: { active: false } }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy bản ghi chặn');
    return { id: String(doc._id), active: doc.active };
  }

  // ─── Cán bộ (phục vụ trang Cấu hình) ─────────────────────────────────────

  /** Danh sách tài khoản cán bộ */
  async listStaff() {
    const items = await this.staffModel.find().sort({ department: 1, displayName: 1 }).limit(LIST_HARD_LIMIT).exec();
    return { items: items.map((doc) => this.toStaffView(doc)), total: items.length };
  }

  /** Tạo tài khoản cán bộ; mật khẩu tạm được TRẢ VỀ một lần duy nhất tại đây */
  async createStaff(dto: CreateStaffDto) {
    const existed = await this.staffModel.exists({ username: dto.username }).exec();
    if (existed) throw new ConflictException('Tên đăng nhập đã tồn tại');

    const tempPassword = this.generateTempPassword();
    const doc = await this.staffModel.create({
      username: dto.username,
      passwordHash: await bcrypt.hash(tempPassword, BCRYPT_ROUNDS),
      displayName: dto.displayName,
      initials: this.initialsOf(dto.displayName),
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      department: dto.department,
      roleKey: dto.roleKey,
      status: 'active',
    });

    return { ...this.toStaffView(doc), tempPassword };
  }

  /**
   * Cập nhật vai trò / đơn vị / trạng thái tài khoản cán bộ.
   *
   * Đổi xong PHẢI thu hồi phiên đang mở của người đó.
   *
   * VÌ SAO: JwtAuthGuard đọc `roleKey` thẳng từ payload JWT, không tra lại cơ
   * sở dữ liệu — chỉ có `revoked` và `subjectLocked` được kiểm qua
   * SessionRegistry, còn vai trò thì không. Nếu chỉ ghi vai trò mới xuống
   * Mongo, token đang lưu vẫn mang vai trò CŨ cho tới khi hết hạn 8 giờ. Hạ
   * quyền một tài khoản nghi bị chiếm mà quyền cũ còn sống nguyên 8 tiếng thì
   * thao tác đó gần như vô nghĩa.
   *
   * `deleteStaff` bên dưới đã làm đúng việc này từ đầu; ở đây trước là bỏ sót.
   */
  async updateStaff(username: string, dto: UpdateStaffDto) {
    const patch: Record<string, unknown> = {};
    if (dto.roleKey) patch.roleKey = dto.roleKey;
    if (dto.department) patch.department = dto.department;
    if (dto.status) patch.status = dto.status;
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Không có thông tin nào cần cập nhật');
    }

    const doc = await this.staffModel.findOneAndUpdate({ username }, { $set: patch }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy tài khoản cán bộ');

    await this.revokeAllSessionsOf(username);
    return this.toStaffView(doc);
  }

  /**
   * Thu hồi mọi phiên còn hiệu lực của một tài khoản và xoá bộ nhớ đệm phiên.
   *
   * Phải xoá cache: SessionRegistry nhớ kết quả tra cứu 10 giây, không xoá thì
   * trong 10 giây đó token vừa bị thu hồi vẫn đi lọt.
   *
   * Người bị thu hồi sẽ phải đăng nhập lại — đây là cái giá có chủ ý, đổi lấy
   * việc thay đổi quyền có hiệu lực tức thì.
   */
  private async revokeAllSessionsOf(subject: string): Promise<number> {
    const result = await this.sessionModel
      .updateMany({ subject, revoked: false }, { $set: { revoked: true } })
      .exec();
    this.sessions.invalidateAll();
    return result.modifiedCount;
  }

  /**
   * Xoá tài khoản cán bộ (dọn tài khoản kiểm thử / cán bộ nghỉ việc).
   * Hai lằn ranh an toàn: không cho tự xoá chính mình và không cho xoá tài khoản
   * quản trị ĐANG HOẠT ĐỘNG cuối cùng — mất cả hai thì không ai vào được trang Cấu hình.
   */
  async deleteStaff(username: string, actor: string) {
    if (username === actor) {
      throw new ForbiddenException('Không thể xoá tài khoản của chính mình');
    }

    const doc = await this.staffModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy tài khoản cán bộ');

    if (doc.roleKey === ADMIN_ROLE_KEY && doc.status === 'active') {
      const remaining = await this.staffModel
        .countDocuments({ roleKey: ADMIN_ROLE_KEY, status: 'active', _id: { $ne: doc._id } })
        .exec();
      if (remaining === 0) {
        throw new ForbiddenException('Không thể xoá tài khoản quản trị đang hoạt động cuối cùng');
      }
    }

    await this.staffModel.deleteOne({ _id: doc._id }).exec();
    // Thu hồi luôn phiên đăng nhập còn hiệu lực để tài khoản đã xoá không dùng tiếp token cũ
    await this.revokeAllSessionsOf(username);

    return { username, deleted: true };
  }

  /**
   * Đặt lại mật khẩu cán bộ — chỉ trả về kết quả, không kèm mật khẩu/hash.
   *
   * Thu hồi phiên đi kèm: lý do người ta đặt lại mật khẩu thường là NGHI BỊ LỘ.
   * Đổi mật khẩu mà để nguyên phiên đang mở thì kẻ đang giữ token vẫn dùng tiếp
   * được tới 8 giờ — đúng thứ mà thao tác này định cắt.
   */
  async changeStaffPassword(username: string, dto: ChangeStaffPasswordDto) {
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const doc = await this.staffModel.findOneAndUpdate({ username }, { $set: { passwordHash } }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy tài khoản cán bộ');

    const revoked = await this.revokeAllSessionsOf(username);
    return { username: doc.username, updated: true, revokedSessions: revoked };
  }
}
