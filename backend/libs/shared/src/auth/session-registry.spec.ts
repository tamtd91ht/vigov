import { Logger } from '@nestjs/common';
import { SessionRegistry, type SessionState } from './session-registry';

const ACTIVE: SessionState = { revoked: false, subjectLocked: false };
const REVOKED: SessionState = { revoked: true, subjectLocked: false };
const LOCKED: SessionState = { revoked: false, subjectLocked: true };

const SID = '68b0f2c1a4d5e6f708192a3b';

describe('SessionRegistry.isActive', () => {
  let registry: SessionRegistry;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    registry = new SessionRegistry();
    // Nhánh resolver ném lỗi có ghi log cảnh báo — nuốt để đầu ra test sạch
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    jest.useRealTimers();
  });

  it('chưa đăng ký resolver thì cho qua (môi trường test / khởi động sớm)', async () => {
    await expect(registry.isActive(SID)).resolves.toBe(true);
  });

  it('phiên bình thường thì cho qua', async () => {
    registry.registerResolver(async () => ACTIVE);
    await expect(registry.isActive(SID)).resolves.toBe(true);
  });

  it('phiên bị thu hồi thì chặn', async () => {
    registry.registerResolver(async () => REVOKED);
    await expect(registry.isActive(SID)).resolves.toBe(false);
  });

  it('chủ tài khoản bị khoá thì chặn dù phiên chưa thu hồi', async () => {
    registry.registerResolver(async () => LOCKED);
    await expect(registry.isActive(SID)).resolves.toBe(false);
  });

  it('resolver trả null (phiên đã bị xoá) thì coi như đã thu hồi', async () => {
    registry.registerResolver(async () => null);
    await expect(registry.isActive(SID)).resolves.toBe(false);
  });

  it('resolver ném lỗi thì KHÔNG làm sập xác thực — cho qua và ghi cảnh báo', async () => {
    registry.registerResolver(async () => {
      throw new Error('mất kết nối cơ sở dữ liệu');
    });

    await expect(registry.isActive(SID)).resolves.toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(SID);
  });

  it('không nhớ kết quả khi resolver ném lỗi — lần sau vẫn tra lại', async () => {
    const resolver = jest
      .fn<Promise<SessionState | null>, [string]>()
      .mockRejectedValueOnce(new Error('lỗi tạm thời'))
      .mockResolvedValueOnce(REVOKED);
    registry.registerResolver(resolver);

    await expect(registry.isActive(SID)).resolves.toBe(true);
    await expect(registry.isActive(SID)).resolves.toBe(false);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  describe('bộ nhớ đệm', () => {
    it('chỉ tra cơ sở dữ liệu một lần trong thời gian còn hiệu lực', async () => {
      const resolver = jest.fn(async () => ACTIVE);
      registry.registerResolver(resolver);

      await registry.isActive(SID);
      await registry.isActive(SID);
      await registry.isActive(SID);

      expect(resolver).toHaveBeenCalledTimes(1);
    });

    it('invalidate() buộc lần tra kế tiếp lấy trạng thái mới — thu hồi có hiệu lực ngay', async () => {
      const resolver = jest
        .fn<Promise<SessionState | null>, [string]>()
        .mockResolvedValueOnce(ACTIVE)
        .mockResolvedValueOnce(REVOKED);
      registry.registerResolver(resolver);

      await expect(registry.isActive(SID)).resolves.toBe(true);
      registry.invalidate(SID);
      await expect(registry.isActive(SID)).resolves.toBe(false);
      expect(resolver).toHaveBeenCalledTimes(2);
    });

    it('invalidateAll() xoá đệm của mọi phiên', async () => {
      const resolver = jest.fn(async () => ACTIVE);
      registry.registerResolver(resolver);

      await registry.isActive('phien-1');
      await registry.isActive('phien-2');
      expect(resolver).toHaveBeenCalledTimes(2);

      registry.invalidateAll();
      await registry.isActive('phien-1');
      await registry.isActive('phien-2');
      expect(resolver).toHaveBeenCalledTimes(4);
    });

    it('đệm hết hạn sau 10 giây thì tra lại', async () => {
      jest.useFakeTimers();
      const resolver = jest
        .fn<Promise<SessionState | null>, [string]>()
        .mockResolvedValueOnce(ACTIVE)
        .mockResolvedValueOnce(REVOKED);
      registry.registerResolver(resolver);

      await expect(registry.isActive(SID)).resolves.toBe(true);
      jest.advanceTimersByTime(10_001);
      await expect(registry.isActive(SID)).resolves.toBe(false);
      expect(resolver).toHaveBeenCalledTimes(2);
    });

    it('mỗi phiên có đệm riêng — thu hồi phiên này không ảnh hưởng phiên kia', async () => {
      registry.registerResolver(async (sessionId) => (sessionId === 'da-thu-hoi' ? REVOKED : ACTIVE));

      await expect(registry.isActive('da-thu-hoi')).resolves.toBe(false);
      await expect(registry.isActive('con-hieu-luc')).resolves.toBe(true);
    });
  });
});
