/**
 * Di trú phân hệ Giải ngân: tiền từ "tỷ đồng số thực" sang "ĐỒNG số nguyên".
 *
 * Chạy:  npm run migrate:budget-dong             (XEM TRƯỚC, không ghi gì)
 *        npm run migrate:budget-dong -- --write  (ghi thật)
 *
 * ## Vì sao phải di trú
 *
 * Mô hình cũ lưu `planned` / `actual` là số thực đơn vị tỷ đồng và làm tròn 2
 * chữ số thập phân — tức là làm tròn tới 10 triệu đồng. Số tiền của từng giao
 * dịch lưu dạng CHUỖI tự do (`amount: "1,25 tỷ"`). Cả hai đều không dùng được
 * cho số liệu quyết toán. Mô hình mới: mọi trường tiền là số nguyên đơn vị đồng
 * (`*Dong`) — xem `libs/shared/src/money/vnd.ts`.
 *
 * ## ⚠ ĐIỀU KHÔNG PHỤC HỒI ĐƯỢC
 *
 * Phần tiền đã bị làm tròn mất trong mô hình cũ thì KHÔNG lấy lại được từ CSDL.
 * Script chỉ chuyển đúng những gì còn lưu. Sau khi chạy, kế toán PHẢI đối chiếu
 * lại luỹ kế của từng hạng mục với sổ kế toán và chứng từ giấy; chỗ lệch thì
 * dùng chức năng "Điều chỉnh dự toán" hoặc ghi giao dịch hoàn trả để chỉnh, chứ
 * không sửa trực tiếp trong CSDL.
 *
 * ## Quy tắc quy đổi
 *
 * | Trường cũ | Trường mới | Cách quy đổi |
 * |---|---|---|
 * | `planned` (tỷ) | `initialPlannedDong`, `plannedDong` | × 1.000.000.000, làm tròn tới đồng |
 * | `actual` (tỷ) | `actualDong` | tính LẠI từ tổng `entries`, không lấy số cũ |
 * | `entries[].amount` (chuỗi) | `entries[].amountDong` | đọc chuỗi + đơn vị |
 * | `requests[].amountTyDong` | `requests[].amountDong` | × 1.000.000.000 |
 * | `delayed` (bool) | — | bỏ; tình trạng tiến độ nay tính lại mỗi lần đọc |
 *
 * `actualDong` tính lại từ `entries` thay vì quy đổi `actual` cũ: đó là cách duy
 * nhất để luỹ kế khớp đúng tổng chứng từ. Nếu số cũ lệch tổng chứng từ, script
 * in ra cảnh báo cho từng hạng mục để kế toán rà.
 *
 * Mặc định XEM TRƯỚC. Đây là script sửa dữ liệu thật nên không âm thầm ghi.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { BudgetItem, formatVnd, tyDongToVnd, type BudgetItemDocument } from '@vigov/shared';
import { AppModule } from './app.module';

const logger = new Logger('MigrateBudgetToDong');

/** Bản ghi cũ — các trường không còn trong schema nên phải khai tay */
interface LegacyBudgetItem {
  code: string;
  name?: string;
  planned?: number;
  actual?: number;
  delayed?: boolean;
  initialPlannedDong?: number;
  plannedDong?: number;
  actualDong?: number;
  approvalStatus?: string;
  entries?: {
    amount?: string;
    amountDong?: number;
    type?: string;
    date?: string;
    content?: string;
  }[];
  requests?: { code?: string; amount?: string; amountTyDong?: number; amountDong?: number }[];
}

/**
 * Đọc số tiền dạng chuỗi của mô hình cũ về đồng.
 *
 * Dấu CHẤM là phân cách nghìn, dấu PHẨY là thập phân (chuẩn Việt Nam). Không
 * nhận diện được đơn vị thì coi là tỷ đồng — đúng như hành vi của mã cũ, để số
 * quy đổi khớp với những gì hệ thống cũ đã tính.
 */
