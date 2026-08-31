import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CitizenUser, LoginSession, type CitizenUserDocument, type LoginSessionDocument } from '@vigov/shared';
import { AuditService } from '../audit/audit.service';

/**
 * Kết quả xử lý một sự kiện webhook. Zalo chỉ cần biết ta đã nhận;
 * chi tiết dùng cho nhật ký và cho kiểm thử.
 */
export interface ZaloEventOutcome {
  handled: boolean;
  reason: string;
  affected: number;
}

/**
 * Các tên trường Zalo có thể dùng để chỉ người dùng.
 *
 * Hợp đồng webhook của Zalo Mini App CHƯA được xác minh bằng tài liệu chính
 * thức (xem ghi chú ở đầu controller), nên nhận diện theo nhiều tên thay vì
 * đoán đúng một tên rồi âm thầm bỏ qua mọi sự kiện.
 */
const USER_ID_FIELDS = ['user_id', 'userId', 'user_id_by_app', 'zaloUserId', 'sender_id', 'uid'] as const;

/** Tên sự kiện được hiểu là "rút đồng ý / xoá dữ liệu" */
const ERASURE_EVENTS = [
  'user_deauthorize',
  'user_withdraw_consent',
  'user_delete_data',
  'delete_user_data',
  'user_revoke_permission',
] as const;

@Injectable()
export class ZaloWebhookService {
  private readonly logger = new Logger(ZaloWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
    @InjectModel(LoginSession.name) private readonly sessionModel: Model<LoginSessionDocument>,
  ) {}

  /**
   * Kiểm chữ ký của Zalo.
   *
   * FAIL CLOSED: thiếu khoá bí mật hoặc thiếu chữ ký thì TỪ CHỐI. Đây là
   * endpoint xoá dữ liệu công dân — để nó nhận yêu cầu không xác thực là mở
   * sẵn một đường phá dữ liệu cho bất kỳ ai biết URL.
   *
   * Chấp nhận hai cách tính vì tài liệu Zalo dùng cả hai tuỳ loại webhook:
   * HMAC-SHA256 với khoá bí mật, và SHA256 của (appId + body + secret).
   */
  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    const secret = this.config.get<string>('zalo.appSecret') ?? '';
    if (!secret) {
      this.logger.error('Từ chối webhook Zalo: chưa cấu hình ZALO_APP_SECRET');
      return false;
    }
    if (!rawBody || rawBody.length === 0 || !signature) {
      this.logger.warn('Từ chối webhook Zalo: thiếu thân yêu cầu hoặc chữ ký');
      return false;
    }

    const appId = this.config.get<string>('zalo.appId') ?? '';
    const body = rawBody.toString('utf8');

    const candidates = [
      createHmac('sha256', secret).update(rawBody).digest('hex'),
      createHash('sha256').update(`${appId}${body}${secret}`).digest('hex'),
    ];

