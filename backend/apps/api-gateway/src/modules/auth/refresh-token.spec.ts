import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import type { CitizenUserDocument, LoginSessionDocument, SessionRegistry, StaffUserDocument } from '@vigov/shared';
import { fakeDoc, queryChain } from '../../../../../test/support/mongoose-mock';
import type { UsersService } from '../users/users.service';
import { AuthService, parseDurationSeconds } from './auth.service';

/**
 * Xoay vòng refresh token (T-09) — VÌ SAO ĐÁNG MỘT BỘ TEST RIÊNG.
 *
 * Cả ba lỗi dễ mắc ở đây đều KHÔNG hề báo lỗi khi thử tay:
 *   · Quên ghi đè băm khi cấp token mới → token cũ dùng được mãi mãi. Nhìn từ
 *     ngoài thì "refresh chạy tốt", chỉ là cơ chế xoay vòng không tồn tại.
 *   · Không phát hiện dùng lại → token đã lộ tiếp tục gia hạn phiên vô hạn,
 *     đúng thứ mà xoay vòng ra đời để chặn.
 *   · Không tra lại vai trò khi cấp access token mới → tài khoản vừa bị hạ
 *     quyền vẫn giữ quyền cũ qua từng lần refresh, hết hạn 8 giờ cũng không
 *     mất, vì mỗi lần refresh lại nhân bản payload cũ.
 */

/** _id hợp lệ để `isValidObjectId` cho qua */
const SESSION_ID = '64b7f3a2c1d4e5f6a7b8c9d0';
const STAFF = {
  _id: 'staff-1',
  username: 'tuan.lm',
  displayName: 'Lê Minh Tuấn',
  roleKey: 'officer',
  department: 'Địa chính – Xây dựng',
  status: 'active',
};

interface Harness {
  service: AuthService;
  session: ReturnType<typeof fakeDoc>;
  sessionUpdateOne: jest.Mock;
  isActive: jest.Mock;
  invalidate: jest.Mock;
  signAsync: jest.Mock;
  revokeOtherSessions: jest.Mock;
  staffFindOne: jest.Mock;
}

interface HarnessOptions {
  /** Bí mật ĐANG có hiệu lực; null = phiên chưa từng cấp refresh token */
  storedSecret?: string | null;
  refreshExpiresAt?: Date | null;
  revoked?: boolean;
  /** SessionRegistry.isActive trả về gì (phiên bị thu hồi / chủ tài khoản bị khoá) */
  active?: boolean;
  staff?: Record<string, unknown> | null;
  /** Mật khẩu hiện tại của cán bộ, dùng cho nhóm test đổi mật khẩu */
  currentPassword?: string;
}

function makeService(options: HarnessOptions = {}): Harness {
  const {
    storedSecret = 'bi-mat-dang-co-hieu-luc',
    refreshExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revoked = false,
    active = true,
    staff = STAFF,
    currentPassword,
  } = options;

  const session = fakeDoc({
    _id: SESSION_ID,
    subject: STAFF.username,
    kind: 'web',
    ip: '10.0.0.1',
    device: 'Chrome',
    revoked,
    lastActiveAt: new Date(0),
    refreshTokenHash: storedSecret === null ? undefined : bcrypt.hashSync(storedSecret, 4),
    refreshExpiresAt: refreshExpiresAt ?? undefined,
  });

  const sessionUpdateOne = jest.fn(() => queryChain({ modifiedCount: 1 }));
  const sessionModel = {
    findById: jest.fn(() => queryChain(session)),
    updateOne: sessionUpdateOne,
  } as unknown as Model<LoginSessionDocument>;

  const staffDoc = staff
    ? fakeDoc({
        ...staff,
        passwordHash: currentPassword ? bcrypt.hashSync(currentPassword, 4) : 'khong-dung-den',
      })
    : null;
  const staffFindOne = jest.fn(() => queryChain(staffDoc));
  const staffModel = { findOne: staffFindOne } as unknown as Model<StaffUserDocument>;

  const citizenModel = { findOne: jest.fn(() => queryChain(null)) } as unknown as Model<CitizenUserDocument>;

  const signAsync = jest.fn(async () => 'access-token-moi');
  const isActive = jest.fn(async () => active);
  const invalidate = jest.fn();
  const revokeOtherSessions = jest.fn(async () => ({ revoked: 3 }));

  const service = new AuthService(
    staffModel,
    citizenModel,
    sessionModel,
    { signAsync } as unknown as JwtService,
    {
      get: (key: string) => (key === 'auth.jwtExpiresIn' ? '8h' : key === 'auth.refreshExpiresIn' ? '7d' : undefined),
    } as unknown as ConfigService,
    { isActive, invalidate } as unknown as SessionRegistry,
    { revokeOtherSessions } as unknown as UsersService,
  );

  return {
    service,
    session,
    sessionUpdateOne,
    isActive,
    invalidate,
    signAsync,
    revokeOtherSessions,
    staffFindOne,
  };
}

