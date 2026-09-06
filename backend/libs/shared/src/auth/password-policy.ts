import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * Chính sách mật khẩu tài khoản cán bộ (SECURITY.md T-10).
 *
 * VÌ SAO ĐẶT Ở `libs/shared`: chính sách phải giống nhau ở BA chỗ — DTO tạo/đặt
 * lại mật khẩu của quản trị viên, DTO người dùng tự đổi, và chỗ sinh mật khẩu
 * tạm. Để mỗi nơi tự kiểm là chắc chắn sẽ lệch, rồi có một đường vào nhận mật
 * khẩu yếu hơn các đường còn lại.
 *
 * MỨC ĐỘ CÓ CHỦ Ý VỪA PHẢI: đây là tài khoản cán bộ xã dùng hằng ngày, không
 * phải khoá ký số. Bắt ký tự đặc biệt và đổi mật khẩu định kỳ đã được chứng minh
 * là đẩy người dùng sang viết mật khẩu ra giấy dán màn hình — hại hơn lợi. Nên
 * chỉ yêu cầu ĐỦ DÀI, có chữ và số, và không phải mật khẩu ai cũng đoán được.
 */

/** Độ dài tối thiểu — dài quan trọng hơn phức tạp */
export const MIN_PASSWORD_LENGTH = 10;

/** Độ dài tối đa: chặn tấn công tốn CPU băm chuỗi khổng lồ (bcrypt cắt ở 72 byte) */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Mật khẩu bị từ chối thẳng, không cần xét luật khác.
 *
 * Đây KHÔNG phải bộ lọc đầy đủ (không thể có) mà chỉ chặn những dãy xuất hiện
 * gần như trong mọi lần dò đầu tiên nhắm vào hệ thống hành chính Việt Nam.
 */
const COMMON_PASSWORDS = [
  '1234567890',
  '0123456789',
  'qwertyuiop',
  'matkhau123',
  'password123',
  'admin12345',
  'vigov12345',
  'abcd123456',
  'hanhchinh123',
  'ubndxa12345',
];

/** Chuỗi lặp một ký tự hoặc dãy số/chữ liền nhau — dài nhưng vô nghĩa */
const REPEATED_CHAR = /^(.)\1+$/;

export interface PasswordPolicyContext {
  /** Tên đăng nhập: mật khẩu không được chứa nó (kể cả viết hoa/thường khác nhau) */
  username?: string;
}

/**
 * Kiểm tra mật khẩu theo chính sách. Trả `null` nếu hợp lệ, hoặc **thông báo
 * tiếng Việt nói rõ phải sửa gì** — thông báo này hiện thẳng lên giao diện nên
 * đừng viết kiểu "invalid password".
 */
export function checkPasswordPolicy(password: string, ctx: PasswordPolicyContext = {}): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Vui lòng nhập mật khẩu mới';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Mật khẩu không được dài quá ${MAX_PASSWORD_LENGTH} ký tự`;
  }
  if (password.trim().length !== password.length) {
    return 'Mật khẩu không được bắt đầu hoặc kết thúc bằng dấu cách';
  }
  if (!/[A-Za-zÀ-ỹ]/.test(password)) {
    return 'Mật khẩu phải có ít nhất một chữ cái';
  }
  if (!/\d/.test(password)) {
    return 'Mật khẩu phải có ít nhất một chữ số';
  }
  if (REPEATED_CHAR.test(password)) {
    return 'Mật khẩu không được là một ký tự lặp lại';
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lowered)) {
    return 'Mật khẩu này quá phổ biến, vui lòng chọn mật khẩu khác';
  }

  // Mật khẩu chứa tên đăng nhập là thứ người dò thử ngay sau danh sách phổ biến
  const username = ctx.username?.trim().toLowerCase();
  if (username && username.length >= 3 && lowered.includes(username)) {
    return 'Mật khẩu không được chứa tên đăng nhập';
  }
  return null;
}

/**
 * Decorator dùng trong DTO. Không kiểm được điều kiện "không chứa tên đăng
 * nhập" vì DTO của luồng đổi mật khẩu không mang username — chỗ đó service gọi
 * `checkPasswordPolicy` với đủ ngữ cảnh.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && checkPasswordPolicy(value) === null;
        },
        defaultMessage(args: ValidationArguments) {
          return checkPasswordPolicy(args.value as string) ?? 'Mật khẩu không hợp lệ';
        },
      },
    });
  };
}
