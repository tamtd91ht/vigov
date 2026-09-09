/**
 * Backfill cờ xoá mềm `isDeleted` cho dữ liệu đã có (task chuẩn hoá xoá mềm).
 *
 * Chạy:  npm run backfill:is-deleted            (xem trước, KHÔNG ghi gì)
 *        npm run backfill:is-deleted -- --write (ghi thật)
 *
 * ## Vì sao cần script này
 *
 * Trước đây mỗi phân hệ tự lọc bằng `deletedAt: null`. Nay cả 4 phân hệ dùng cờ
 * `isDeleted` (xem `libs/shared/src/schemas/soft-delete.ts`). Bản ghi tạo trước
 * thay đổi này KHÔNG có trường `isDeleted`.
 *
 * Ứng dụng vẫn chạy đúng khi chưa backfill vì điều kiện lọc là `$ne: true` —
 * khớp cả tài liệu thiếu trường. Script này chỉ để dữ liệu sạch và để index trên
 * `isDeleted` phát huy tác dụng; KHÔNG bắt buộc chạy trước khi deploy.
 *
 * ## Quy tắc quy đổi
 *
 * `isDeleted = (deletedAt != null)` — bản ghi từng bị xoá mềm bằng cơ chế cũ
 * giữ nguyên trạng thái đã xoá, không bị "hồi sinh" ngoài ý muốn.
 *
 * Mặc định chạy ở chế độ XEM TRƯỚC: chỉ đếm và in ra, phải truyền `--write` mới
 * ghi. Đây là script sửa dữ liệu thật nên không để nó âm thầm ghi khi ai đó gõ
 * sai lệnh.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  BudgetItem,
  type BudgetItemDocument,
  CitizenUser,
  type CitizenUserDocument,
  IncomingDocument,
  type IncomingDocumentDocument,
  Task,
  type TaskDocument,
} from '@vigov/shared';
import { AppModule } from './app.module';

/** Các collection có xoá mềm — thêm phân hệ mới thì bổ sung vào đây */
const TARGETS = [
  { label: 'Nhiệm vụ (tasks)', token: Task.name },
  { label: 'Văn bản (documents)', token: IncomingDocument.name },
  { label: 'Công dân (citizen_users)', token: CitizenUser.name },
  { label: 'Hạng mục ngân sách (budget_items)', token: BudgetItem.name },
] as const;

type AnyDoc = TaskDocument | IncomingDocumentDocument | CitizenUserDocument | BudgetItemDocument;

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const logger = new Logger('BackfillIsDeleted');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    logger.log(
      write
        ? 'Chế độ GHI THẬT — sẽ cập nhật cờ isDeleted'
        : 'Chế độ XEM TRƯỚC — không ghi gì. Thêm "-- --write" để ghi thật.',
    );

    let totalAlive = 0;
    let totalDeleted = 0;

    for (const { label, token } of TARGETS) {
      const model = app.get<Model<AnyDoc>>(getModelToken(token));

      // Bản ghi chưa có cờ: thiếu hẳn trường HOẶC đang null
      const missing: Record<string, unknown> = { isDeleted: { $in: [null, undefined] } };

      // Trong số đó, bản nào từng bị xoá mềm theo cơ chế cũ (`deletedAt` có giá trị)
      const wasDeleted = { ...missing, deletedAt: { $ne: null } };
      const wasAlive = { ...missing, deletedAt: null };

      const [needDeleted, needAlive] = await Promise.all([
        model.countDocuments(wasDeleted).exec(),
        model.countDocuments(wasAlive).exec(),
      ]);

      if (needDeleted + needAlive === 0) {
        logger.log(`${label}: không có bản ghi nào cần backfill`);
        continue;
      }

      logger.log(
        `${label}: ${needAlive} bản ghi → isDeleted=false, ${needDeleted} bản ghi → isDeleted=true`,
      );

      if (write) {
        // Hai lượt riêng để không đặt sai cờ cho bản ghi đã bị xoá mềm trước đây
        if (needAlive > 0) await model.updateMany(wasAlive, { $set: { isDeleted: false } }).exec();
        if (needDeleted > 0) {
          await model.updateMany(wasDeleted, { $set: { isDeleted: true } }).exec();
        }
      }

      totalAlive += needAlive;
      totalDeleted += needDeleted;
    }

    const summary = `Tổng: ${totalAlive} bản ghi còn hiệu lực, ${totalDeleted} bản ghi đã xoá mềm`;
    logger.log(write ? `${summary} — ĐÃ CẬP NHẬT` : `${summary} — chưa ghi (chế độ xem trước)`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  new Logger('BackfillIsDeleted').error('Backfill thất bại', err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
