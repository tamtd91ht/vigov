import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '@vigov/shared';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Module Nhật ký thao tác (WBS #29, P3-29).
 * AuditInterceptor được đăng ký bằng APP_INTERCEPTOR ngay tại module này nên
 * có hiệu lực toàn ứng dụng mà không phải sửa app.module.ts.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
