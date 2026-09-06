import { IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

/** Đăng nhập cán bộ Web Quản trị */
export class StaffLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tài khoản' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password: string;
}

/** Công dân yêu cầu mã OTP theo số điện thoại (app Flutter) */
export class RequestOtpDto {
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;
}

/** Công dân xác thực mã OTP */
export class VerifyOtpDto {
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'Mã xác thực gồm 6 chữ số' })
  otp: string;

  @IsOptional()
  @IsString()
  device?: string;
}

/** Định danh công dân qua Zalo Mini App: SDK trả token, server đổi lấy số điện thoại */
export class ZaloIdentifyDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu token định danh Zalo' })
  token: string;

  /** Phiên đăng nhập Zalo của người dùng — Zalo bắt buộc có để đổi mã */
  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  zaloUserId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

/** Cấp lại cặp token bằng refresh token (T-09) */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu refresh token' })
  refreshToken: string;
}

/**
 * Độ dài mật khẩu tối thiểu — GIỮ BẰNG `MIN_PASSWORD_LENGTH` của
 * users.dto.ts (đặt lại mật khẩu cán bộ). Hai đường đổi mật khẩu mà đòi độ dài
 * khác nhau thì quản trị viên đặt được mật khẩu mà chính chủ không tự đổi lại
 * được, hoặc ngược lại.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Cán bộ tự đổi mật khẩu của chính mình (PATCH /auth/me/password) */
export class ChangeOwnPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Mật khẩu mới phải có tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`,
  })
  newPassword: string;
}
