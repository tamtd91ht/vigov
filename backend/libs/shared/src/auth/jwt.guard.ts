import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { hasPermission, type ModuleKey, type Permission } from './roles';
import { SessionRegistry } from './session-registry';

/** Payload JWT của cán bộ đăng nhập Web Quản trị */
export interface JwtPayload {
  sub: string;
  username: string;
  displayName: string;
  roleKey: string;
  department?: string;
  /** Mã phiên đăng nhập — dùng để thu hồi token trước hạn (P5-08) */
  sid?: string;
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

/** Đánh dấu endpoint không cần đăng nhập */
export const IS_PUBLIC_KEY = 'vigov:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Yêu cầu quyền tối thiểu trên một phân hệ */
export const REQUIRE_PERMISSION_KEY = 'vigov:requirePermission';
export const RequirePermission = (module: ModuleKey, permission: Permission) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { module, permission });

/** Xác thực JWT + kiểm tra quyền theo phân hệ (RBAC) */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly sessions: SessionRegistry,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Thiếu mã xác thực');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }
    req.user = payload;

    /*
     * Token hợp lệ về chữ ký vẫn có thể đã bị thu hồi (thu hồi phiên) hoặc chủ
     * tài khoản đã bị khoá — kiểm tra sổ phiên trước khi cho qua (P5-08).
     */
    if (payload.sid && !(await this.sessions.isActive(payload.sid))) {
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc tài khoản đã bị khoá');
    }

    const required = this.reflector.getAllAndOverride<{ module: ModuleKey; permission: Permission }>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required && !hasPermission(payload.roleKey, required.module, required.permission)) {
      throw new ForbiddenException('Tài khoản không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
