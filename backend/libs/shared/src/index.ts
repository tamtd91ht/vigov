/**
 * @vigov/shared — DTO, schema, guard, hợp đồng sự kiện dùng chung giữa các module.
 * Tên field thống nhất với admin-web/src/types/index.ts để FE chuyển từ mock
 * sang API thật không phải sửa mã.
 */
export { default as configuration } from './config/configuration';

export * from './auth/roles';
export * from './auth/jwt.guard';
export * from './auth/session-registry';
export * from './auth/session-registry.module';
export * from './events/events';

export * from './schemas/task.schema';
export * from './schemas/document.schema';
export * from './schemas/feedback.schema';
export * from './schemas/user.schema';
export * from './schemas/misc.schema';
