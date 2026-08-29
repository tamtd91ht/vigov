import { Global, Module } from '@nestjs/common';
import { SessionRegistry } from './session-registry';

/**
 * Sổ phiên phải là MỘT thực thể duy nhất dùng chung giữa:
 * - `JwtAuthGuard` (đăng ký toàn cục bằng APP_GUARD ở AppModule) — bên đọc,
 * - `AuthModule` (đăng ký nguồn tra cứu) và `UsersModule` (xoá bộ nhớ đệm khi
 *   thu hồi phiên / khoá tài khoản) — bên ghi.
 *
 * Nếu mỗi module tự khai báo provider thì Nest tạo nhiều thực thể riêng, guard
 * sẽ đọc bộ nhớ đệm rỗng và việc thu hồi token mất tác dụng. Vì vậy gói vào một
 * module `@Global()` — import một lần ở AppModule là mọi nơi dùng chung.
 */
@Global()
@Module({
  providers: [SessionRegistry],
  exports: [SessionRegistry],
})
export class SessionRegistryModule {}
