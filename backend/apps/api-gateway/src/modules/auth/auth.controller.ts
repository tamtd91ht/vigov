import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AllowPendingPassword, Public, type AuthedRequest } from '@vigov/shared';
import { AuthService } from './auth.service';
import {
  ChangeOwnPasswordDto,
  RefreshTokenDto,
  RequestOtpDto,
  StaffLoginDto,
  VerifyOtpDto,
  ZaloIdentifyDto,
} from './dto/auth.dto';

/**
 * Hạn mức riêng cho nhóm endpoint xác thực (P4-36).
 * Hạn mức chung 120 lượt/phút của ThrottlerModule quá rộng cho màn đăng nhập:
 * đủ để dò mật khẩu hoặc quét mã OTP 6 chữ số. Nhóm này siết còn 5 lượt/phút
 * trên mỗi IP.
 */
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** Lấy IP và mô tả thiết bị từ request để ghi phiên đăng nhập */
function clientInfo(req: Request): { ip: string; device: string } {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    device: req.headers['user-agent'] ?? '',
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Đăng nhập cán bộ Web Quản trị */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('staff/login')
  staffLogin(@Body() dto: StaffLoginDto, @Req() req: Request) {
    const { ip, device } = clientInfo(req);
    return this.auth.staffLogin(dto.username, dto.password, ip, device);
  }

  /** Công dân yêu cầu mã OTP (Zalo Mini App) */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('citizen/otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  /** Công dân xác thực mã OTP */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('citizen/otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const { ip, device } = clientInfo(req);
    return this.auth.verifyOtp(dto.phone, dto.otp, ip, dto.device ?? device);
  }

  /** Định danh công dân qua Zalo Mini App */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('citizen/zalo/identify')
  identifyZalo(@Body() dto: ZaloIdentifyDto, @Req() req: Request) {
    const { ip } = clientInfo(req);
    return this.auth.identifyZalo(dto.token, dto.accessToken, dto.zaloUserId, dto.displayName, ip);
  }

  /**
   * Cấp lại cặp token bằng refresh token (T-09).
   *
   * `@Public()` vì đúng lúc gọi thì access token đã hết hạn — bắt kèm token
   * hợp lệ ở đây là làm cho endpoint vô dụng. Thứ xác thực người gọi chính là
   * refresh token trong thân yêu cầu.
   *
   * Chịu chung hạn mức 5 lượt/phút của nhóm auth: refresh hợp lệ thì mỗi 8 giờ
   * mới cần một lần, còn dò bí mật 32 byte thì hạn mức này chặn từ trong trứng.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const { ip, device } = clientInfo(req);
    return this.auth.refresh(dto.refreshToken, ip, device);
  }

  /** Thông tin phiên hiện tại */
  @Get('me')
  @AllowPendingPassword()
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  /**
   * Phiên đăng nhập của CHÍNH người đang gọi (trang Hồ sơ cá nhân).
   *
   * Khác `GET /users/sessions` ở hai điểm: đó là màn hình bảo mật của quản trị
   * (đòi `users:view`, trả phiên của cả cơ quan), còn đây chỉ trả phiên của
   * mình nên vai trò nào cũng gọi được. Trước khi có endpoint này, giao diện
   * phải lấy toàn bộ phiên web rồi tự lọc — vai trò không có quyền xem danh
   * sách phiên thì không thấy được cả phiên của chính họ.
   */
  @Get('me/sessions')
  mySessions(@Req() req: AuthedRequest) {
    return this.auth.listOwnSessions(req.user?.username ?? '', req.user?.sid);
  }

  /**
   * Đăng xuất một thiết bị cụ thể của chính mình.
   *
   * Thu hồi phiên KHÔNG thuộc về mình thì trả 404 y như phiên không tồn tại —
   * không nói cho người gọi biết mã phiên đó có thật hay không.
   */
  @Delete('me/sessions/:id')
  revokeOwnSession(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.auth.revokeOwnSession(req.user?.username ?? '', id);
  }

  /**
   * Cán bộ tự đổi mật khẩu của chính mình (trang Hồ sơ cá nhân).
   *
   * Không dùng `@RequirePermission`: đây là thao tác trên tài khoản của chính
   * người gọi, mọi vai trò đều phải làm được — kể cả vai trò không có quyền gì
   * trên phân hệ Người dùng. Danh tính lấy từ token, KHÔNG lấy từ thân yêu cầu,
   * nên không ai đổi được mật khẩu của người khác qua đây.
   */
  @Patch('me/password')
  @AllowPendingPassword()
  changeOwnPassword(@Body() dto: ChangeOwnPasswordDto, @Req() req: AuthedRequest) {
    return this.auth.changeOwnPassword(
      req.user?.username ?? '',
      dto.currentPassword,
      dto.newPassword,
      req.user?.sid,
    );
  }
}
