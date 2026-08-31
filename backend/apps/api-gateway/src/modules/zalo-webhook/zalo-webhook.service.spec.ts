import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { CitizenUserDocument, LoginSessionDocument } from '@vigov/shared';
import type { AuditService } from '../audit/audit.service';
import { ZaloWebhookService } from './zalo-webhook.service';

/**
 * Kiểm thử webhook Zalo — sự kiện rút đồng ý và xoá dữ liệu.
 *
 * Trọng tâm là chỗ nguy hiểm nhất của toàn hệ thống: một endpoint CÔNG KHAI có
 * khả năng xoá dữ liệu công dân. Nếu việc kiểm chữ ký hở, bất kỳ ai biết URL
 * đều xoá được dữ liệu người dân, và không có đường khôi phục.
 *
 * Vì thế các phép thử dưới đây bám vào nguyên tắc FAIL CLOSED: thiếu khoá bí
 * mật, thiếu chữ ký, hay chữ ký sai đều phải bị từ chối — không phải "cho qua
 * vì chưa cấu hình".
 */

const SECRET = 'test-secret-khong-dung-that';
const APP_ID = '1891838922591157582';
const ZALO_USER_ID = 'zalo-user-abc';

const CITIZEN = {
  _id: 'citizen-1',
  phone: '0912345678',
  displayName: 'Nguyễn Văn A',
};

interface Harness {
  service: ZaloWebhookService;
  citizenUpdate: jest.Mock;
  sessionUpdate: jest.Mock;
  auditRecord: jest.Mock;
}

function makeService(opts: { secret?: string; citizen?: typeof CITIZEN | null } = {}): Harness {
  const secret = opts.secret ?? SECRET;
  const citizen = opts.citizen === undefined ? CITIZEN : opts.citizen;

  const config = {
    get: (key: string) => (key === 'zalo.appSecret' ? secret : key === 'zalo.appId' ? APP_ID : ''),
  } as unknown as ConfigService;

  const citizenUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
  const citizenModel = {
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(citizen) }),
    updateOne: citizenUpdate,
  } as unknown as Model<CitizenUserDocument>;

  const sessionUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }) });
  const sessionModel = { updateMany: sessionUpdate } as unknown as Model<LoginSessionDocument>;

  const auditRecord = jest.fn().mockResolvedValue(undefined);
  const audit = { record: auditRecord } as unknown as AuditService;

  return {
    service: new ZaloWebhookService(config, audit, citizenModel, sessionModel),
    citizenUpdate,
    sessionUpdate,
    auditRecord,
  };
}

function signHmac(body: string): string {
  return createHmac('sha256', SECRET).update(Buffer.from(body, 'utf8')).digest('hex');
}

describe('ZaloWebhookService — kiểm chữ ký', () => {
  const body = JSON.stringify({ event_name: 'user_deauthorize', user_id: ZALO_USER_ID });

  it('nhận chữ ký HMAC-SHA256 đúng', () => {
    const { service } = makeService();
    expect(service.verifySignature(Buffer.from(body), signHmac(body))).toBe(true);
  });

  it('bỏ được tiền tố kiểu "sha256=" mà Zalo có thể gửi kèm', () => {
    const { service } = makeService();
    expect(service.verifySignature(Buffer.from(body), `sha256=${signHmac(body)}`)).toBe(true);
  });

  it('từ chối khi chữ ký sai', () => {
    const { service } = makeService();
    expect(service.verifySignature(Buffer.from(body), 'a'.repeat(64))).toBe(false);
  });

  it('từ chối khi chữ ký tính trên thân yêu cầu khác', () => {
    const { service } = makeService();
    const other = JSON.stringify({ event_name: 'user_deauthorize', user_id: 'ai-khac' });
    expect(service.verifySignature(Buffer.from(body), signHmac(other))).toBe(false);
  });

  it('từ chối khi thiếu chữ ký', () => {
    const { service } = makeService();
    expect(service.verifySignature(Buffer.from(body), undefined)).toBe(false);
  });

  it('từ chối khi thân yêu cầu rỗng', () => {
    const { service } = makeService();
    expect(service.verifySignature(Buffer.alloc(0), signHmac(''))).toBe(false);
  });

  /**
   * Phép thử quan trọng nhất của tệp này. Chưa cấu hình ZALO_APP_SECRET là
   * trạng thái mặc định của môi trường mới — nếu lúc đó endpoint cho qua thì
   * mọi lần triển khai đều mở sẵn một đường phá dữ liệu.
   */
  it('từ chối MỌI yêu cầu khi chưa cấu hình ZALO_APP_SECRET', () => {
    const { service } = makeService({ secret: '' });
    expect(service.verifySignature(Buffer.from(body), signHmac(body))).toBe(false);
  });
});

