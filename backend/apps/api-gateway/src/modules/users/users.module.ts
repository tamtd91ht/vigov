import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BlacklistRecord,
  BlacklistRecordSchema,
  CitizenUser,
  CitizenUserSchema,
  LoginSession,
  LoginSessionSchema,
  StaffUser,
  StaffUserSchema,
} from '@vigov/shared';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Module Người dùng & bảo mật — công dân, phiên đăng nhập, danh sách chặn, tài khoản cán bộ (WBS #11, P3-31). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CitizenUser.name, schema: CitizenUserSchema },
      { name: StaffUser.name, schema: StaffUserSchema },
      { name: LoginSession.name, schema: LoginSessionSchema },
      { name: BlacklistRecord.name, schema: BlacklistRecordSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