    // Bỏ tiền tố kiểu "mac=" / "sha256=" nếu Zalo gửi kèm
    const given = signature.includes('=') ? signature.slice(signature.indexOf('=') + 1) : signature;
    return candidates.some((expected) => this.constantTimeEqual(expected, given));
  }

  /** So sánh không lệ thuộc thời gian, tránh rò rỉ chữ ký qua đo thời gian phản hồi */
  private constantTimeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b.trim().toLowerCase(), 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  /** Rút tên sự kiện ra khỏi payload, chấp nhận vài cách đặt tên của Zalo */
  private eventName(payload: Record<string, unknown>): string {
    const raw = payload.event_name ?? payload.event ?? payload.type ?? '';
    return String(raw).trim().toLowerCase();
  }

  /** Rút mã người dùng Zalo ra khỏi payload, kể cả khi nằm trong `data` */
  private zaloUserId(payload: Record<string, unknown>): string {
    const nested = (payload.data ?? payload.sender ?? {}) as Record<string, unknown>;
    for (const field of USER_ID_FIELDS) {
      const value = payload[field] ?? nested[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return '';
  }

  /**
   * Xử lý một sự kiện đã xác thực chữ ký.
   *
   * Chỉ hành động với sự kiện thuộc nhóm xoá dữ liệu. Sự kiện lạ được ghi nhật
   * ký rồi bỏ qua — Zalo có thể thêm loại sự kiện mới, và ném lỗi ở đây sẽ làm
   * Zalo gửi lại liên tục.
   */
  async handle(payload: Record<string, unknown>, ip: string): Promise<ZaloEventOutcome> {
    const event = this.eventName(payload);
    const userId = this.zaloUserId(payload);

    if (!ERASURE_EVENTS.includes(event as (typeof ERASURE_EVENTS)[number])) {
      this.logger.log(`Bỏ qua sự kiện Zalo không thuộc nhóm xoá dữ liệu: "${event || '(không tên)'}"`);
      return { handled: false, reason: `Sự kiện không cần xử lý: ${event || '(không tên)'}`, affected: 0 };
    }

    if (!userId) {
      this.logger.warn(`Sự kiện xoá dữ liệu "${event}" không kèm mã người dùng — không biết xoá của ai`);
      return { handled: false, reason: 'Thiếu mã người dùng Zalo', affected: 0 };
    }

    return this.eraseCitizen(userId, event, ip);
  }

  /**
   * Xoá dữ liệu cá nhân của một công dân đã định danh qua Zalo.
   *
   * KHÔNG xoá hẳn bản ghi. Số điện thoại là khoá liên kết tới hồ sơ một cửa và
   * phản ánh đã gửi — những thứ UBND xã có nghĩa vụ lưu theo quy định lưu trữ.
   * Cách làm là **vô danh hoá**: bỏ mọi trường nhận dạng cá nhân, giữ lại bản
   * ghi rỗng để không phá tính toàn vẹn tham chiếu, và khoá tài khoản lại.
   *
   * Đồng thời thu hồi mọi phiên đăng nhập, nếu không người dùng vừa rút đồng ý
   * vẫn tiếp tục dùng app bằng JWT còn hiệu lực.
   */
  private async eraseCitizen(zaloUserId: string, event: string, ip: string): Promise<ZaloEventOutcome> {
    const citizen = await this.citizenModel.findOne({ zaloUserId }).exec();

    if (!citizen) {
      // Không phải lỗi: người dùng có thể chưa từng định danh trên hệ thống này
      this.logger.log('Sự kiện xoá dữ liệu Zalo cho người dùng không có trong CSDL — không cần làm gì');
      return { handled: true, reason: 'Không có dữ liệu để xoá', affected: 0 };
    }

    const before = { phone: this.maskPhone(citizen.phone), displayName: citizen.displayName };

    await this.citizenModel
      .updateOne(
        { _id: citizen._id },
        {
          $set: {
            displayName: '',
            area: '',
            zaloUserId: '',
            pushTokens: [],
            status: 'locked',
            lockReason: 'Chủ thể dữ liệu đã rút lại sự đồng ý qua Zalo',
            erasedAt: new Date(),
          },
        },
      )
      .exec();

    // Phiên khoá theo `subject`, với công dân thì đó là số điện thoại
    const sessions = await this.sessionModel
      .updateMany({ subject: citizen.phone, revoked: false }, { $set: { revoked: true } })
      .exec();

    // Nhật ký KHÔNG ghi số điện thoại dạng rõ (yêu cầu trong SECURITY.md)
    await this.audit.record({
      actor: 'zalo-webhook',
      action: `zalo.${event}`,
      resource: 'citizen_users',
      resourceId: String(citizen._id),
      before,
      after: { displayName: '', zaloUserId: '', status: 'locked' },
      ip,
    });

    this.logger.log(`Đã vô danh hoá 1 công dân và thu hồi ${sessions.modifiedCount} phiên theo yêu cầu từ Zalo`);
    return { handled: true, reason: 'Đã vô danh hoá dữ liệu công dân', affected: 1 };
  }

  /** Che số điện thoại trước khi ghi nhật ký — chỉ giữ 3 số cuối */
  private maskPhone(phone: string): string {
    return phone.length <= 3 ? '***' : `${'*'.repeat(phone.length - 3)}${phone.slice(-3)}`;
  }
}
