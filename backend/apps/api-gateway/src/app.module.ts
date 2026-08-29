import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule, type JwtModuleOptions, type JwtSignOptions } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configuration, JwtAuthGuard, SessionRegistryModule } from '@vigov/shared';

import { AuthModule } from './modules/auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { DisbursementModule } from './modules/disbursement/disbursement.module';
import { ContentModule } from './modules/content/content.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SearchModule } from './modules/search/search.module';
import { AuditModule } from './modules/audit/audit.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationModule } from './modules/notification/notification.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MapModule } from './modules/map/map.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthController } from './health.controller';

/**
 * API Gateway — gom các module vertical slice theo phân hệ.
 * Mọi cấu hình đọc qua ConfigService (libs/shared/config/configuration.ts).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    // Sổ phiên dùng chung cho guard toàn cục, AuthModule và UsersModule (P5-08)
    SessionRegistryModule,

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>('mongo.uri') }),
    }),

    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: config.get<string>('auth.jwtExpiresIn', '8h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('security.throttleTtlSeconds', 60) * 1000,
            limit: config.get<number>('security.throttleLimit', 120),
          },
        ],
      }),
    }),

    ScheduleModule.forRoot(),

    // Hàng đợi RabbitMQ (P5-04) — kết nối chạy nền, broker chết không chặn khởi động
    MessagingModule,

    AuthModule,
    TasksModule,
    DocumentsModule,
    FeedbackModule,
    DisbursementModule,
    ContentModule,
    UsersModule,
    SettingsModule,
    SearchModule,
    AuditModule,
    FilesModule,
    NotificationModule,
    WorkflowModule,
    ReportsModule,
    IntegrationsModule,
    MapModule,
    CatalogsModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
