import { MIN_PASSWORD_LENGTH, checkPasswordPolicy } from './password-policy';

/**
 * Chính sách mật khẩu (SECURITY.md T-10).
 *
 * VÌ SAO ĐÁNG TEST: chính sách này chạy ở BA đường khác nhau (quản trị viên tạo
 * tài khoản, quản trị viên đặt lại, người dùng tự đổi). Nếu một hôm ai đó nới
 * một luật ở đây, cả ba đường lỏng theo cùng lúc — mà không có test thì không
 * có gì báo. Mỗi `it` dưới đây khoá lại một luật cụ thể.
 */
describe('checkPasswordPolicy', () => {
  it('nhận mật khẩu đủ dài, có chữ và số', () => {
    expect(checkPasswordPolicy('DiaChinh2026xd')).toBeNull();
    expect(checkPasswordPolicy('mat khau dai 2026')).toBeNull();
  });

  it('từ chối mật khẩu ngắn và nói rõ cần bao nhiêu ký tự', () => {
    const problem = checkPasswordPolicy('Abc12345');
    expect(problem).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('đòi có chữ và có số — chỉ dài thôi thì chưa đủ', () => {
    expect(checkPasswordPolicy('1234567890123')).toBe('Mật khẩu phải có ít nhất một chữ cái');
    expect(checkPasswordPolicy('matkhaudaikhongso')).toBe('Mật khẩu phải có ít nhất một chữ số');
  });

  it('nhận chữ có dấu là chữ cái — cán bộ đặt mật khẩu tiếng Việt là chuyện thường', () => {
    expect(checkPasswordPolicy('ĐạiThắng2026')).toBeNull();
  });

  it('từ chối một ký tự lặp lại dù đủ dài', () => {
    expect(checkPasswordPolicy('aaaaaaaaaaaa')).not.toBeNull();
  });

  it('từ chối mật khẩu quá phổ biến, không phân biệt hoa thường', () => {
    expect(checkPasswordPolicy('MatKhau123')).toBe('Mật khẩu này quá phổ biến, vui lòng chọn mật khẩu khác');
    expect(checkPasswordPolicy('1234567890')).not.toBeNull();
  });

  it('từ chối mật khẩu chứa tên đăng nhập — thứ người dò thử ngay sau danh sách phổ biến', () => {
    expect(checkPasswordPolicy('tuan.lm2026abc', { username: 'tuan.lm' })).toBe(
      'Mật khẩu không được chứa tên đăng nhập',
    );
    // Viết hoa khác nhau cũng không lách được
    expect(checkPasswordPolicy('TUAN.LM2026abc', { username: 'tuan.lm' })).not.toBeNull();
    // Không có ngữ cảnh username thì luật này không áp (DTO không mang username)
    expect(checkPasswordPolicy('tuan.lm2026abc')).toBeNull();
  });

  it('bỏ qua luật tên đăng nhập khi tên quá ngắn — "an" nằm trong quá nhiều từ', () => {
    expect(checkPasswordPolicy('BanQuanLy2026', { username: 'an' })).toBeNull();
  });

  it('từ chối dấu cách ở đầu/cuối — người dùng dán mật khẩu là mất ký tự mà không hiểu vì sao', () => {
    expect(checkPasswordPolicy(' DiaChinh2026 ')).toBe(
      'Mật khẩu không được bắt đầu hoặc kết thúc bằng dấu cách',
    );
  });

  it('từ chối chuỗi rỗng và giá trị không phải chuỗi', () => {
    expect(checkPasswordPolicy('')).toBe('Vui lòng nhập mật khẩu mới');
    expect(checkPasswordPolicy(undefined as unknown as string)).toBe('Vui lòng nhập mật khẩu mới');
  });

  it('chặn mật khẩu dài quá 72 byte — bcrypt cắt ở đó nên phần sau là ảo giác an toàn', () => {
    expect(checkPasswordPolicy(`a1${'x'.repeat(80)}`)).toContain('72');
  });
});
