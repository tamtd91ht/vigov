import { isTemporarilyLocked, nextLockState, normalizeVnPhone } from './auth.service';

/**
 * Số điện thoại là KHOÁ ĐỊNH DANH của công dân: hồ sơ, phiếu phản ánh và phiên
 * đăng nhập đều tra theo nó. Zalo trả về kèm mã quốc gia ("84987654321") trong
 * khi Mongo lưu dạng nội địa ("0987654321"), nên quy đổi sai một bước là cùng
 * một người có hai tài khoản, phiếu gửi ở tài khoản này không thấy ở tài khoản kia.
 */
describe('normalizeVnPhone', () => {
  describe('đưa về dạng nội địa 10 số', () => {
    it('dạng Zalo hay trả nhất: 84 + 9 số', () => {
      expect(normalizeVnPhone('84987654321')).toBe('0987654321');
    });

    it('có dấu cộng đứng đầu', () => {
      expect(normalizeVnPhone('+84987654321')).toBe('0987654321');
    });

    it('có khoảng trắng và gạch ngang xen giữa', () => {
      expect(normalizeVnPhone('+84 987-654-321')).toBe('0987654321');
    });

    it('vốn đã là dạng nội địa thì giữ nguyên', () => {
      expect(normalizeVnPhone('0987654321')).toBe('0987654321');
    });

    it('đầu số bắt đầu bằng 03', () => {
      expect(normalizeVnPhone('84357654321')).toBe('0357654321');
    });
  });

  describe('từ chối giá trị không dùng được', () => {
    it('rỗng', () => {
      expect(normalizeVnPhone('')).toBeNull();
    });

    it('không truyền gì', () => {
      expect(normalizeVnPhone(undefined)).toBeNull();
    });

    it('thiếu chữ số', () => {
      expect(normalizeVnPhone('84987654')).toBeNull();
    });

    it('thừa chữ số', () => {
      expect(normalizeVnPhone('849876543210')).toBeNull();
    });

    it('số nước ngoài — không phải mã 84', () => {
      expect(normalizeVnPhone('+1 415 555 0123')).toBeNull();
    });

    it('chuỗi không chứa chữ số nào', () => {
      expect(normalizeVnPhone('không-có-số')).toBeNull();
    });

    it('dạng nội địa nhưng không bắt đầu bằng 0', () => {
      expect(normalizeVnPhone('9876543210')).toBeNull();
    });
  });
});

/**
 * Khoá tạm tài khoản cán bộ sau 5 lần sai liên tiếp.
 *
 * Hạn mức của ThrottlerGuard đếm theo IP nên đổi IP là thoát; bộ đếm theo tài
 * khoản mới là thứ chặn được kiểu rải mật khẩu phổ biến lên cả danh bạ cán bộ.
 */
describe('isTemporarilyLocked', () => {
  const now = Date.parse('2026-09-04T10:00:00Z');

  it('chưa từng bị khoá — trường để null', () => {
    expect(isTemporarilyLocked(null, now)).toBe(false);
  });

  it('trường chưa có trong tài liệu cũ (undefined)', () => {
    expect(isTemporarilyLocked(undefined, now)).toBe(false);
  });

  it('hạn khoá còn ở tương lai thì vẫn đang khoá', () => {
    expect(isTemporarilyLocked(new Date(now + 60_000), now)).toBe(true);
  });

  it('hạn khoá đã qua thì tự mở, không cần ai can thiệp', () => {
    expect(isTemporarilyLocked(new Date(now - 1), now)).toBe(false);
  });

  it('đúng khoảnh khắc hết hạn thì coi như đã mở', () => {
    expect(isTemporarilyLocked(new Date(now), now)).toBe(false);
  });
});

describe('nextLockState', () => {
  const now = Date.parse('2026-09-04T10:00:00Z');

  it('sai lần đầu — chỉ đếm, chưa khoá', () => {
    expect(nextLockState(1, now)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
  });

  it('sai lần thứ 4 — vẫn còn một lượt', () => {
    expect(nextLockState(4, now)).toEqual({ failedLoginAttempts: 4, lockedUntil: null });
  });

  it('chạm ngưỡng lần thứ 5 — khoá 15 phút', () => {
    const state = nextLockState(5, now);
    expect(state.lockedUntil).toEqual(new Date(now + 15 * 60 * 1000));
  });

  it('khoá xong thì đưa bộ đếm về 0 — hết hạn là có lại trọn 5 lượt', () => {
    expect(nextLockState(5, now).failedLoginAttempts).toBe(0);
  });

  it('vượt ngưỡng do request song song vẫn ra đúng một hạn khoá', () => {
    expect(nextLockState(9, now).lockedUntil).toEqual(new Date(now + 15 * 60 * 1000));
  });
});