describe('ZaloWebhookService — xử lý sự kiện', () => {
  it('vô danh hoá công dân và thu hồi phiên khi nhận sự kiện rút đồng ý', async () => {
    const h = makeService();
    const outcome = await h.service.handle({ event_name: 'user_deauthorize', user_id: ZALO_USER_ID }, '1.2.3.4');

    expect(outcome).toEqual({ handled: true, reason: 'Đã vô danh hoá dữ liệu công dân', affected: 1 });

    const [, update] = h.citizenUpdate.mock.calls[0] as [unknown, { $set: Record<string, unknown> }];
    expect(update.$set).toMatchObject({
      displayName: '',
      area: '',
      zaloUserId: '',
      pushTokens: [],
      status: 'locked',
    });
    expect(update.$set.erasedAt).toBeInstanceOf(Date);

    // Phiên phải khoá theo `subject` (số điện thoại), không phải theo `phone`
    expect(h.sessionUpdate).toHaveBeenCalledWith(
      { subject: CITIZEN.phone, revoked: false },
      { $set: { revoked: true } },
    );
  });

  it('không ghi số điện thoại dạng rõ vào nhật ký', async () => {
    const h = makeService();
    await h.service.handle({ event_name: 'user_deauthorize', user_id: ZALO_USER_ID }, '1.2.3.4');

    const entry = h.auditRecord.mock.calls[0][0] as { before: { phone: string } };
    expect(entry.before.phone).toBe('*******678');
    expect(JSON.stringify(entry)).not.toContain(CITIZEN.phone);
  });

  it('nhận mã người dùng nằm lồng trong trường data', async () => {
    const h = makeService();
    const outcome = await h.service.handle(
      { event: 'user_delete_data', data: { userId: ZALO_USER_ID } },
      '1.2.3.4',
    );
    expect(outcome.handled).toBe(true);
    expect(h.citizenUpdate).toHaveBeenCalled();
  });

  it('bỏ qua sự kiện không thuộc nhóm xoá dữ liệu, không sửa gì', async () => {
    const h = makeService();
    const outcome = await h.service.handle({ event_name: 'user_follow', user_id: ZALO_USER_ID }, '1.2.3.4');

    expect(outcome.handled).toBe(false);
    expect(h.citizenUpdate).not.toHaveBeenCalled();
    expect(h.sessionUpdate).not.toHaveBeenCalled();
  });

  it('từ chối xử lý khi sự kiện xoá dữ liệu không kèm mã người dùng', async () => {
    const h = makeService();
    const outcome = await h.service.handle({ event_name: 'user_deauthorize' }, '1.2.3.4');

    expect(outcome).toEqual({ handled: false, reason: 'Thiếu mã người dùng Zalo', affected: 0 });
    expect(h.citizenUpdate).not.toHaveBeenCalled();
  });

  it('coi là thành công khi người dùng chưa từng định danh trên hệ thống', async () => {
    const h = makeService({ citizen: null });
    const outcome = await h.service.handle({ event_name: 'user_deauthorize', user_id: 'nguoi-la' }, '1.2.3.4');

    expect(outcome).toEqual({ handled: true, reason: 'Không có dữ liệu để xoá', affected: 0 });
    expect(h.citizenUpdate).not.toHaveBeenCalled();
  });
});
