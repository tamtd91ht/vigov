/**
 * Xoá thư mục build/cache của các module.
 *
 *   npm run clean
 *
 * Dùng khi gặp lỗi lạ lúc type-check hoặc chạy dev — thường do cache sinh dở
 * khi tắt server đột ngột (ví dụ `.next/dev/types/validator.ts` bị cắt giữa chừng
 * làm `tsc --noEmit` báo lỗi ở file không hề do mình viết).
 *
 * KHÔNG xoá node_modules — cài lại bằng `npm run install:all` nếu cần.
 */
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const TARGETS = [
  'admin-web/.next',
  'admin-web/tsconfig.tsbuildinfo',
  'backend/dist',
  'zalo-miniapp/dist',
  'zalo-miniapp/node_modules/.vite',
  'zalo-miniapp/node_modules/.tmp',
  'mobile/build',
  'mobile/.dart_tool',
];

let removed = 0;
for (const target of TARGETS) {
  const full = path.join(ROOT, target);
  if (!existsSync(full)) continue;
  rmSync(full, { recursive: true, force: true });
  console.log(`đã xoá  ${target}`);
  removed += 1;
}

console.log(removed === 0 ? 'Không có gì để dọn.' : `\nDọn xong ${removed} mục.`);
