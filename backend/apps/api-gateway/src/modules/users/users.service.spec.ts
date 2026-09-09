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

/**
 * Xoá tài khoản công dân là xoá MỀM.
 *
 * VÌ SAO ĐÁNG TEST RIÊNG: số điện thoại công dân là khoá liên kết tới hồ sơ một
 * cửa và phản ánh đã gửi. Nếu một ngày ai đó đổi hai hàm dưới đây sang
 * `deleteOne`/`findByIdAndDelete` thì dữ liệu xoá đi không lấy lại được, mà
 * giao diện vẫn chạy y hệt — hỏng lặng lẽ. Hai điểm còn lại phải giữ: bản ghi
 * đã xoá bị thu hồi phiên ngay, và chỉ tìm trong nhóm CHƯA xoá.
 */
describe('UsersService.deleteCitizenById', () => {
  const CITIZEN_ID = '507f1f77bcf86cd799439011';

  /** Tài liệu công dân giả — `get()` phục vụ các trường timestamps của Mongoose */
  const citizenDoc = {
    _id: CITIZEN_ID,
    phone: '0987654321',
    displayName: 'Trần Thị Hoa',
    area: 'Thôn 1',
    channel: 'zalo',
    feedbackCount: 3,
    status: 'active',
    isDeleted: true,
    deletedAt: new Date('2026-09-06T00:00:00Z'),
    deletedBy: 'admin',
    get: () => undefined,
  };

  function makeCitizenService(doc: Record<string, unknown> | null = citizenDoc) {
    // Khai kiểu jest.Mock để đọc được `mock.calls[i]` — jest.fn(() => …) suy ra danh sách tham số rỗng
    const citizenFindOneAndUpdate: jest.Mock = jest.fn(() => queryChain(doc));
    const sessionUpdateMany: jest.Mock = jest.fn(() => queryChain({ modifiedCount: 2 }));
    const invalidateAll = jest.fn();

    const service = new UsersService(
      { findOneAndUpdate: citizenFindOneAndUpdate } as unknown as Model<CitizenUserDocument>,
      {} as unknown as Model<StaffUserDocument>,
      { updateMany: sessionUpdateMany } as unknown as Model<LoginSessionDocument>,
      {} as unknown as Model<BlacklistRecordDocument>,
      { get: () => undefined } as unknown as ConfigService,
      { invalidateAll } as unknown as SessionRegistry,
    );

    return { service, citizenFindOneAndUpdate, sessionUpdateMany, invalidateAll };
  }

  it('đánh dấu isDeleted chứ không xoá tài liệu khỏi CSDL', async () => {
    const { service, citizenFindOneAndUpdate } = makeCitizenService();

    await service.deleteCitizenById(CITIZEN_ID, 'admin', ' Tài khoản kiểm thử ');

    const [filter, update] = citizenFindOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
    ];
    // Chỉ xoá được bản ghi CHƯA xoá — gọi lại lần hai phải ra 404 chứ không ghi đè mốc xoá
    expect(filter).toMatchObject({ isDeleted: { $ne: true } });
    expect(update.$set.isDeleted).toBe(true);
    expect(update.$set.deletedAt).toBeInstanceOf(Date);
    expect(update.$set.deletedBy).toBe('admin');
    // Lý do được cắt khoảng trắng thừa trước khi lưu
    expect(update.$set.deleteReason).toBe('Tài khoản kiểm thử');
  });

  it('không nhập lý do thì không ghi trường rỗng vào bản ghi', async () => {
    const { service, citizenFindOneAndUpdate } = makeCitizenService();

    await service.deleteCitizenById(CITIZEN_ID, 'admin', '   ');

    const update = citizenFindOneAndUpdate.mock.calls[0][1] as { $set: Record<string, unknown> };
    expect(update.$set).not.toHaveProperty('deleteReason');
  });

  it('thu hồi mọi phiên đang mở của công dân đó và xoá bộ nhớ đệm phiên', async () => {
    const { service, sessionUpdateMany, invalidateAll } = makeCitizenService();

    const result = await service.deleteCitizenById(CITIZEN_ID, 'admin');

    expect(sessionUpdateMany.mock.calls[0][0]).toEqual({ subject: '0987654321', revoked: false });
    expect(invalidateAll).toHaveBeenCalledTimes(1);
    expect(result.revokedSessions).toBe(2);
  });

  it('không tìm thấy (hoặc đã xoá rồi) thì báo lỗi và không đụng tới phiên', async () => {
    const { service, sessionUpdateMany } = makeCitizenService(null);

    await expect(service.deleteCitizenById(CITIZEN_ID, 'admin')).rejects.toThrow(
      'Không tìm thấy tài khoản công dân',
    );
    expect(sessionUpdateMany).not.toHaveBeenCalled();
  });

  it('mã bản ghi sai định dạng thì chặn ngay, không truy vấn', async () => {
    const { service, citizenFindOneAndUpdate } = makeCitizenService();

    await expect(service.deleteCitizenById('khong-phai-objectid', 'admin')).rejects.toThrow(
      'Mã bản ghi không hợp lệ',
    );
    expect(citizenFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('khôi phục chỉ bỏ cờ xoá, dữ liệu công dân giữ nguyên', async () => {
    const { service, citizenFindOneAndUpdate } = makeCitizenService();

    const restored = await service.restoreCitizenById(CITIZEN_ID, 'admin');

    const [filter, update] = citizenFindOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $unset: Record<string, unknown> },
    ];
    expect(filter).toMatchObject({ isDeleted: true });
    expect(update.$set).toEqual({ isDeleted: false, deletedAt: null });
    expect(update.$unset).toEqual({ deletedBy: '', deleteReason: '' });
    expect(restored.displayName).toBe('Trần Thị Hoa');
  });
});