export function legacyAmountToDong(raw: string): number | null {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return null;

  const numberPart = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(numberPart);
  if (!Number.isFinite(value)) return null;

  let factor = 1_000_000_000; // mặc định: tỷ đồng
  if (/(triệu|trieu|tr\b)/.test(text)) factor = 1_000_000;
  else if (/(nghìn|nghin|ngàn|ngan|k\b)/.test(text)) factor = 1_000;
  else if (/(đồng|dong|vnđ|vnd)/.test(text) && !/(tỷ|ty\b)/.test(text)) factor = 1;

  return Math.round(value * factor);
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const model = app.get<Model<BudgetItemDocument>>(getModelToken(BudgetItem.name));
    // `lean()` + kiểu tay: bản ghi cũ có trường không còn trong schema
    const items = (await model.find().lean().exec()) as unknown as LegacyBudgetItem[];

    logger.log(`Tìm thấy ${items.length} hạng mục trong collection budget_items`);
    if (items.length === 0) {
      logger.log('Không có gì để di trú.');
      return;
    }

    let needMigrate = 0;
    let unreadable = 0;
    const mismatches: string[] = [];
    const updates: { code: string; set: Record<string, unknown>; unset: Record<string, unknown> }[] =
      [];

    for (const item of items) {
      const alreadyDone =
        item.plannedDong !== undefined && item.planned === undefined && item.actual === undefined;
      if (alreadyDone) continue;
      needMigrate += 1;

      const plannedDong = tyDongToVnd(item.planned ?? 0);

      // Quy đổi từng giao dịch
      const entries = (item.entries ?? []).map((entry) => {
        const converted =
          entry.amountDong !== undefined
            ? Math.trunc(entry.amountDong)
            : legacyAmountToDong(entry.amount ?? '');
        if (converted === null) unreadable += 1;
        return {
          ...entry,
          type: entry.type ?? 'chi',
          amountDong: converted ?? 0,
          amount: undefined,
        };
      });

      const actualFromEntries = entries.reduce(
        (sum, e) => sum + (e.type === 'hoan-tra' ? -e.amountDong : e.amountDong),
        0,
      );
      const actualFromOldField = tyDongToVnd(item.actual ?? 0);
      if (actualFromEntries !== actualFromOldField) {
        mismatches.push(
          `  ${item.code} — luỹ kế cũ ${formatVnd(actualFromOldField)} ` +
            `≠ tổng chứng từ ${formatVnd(actualFromEntries)} ` +
            `(lệch ${formatVnd(Math.abs(actualFromOldField - actualFromEntries))})`,
        );
      }

      const requests = (item.requests ?? []).map((request) => ({
        ...request,
        amountDong:
          request.amountDong !== undefined
            ? Math.trunc(request.amountDong)
            : tyDongToVnd(request.amountTyDong ?? 0),
        amount: undefined,
        amountTyDong: undefined,
      }));

      updates.push({
        code: item.code,
        set: {
          initialPlannedDong: plannedDong,
          plannedDong,
          actualDong: actualFromEntries,
          entries,
          requests,
          /* Dữ liệu cũ đều là hạng mục đang vận hành thật nên coi như ĐÃ PHÊ
             DUYỆT — để trạng thái Nháp thì mọi hạng mục cũ đột nhiên không ghi
             nhận được giao dịch nào. */
          approvalStatus: item.approvalStatus ?? 'da-duyet',
        },
        unset: { planned: '', actual: '', delayed: '' },
      });
    }

    logger.log(`Cần di trú: ${needMigrate} hạng mục`);
    if (unreadable > 0) {
      logger.warn(
        `⚠ ${unreadable} giao dịch có số tiền KHÔNG đọc được, sẽ ghi 0 đồng. ` +
          'Phải nhập lại tay các giao dịch này sau khi di trú.',
      );
    }
    if (mismatches.length > 0) {
      logger.warn(
        `⚠ ${mismatches.length} hạng mục có luỹ kế cũ LỆCH tổng chứng từ. Script lấy tổng ` +
          'chứng từ làm chuẩn; kế toán phải đối chiếu lại với sổ:',
      );
      mismatches.forEach((line) => logger.warn(line));
    }

    if (!write) {
      logger.log('');
      logger.log('=== CHẾ ĐỘ XEM TRƯỚC — chưa ghi gì vào cơ sở dữ liệu ===');
      logger.log('Đã sao lưu bằng deploy/backup-mongo.sh chưa? Nếu chưa, sao lưu TRƯỚC.');
      logger.log('Chạy thật:  npm run migrate:budget-dong -- --write');
      return;
    }

    logger.warn('=== GHI THẬT vào cơ sở dữ liệu ===');
    let done = 0;
    for (const update of updates) {
      await model
        .updateOne({ code: update.code }, { $set: update.set, $unset: update.unset })
        .exec();
      done += 1;
    }
    logger.log(`Đã di trú ${done}/${needMigrate} hạng mục sang đơn vị đồng.`);
    logger.warn(
      'VIỆC TIẾP THEO: kế toán đối chiếu luỹ kế từng hạng mục với sổ kế toán và chứng từ giấy.',
    );
  } finally {
    await app.close();
  }
}

void main();
