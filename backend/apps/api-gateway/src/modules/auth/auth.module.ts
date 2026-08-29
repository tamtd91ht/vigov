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
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionRegistryProvider],
  exports: [AuthService],
})
export class AuthModule {}
