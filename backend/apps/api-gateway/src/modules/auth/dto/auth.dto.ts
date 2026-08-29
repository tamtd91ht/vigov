import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

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

  @IsOptional()
  @IsString()
  zaloUserId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
