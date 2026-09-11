/**
 * @vigov/shared — DTO, schema, guard, hợp đồng sự kiện dùng chung giữa các module.
 * Tên field thống nhất với admin-web/src/types/index.ts để FE chuyển từ mock
 * sang API thật không phải sửa mã.
 */
export { default as configuration } from './config/configuration';

export * from './auth/roles';
export * from './auth/jwt.guard';
export * from './auth/password-policy';
export * from './auth/session-registry';
export * from './auth/session-registry.module';
export * from './events/events';
export * from './zalo/me-info';

export * from './crypto/secret-box';
export * from './money/vnd';

export * from './dto/soft-delete.dto';
export * from './dto/list-query.dto';

/* Khuôn dùng chung v2 — thời gian dạng số, tham chiếu bằng id, nhật ký chuẩn hoá */
export * from './time/epoch';
export * from './schemas/soft-delete';
export * from './schemas/timestamped';
export * from './schemas/activity-log';
export * from './schemas/comment';
export * from './schemas/refs';

export * from './schemas/task.schema';
export * from './schemas/document.schema';
export * from './schemas/feedback.schema';
export * from './schemas/dossier.schema';
export * from './schemas/user.schema';
export * from './schemas/budget.schema';
export * from './schemas/misc.schema';
