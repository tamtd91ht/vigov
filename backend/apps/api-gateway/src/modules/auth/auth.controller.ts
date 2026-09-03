import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public, type AuthedRequest } from '@vigov/shared';
import { AuthService } from './auth.service';
import { RequestOtpDto, StaffLoginDto, VerifyOtpDto, ZaloIdentifyDto } from './dto/auth.dto';

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

  /** Công dân yêu cầu mã OTP (app Flutter) */
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

  /** Thông tin phiên hiện tại */
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return req.user;
  }
}
