import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type {
  BlacklistRecordDocument,
  CitizenUserDocument,
  LoginSessionDocument,
  SessionRegistry,
  StaffUserDocument,
} from '@vigov/shared';
import { queryChain } from '../../../../../test/support/mongoose-mock';
import { UsersService } from './users.service';

/**
 * Đổi quyền / đặt lại mật khẩu cán bộ PHẢI thu hồi phiên đang mở.
 *
 * VÌ SAO ĐÁNG MỘT BỘ TEST RIÊNG: JwtAuthGuard đọc `roleKey` thẳng từ payload
 * JWT và không tra lại cơ sở dữ liệu — SessionRegistry chỉ kiểm `revoked` và
 * `subjectLocked`, không kiểm vai trò. Nên nếu hai hàm dưới đây chỉ ghi xuống
 * Mongo mà quên thu hồi phiên thì:
 *   · hạ quyền một tài khoản nghi bị chiếm → quyền CŨ vẫn sống nguyên 8 giờ;
 *   · đặt lại mật khẩu vì nghi lộ → kẻ đang giữ token vẫn dùng tiếp 8 giờ.
 * Cả hai đều im lặng, không lỗi, không dấu hiệu gì trên giao diện.
 */

const STAFF = { username: 'tuan.lm', displayName: 'Lê Minh Tuấn', department: 'Địa chính – Xây dựng' };

interface Harness {
  service: UsersService;
  /** updateMany của sổ phiên — nơi việc thu hồi thực sự xảy ra */
  sessionUpdateMany: jest.Mock;
  /** Xoá bộ nhớ đệm 10 giây của SessionRegistry */
  invalidateAll: jest.Mock;
}

function makeService(staffDoc: Record<string, unknown> | null = { ...STAFF, roleKey: 'receptionist' }): Harness {
  const sessionUpdateMany = jest.fn(() => queryChain({ modifiedCount: 2 }));
  const invalidateAll = jest.fn();

  const staffModel = {
    findOneAndUpdate: jest.fn(() => queryChain(staffDoc)),
  };

  const service = new UsersService(
    {} as unknown as Model<CitizenUserDocument>,
    staffModel as unknown as Model<StaffUserDocument>,
    { updateMany: sessionUpdateMany } as unknown as Model<LoginSessionDocument>,
    {} as unknown as Model<BlacklistRecordDocument>,
    { get: () => undefined } as unknown as ConfigService,
    { invalidateAll } as unknown as SessionRegistry,
  );

  return { service, sessionUpdateMany, invalidateAll };
}

/** Bộ lọc mà updateMany nhận được ở lần gọi đầu tiên */
function revokeFilterOf(mock: jest.Mock): Record<string, unknown> {
  return mock.mock.calls[0][0] as Record<string, unknown>;
}

describe('UsersService.updateStaff', () => {
  it('đổi vai trò thì thu hồi mọi phiên còn hiệu lực của người đó', async () => {
    const { service, sessionUpdateMany } = makeService();

    await service.updateStaff('tuan.lm', { roleKey: 'officer' });

    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(revokeFilterOf(sessionUpdateMany)).toEqual({ subject: 'tuan.lm', revoked: false });
    expect(sessionUpdateMany.mock.calls[0][1]).toEqual({ $set: { revoked: true } });
  });

  it('khoá tài khoản qua status cũng thu hồi phiên', async () => {
    const { service, sessionUpdateMany } = makeService();

    await service.updateStaff('tuan.lm', { status: 'locked' });

    expect(revokeFilterOf(sessionUpdateMany)).toEqual({ subject: 'tuan.lm', revoked: false });
  });

  it('chuyển phòng ban cũng thu hồi — payload JWT mang department đã cũ', async () => {
    const { service, sessionUpdateMany } = makeService();

    await service.updateStaff('tuan.lm', { department: 'Tư pháp – Hộ tịch' });

    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('xoá bộ nhớ đệm phiên — không xoá thì token vừa thu hồi còn lọt 10 giây', async () => {
    const { service, invalidateAll } = makeService();

    await service.updateStaff('tuan.lm', { roleKey: 'officer' });

    expect(invalidateAll).toHaveBeenCalledTimes(1);
  });

  it('không có trường nào để sửa thì báo lỗi, không đụng tới phiên', async () => {
    const { service, sessionUpdateMany } = makeService();

    await expect(service.updateStaff('tuan.lm', {})).rejects.toThrow('Không có thông tin nào cần cập nhật');
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });

  it('không tìm thấy tài khoản thì KHÔNG thu hồi phiên của ai cả', async () => {
    const { service, sessionUpdateMany } = makeService(null);

    await expect(service.updateStaff('khong-ton-tai', { roleKey: 'officer' })).rejects.toThrow(
      'Không tìm thấy tài khoản cán bộ',
    );
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });
});

describe('UsersService.changeStaffPassword', () => {
  it('đặt lại mật khẩu thì thu hồi phiên — lý do đổi thường là nghi bị lộ', async () => {
    const { service, sessionUpdateMany, invalidateAll } = makeService();

    await service.changeStaffPassword('tuan.lm', { newPassword: 'MatKhauMoi@2026' });

    expect(revokeFilterOf(sessionUpdateMany)).toEqual({ subject: 'tuan.lm', revoked: false });
    expect(invalidateAll).toHaveBeenCalledTimes(1);
  });

  it('trả về số phiên đã cắt để giao diện nói rõ với quản trị viên', async () => {
    const { service } = makeService();

    await expect(service.changeStaffPassword('tuan.lm', { newPassword: 'MatKhauMoi@2026' })).resolves.toEqual({
      username: 'tuan.lm',
      updated: true,
      revokedSessions: 2,
    });
  });

  it('không tìm thấy tài khoản thì không thu hồi phiên', async () => {
    const { service, sessionUpdateMany } = makeService(null);

    await expect(
      service.changeStaffPassword('khong-ton-tai', { newPassword: 'MatKhauMoi@2026' }),
    ).rejects.toThrow('Không tìm thấy tài khoản cán bộ');
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });
});
