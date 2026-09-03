import { normalizeVnPhone } from './auth.service';

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
