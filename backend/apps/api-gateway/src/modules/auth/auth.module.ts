import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CitizenUser,
  CitizenUserSchema,
  LoginSession,
  LoginSessionSchema,
  StaffUser,
  StaffUserSchema,
} from '@vigov/shared';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRegistryProvider } from './session-registry.provider';

/** Xác thực cán bộ (Web Quản trị) và công dân (app / Zalo Mini App) */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StaffUser.name, schema: StaffUserSchema },
      { name: CitizenUser.name, schema: CitizenUserSchema },
      { name: LoginSession.name, schema: LoginSessionSchema },
    ]),
    /* Đổi mật khẩu của chính mình dùng lại UsersService.revokeOtherSessions —
       cùng một cơ chế thu hồi phiên với trang Bảo mật, không viết lại. */
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionRegistryProvider],
  exports: [AuthService],
})
export class AuthModule {}