/** Refresh token hợp lệ ghép từ mã phiên và bí mật đang có hiệu lực */
const VALID_TOKEN = `${SESSION_ID}.bi-mat-dang-co-hieu-luc`;

/** Băm mới mà `issueRefreshToken` vừa ghi xuống bản ghi phiên */
function writtenHash(sessionUpdateOne: jest.Mock): string {
  const patch = sessionUpdateOne.mock.calls[0][1] as { $set: { refreshTokenHash: string } };
  return patch.$set.refreshTokenHash;
}

describe('parseDurationSeconds', () => {
  it.each([
    ['8h', 28_800],
    ['7d', 604_800],
    ['30m', 1_800],
    ['45s', 45],
    ['3600', 3_600],
  ])('%s → %i giây', (input, expected) => {
    expect(parseDurationSeconds(input, 1)).toBe(expected);
  });

  it.each(['', undefined, 'mai-mai', '0h', '-5m'])(
    'giá trị không đọc được (%s) rơi về mặc định thay vì NaN',
    (input) => {
      expect(parseDurationSeconds(input, 999)).toBe(999);
    },
  );
});

describe('AuthService.refresh — xoay vòng', () => {
  it('cấp cặp token mới kèm hạn dùng access token theo JWT_EXPIRES_IN', async () => {
    const { service } = makeService();

    const result = await service.refresh(VALID_TOKEN, '10.0.0.2', 'Firefox');

    expect(result.accessToken).toBe('access-token-moi');
    expect(result.expiresInSeconds).toBe(28_800);
  });

  it('refresh token mới KHÁC token vừa dùng và vẫn mang mã phiên cũ', async () => {
    const { service } = makeService();

    const result = await service.refresh(VALID_TOKEN, '', '');

    expect(result.refreshToken).not.toBe(VALID_TOKEN);
    expect(result.refreshToken.startsWith(`${SESSION_ID}.`)).toBe(true);
  });

  it('GHI ĐÈ băm cũ — đây chính là hành vi vô hiệu token trước đó', async () => {
    const { service, sessionUpdateOne, session } = makeService();
    const hashBefore = session.refreshTokenHash as string;

    const result = await service.refresh(VALID_TOKEN, '', '');

    expect(sessionUpdateOne).toHaveBeenCalledTimes(1);
    const hashAfter = writtenHash(sessionUpdateOne);
    expect(hashAfter).not.toBe(hashBefore);
    // Băm mới khớp bí mật mới, KHÔNG khớp bí mật cũ
    const newSecret = result.refreshToken.slice(SESSION_ID.length + 1);
    expect(bcrypt.compareSync(newSecret, hashAfter)).toBe(true);
    expect(bcrypt.compareSync('bi-mat-dang-co-hieu-luc', hashAfter)).toBe(false);
  });

  it('gia hạn mốc hết hiệu lực của refresh token theo REFRESH_EXPIRES_IN', async () => {
    const { service, sessionUpdateOne } = makeService();

    await service.refresh(VALID_TOKEN, '', '');

    const patch = sessionUpdateOne.mock.calls[0][1] as { $set: { refreshExpiresAt: Date } };
    const seconds = (patch.$set.refreshExpiresAt.getTime() - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(604_800 - 60);
    expect(seconds).toBeLessThanOrEqual(604_800);
  });

  it('cập nhật mốc hoạt động + IP + thiết bị của phiên', async () => {
    const { service, session } = makeService();

    await service.refresh(VALID_TOKEN, '10.0.0.2', 'Firefox');

    expect(session.ip).toBe('10.0.0.2');
    expect(session.device).toBe('Firefox');
    expect((session.lastActiveAt as Date).getTime()).toBeGreaterThan(0);
  });

  it('đọc LẠI vai trò từ cơ sở dữ liệu, không nhân bản payload cũ', async () => {
    const { service, signAsync, staffFindOne } = makeService({
      staff: { ...STAFF, roleKey: 'officer', department: 'Tư pháp – Hộ tịch' },
    });

    await service.refresh(VALID_TOKEN, '', '');

    expect(staffFindOne).toHaveBeenCalledWith({ username: STAFF.username });
    expect(signAsync.mock.calls[0][0]).toMatchObject({
      username: STAFF.username,
      roleKey: 'officer',
      department: 'Tư pháp – Hộ tịch',
      sid: SESSION_ID,
    });
  });
});

describe('AuthService.refresh — phát hiện dùng lại', () => {
  it('gửi lại token ĐÃ xoay vòng thì THU HỒI luôn phiên và trả 401', async () => {
    const { service, session, invalidate } = makeService();

    await expect(service.refresh(`${SESSION_ID}.bi-mat-cu-da-xoay-vong`, '10.0.0.9', '')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(session.revoked).toBe(true);
    expect(session.save).toHaveBeenCalled();
    // Xoá bộ nhớ đệm, nếu không access token của phiên còn lọt thêm 10 giây
    expect(invalidate).toHaveBeenCalledWith(SESSION_ID);
  });

  it('KHÔNG cấp token mới khi phát hiện dùng lại', async () => {
    const { service, sessionUpdateOne, signAsync } = makeService();

    await expect(service.refresh(`${SESSION_ID}.sai-bi-mat`, '', '')).rejects.toThrow();

    expect(sessionUpdateOne).not.toHaveBeenCalled();
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('không ghi refresh token ra nhật ký khi cảnh báo dùng lại', async () => {
    // `logger` là thuộc tính của THỰC THỂ, không nằm trên prototype AuthService —
    // nên phải theo dõi ở Logger.prototype mới bắt được lời gọi.
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = makeService();

    await expect(service.refresh(`${SESSION_ID}.bi-mat-tuyet-doi-khong-duoc-ghi-log`, '10.0.0.9', '')).rejects.toThrow();

    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).not.toContain('bi-mat-tuyet-doi-khong-duoc-ghi-log');
    expect(logged).toContain(SESSION_ID);
    warn.mockRestore();
  });
});

describe('AuthService.refresh — phiên không dùng được', () => {
  it('phiên đã thu hồi / chủ tài khoản bị khoá thì trượt (theo SessionRegistry)', async () => {
    const { service, isActive, sessionUpdateOne } = makeService({ active: false });

    await expect(service.refresh(VALID_TOKEN, '', '')).rejects.toBeInstanceOf(UnauthorizedException);

    expect(isActive).toHaveBeenCalledWith(SESSION_ID);
    expect(sessionUpdateOne).not.toHaveBeenCalled();
  });

  it('refresh token hết hạn thì đóng hẳn phiên và trả 401', async () => {
    const { service, session } = makeService({ refreshExpiresAt: new Date(Date.now() - 1000) });

    await expect(service.refresh(VALID_TOKEN, '', '')).rejects.toBeInstanceOf(UnauthorizedException);

    expect(session.revoked).toBe(true);
  });

  it('phiên chưa từng cấp refresh token thì trượt, không tạo mới ngầm', async () => {
    const { service, sessionUpdateOne } = makeService({ storedSecret: null });

    await expect(service.refresh(VALID_TOKEN, '', '')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionUpdateOne).not.toHaveBeenCalled();
  });

  it.each([
    ['thiếu dấu phân cách', 'khong-co-dau-cham'],
    ['mã phiên không phải ObjectId', 'khong-phai-objectid.bi-mat'],
    ['thiếu phần bí mật', `${SESSION_ID}.`],
    ['chuỗi rỗng', ''],
  ])('token sai dạng (%s) bị chặn TRƯỚC khi truy vấn cơ sở dữ liệu', async (_label, token) => {
    const { service, isActive } = makeService();

    await expect(service.refresh(token, '', '')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(isActive).not.toHaveBeenCalled();
  });

  it('tài khoản cán bộ đã bị xoá thì không cấp được token mới', async () => {
    const { service } = makeService({ staff: null });

    await expect(service.refresh(VALID_TOKEN, '', '')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('tài khoản bị khoá vĩnh viễn thì không cấp được token mới', async () => {
    const { service } = makeService({ staff: { ...STAFF, status: 'locked' } });

    await expect(service.refresh(VALID_TOKEN, '', '')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.changeOwnPassword', () => {
  /*
   * 400 chứ KHÔNG phải 401: client coi 401 là phiên hết hạn và tự đăng xuất, nên
   * trả 401 ở đây là gõ sai mật khẩu một lần bị đá ra trang đăng nhập.
   */
  it('sai mật khẩu hiện tại thì 400 và KHÔNG thu hồi phiên nào', async () => {
    const { service, revokeOtherSessions } = makeService({ currentPassword: 'MatKhauDung@2026' });

    await expect(
      service.changeOwnPassword(STAFF.username, 'MatKhauSai@2026', 'MatKhauMoi@2026', SESSION_ID),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(revokeOtherSessions).not.toHaveBeenCalled();
  });

  it('đúng mật khẩu thì đổi băm và thu hồi các phiên KHÁC, giữ phiên hiện tại', async () => {
    const { service, revokeOtherSessions } = makeService({ currentPassword: 'MatKhauDung@2026' });

    const result = await service.changeOwnPassword(
      STAFF.username,
      'MatKhauDung@2026',
      'MatKhauMoi@2026',
      SESSION_ID,
    );

    expect(result).toEqual({ updated: true, revokedSessions: 3 });
    expect(revokeOtherSessions).toHaveBeenCalledWith(STAFF.username, SESSION_ID);
  });

  it('tài khoản không tồn tại (ví dụ tài khoản công dân) cũng chỉ nhận đúng một thông điệp', async () => {
    const { service } = makeService({ staff: null });

    await expect(
      service.changeOwnPassword('0987654321', 'bat-ky', 'MatKhauMoi@2026', SESSION_ID),
    ).rejects.toThrow('Mật khẩu hiện tại không đúng');
  });
});
