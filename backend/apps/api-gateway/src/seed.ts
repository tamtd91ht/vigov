/**
 * Seed dữ liệu khởi tạo: tài khoản cán bộ + cấu hình SLA + dữ liệu nghiệp vụ demo.
 * Chạy: npm run seed  (đọc cấu hình từ .env như ứng dụng chính)
 *
 * Cờ dòng lệnh:
 *   --fresh   XOÁ SẠCH các collection nghiệp vụ trước khi seed
 *             (giữ nguyên staff_users và sla_rules). Ví dụ: npm run seed -- --fresh
 *
 * Toàn bộ dữ liệu nghiệp vụ được upsert theo khoá tự nhiên (code / arrivalNo /
 * phone / title…) nên chạy lại nhiều lần KHÔNG nhân bản bản ghi.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  Article,
  type ArticleDocument,
  BlacklistRecord,
  type BlacklistRecordDocument,
  BudgetItem,
  type BudgetItemDocument,
  CitizenUser,
  type CitizenUserDocument,
  Feedback,
  type FeedbackDocument,
  IncomingDocument,
  type IncomingDocumentDocument,
  LoginSession,
  type LoginSessionDocument,
  SlaRule,
  type SlaRuleDocument,
  StaffUser,
  type StaffUserDocument,
  Task,
  type TaskDocument,
} from '@vigov/shared';
import { AppModule } from './app.module';
import {
  RadioBulletin,
  type RadioBulletinDocument,
  Video,
  type VideoDocument,
} from './modules/content/content.schema';
import { OrgNode, type OrgNodeDocument } from './modules/settings/schemas/org-node.schema';
import {
  MapLayer,
  type MapLayerDocument,
  MapPin,
  type MapPinDocument,
} from './modules/map/map.schema';

import { TASK_SEED } from './seed-data/tasks.seed';
import { DOCUMENT_SEED } from './seed-data/documents.seed';
import { FEEDBACK_SEED } from './seed-data/feedback.seed';
import { BUDGET_ITEM_SEED } from './seed-data/disbursement.seed';
import { ARTICLE_SEED, RADIO_BULLETIN_SEED, VIDEO_SEED } from './seed-data/content.seed';
import { BLACKLIST_SEED, CITIZEN_USER_SEED, LOGIN_SESSION_SEED } from './seed-data/users.seed';
import { ORG_NODE_SEED } from './seed-data/org.seed';
import { MAP_LAYER_SEED, MAP_PIN_SEED } from './seed-data/map.seed';

const BCRYPT_ROUNDS = 10;

/** Mật khẩu khởi tạo — bắt buộc đổi ngay sau lần đăng nhập đầu tiên */
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'ViGov@2026';

/**
 * Tài khoản quản trị rút gọn để đăng nhập nhanh khi phát triển và demo.
 * Mật khẩu mặc định rất yếu — production BẮT BUỘC đặt SEED_ADMIN_PASSWORD
 * (hoặc đổi mật khẩu ngay sau lần đăng nhập đầu tiên).
 */
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '123456';

/** Cờ xoá sạch dữ liệu nghiệp vụ trước khi seed */
const FRESH = process.argv.includes('--fresh');

/** Danh bạ cán bộ khởi tạo — khớp danh bạ mẫu của Web Quản trị */
const STAFF_SEED = [
  { username: ADMIN_USERNAME, displayName: 'Quản trị hệ thống', initials: 'QT', color: '#1B3A5C', department: 'Văn phòng UBND', roleKey: 'admin' },
  { username: 'binh.nv', displayName: 'Nguyễn Văn Bình', initials: 'NB', color: '#1B3A5C', department: 'Văn phòng UBND', roleKey: 'admin' },
  { username: 'hanh.tt', displayName: 'Trần Thị Hạnh', initials: 'TH', color: '#E91E8C', department: 'Văn phòng UBND', roleKey: 'leader' },
  { username: 'tuan.lm', displayName: 'Lê Minh Tuấn', initials: 'LT', color: '#3B82C4', department: 'Địa chính – Xây dựng', roleKey: 'officer' },
  { username: 'ngoc.pt', displayName: 'Phạm Thị Ngọc', initials: 'PN', color: '#8E44AD', department: 'Tư pháp – Hộ tịch', roleKey: 'officer' },
  { username: 'anh.vd', displayName: 'Vũ Đức Anh', initials: 'VA', color: '#27AE60', department: 'Văn hoá – Xã hội', roleKey: 'officer' },
  { username: 'ha.dt', displayName: 'Đỗ Thanh Hà', initials: 'ĐH', color: '#E67E22', department: 'Tài chính – Kế toán', roleKey: 'accountant' },
  { username: 'son.hv', displayName: 'Hoàng Văn Sơn', initials: 'HS', color: '#17A2A2', department: 'Công an xã', roleKey: 'officer' },
  { username: 'lan.nt', displayName: 'Ngô Thị Lan', initials: 'NL', color: '#E74C3C', department: 'Trung tâm Phục vụ hành chính công', roleKey: 'receptionist' },
  { username: 'khai.bq', displayName: 'Bùi Quang Khải', initials: 'BK', color: '#5B6C8F', department: 'Quân sự xã', roleKey: 'officer' },
];

/** SLA mặc định theo lĩnh vực phản ánh — đồng bộ admin-web/src/config/sla.config.ts */
const SLA_SEED = [
  { categoryKey: 'rac-thai', intakeDays: 4, resolveDays: 3, unit: 'ngày làm việc', warnBefore: 'Trước hạn 8 giờ' },
  { categoryKey: 'giao-thong', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 've-sinh-moi-truong', intakeDays: 4, resolveDays: 3, unit: 'ngày làm việc', warnBefore: 'Trước hạn 8 giờ' },
  { categoryKey: 'trat-tu-do-thi', intakeDays: 6, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 'an-ninh', intakeDays: 2, resolveDays: 2, unit: 'ngày làm việc', warnBefore: 'Trước hạn 4 giờ' },
  { categoryKey: 'xay-dung', intakeDays: 8, resolveDays: 7, unit: 'ngày làm việc', warnBefore: 'Trước hạn 24 giờ' },
  { categoryKey: 'can-bo', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 'dien-chieu-sang', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 'cap-thoat-nuoc', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 'dat-dai', intakeDays: 8, resolveDays: 7, unit: 'ngày làm việc', warnBefore: 'Trước hạn 24 giờ' },
  { categoryKey: 'y-te-giao-duc', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 'khac', intakeDays: 8, resolveDays: 7, unit: 'ngày làm việc', warnBefore: 'Trước hạn 24 giờ' },
];

/** Kết quả seed một nhóm dữ liệu */
interface GroupResult {
  label: string;
  inserted: number;
  total: number;
}

/**
 * Model dùng trong seed — chỉ cần updateOne/findOne/countDocuments nên bỏ ràng
 * buộc kiểu tài liệu để một hàm dùng chung được cho mọi collection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeedModel = Model<any>;

/**
 * Upsert theo khoá tự nhiên: bản ghi đã có thì giữ nguyên (không ghi đè
 * chỉnh sửa của người dùng), chưa có thì chèn mới.
 */
async function upsertGroup<TSeed extends object>(
  label: string,
  model: SeedModel,
  rows: TSeed[],
  keyOf: (row: TSeed) => Record<string, unknown>,
): Promise<GroupResult> {
  let inserted = 0;
  for (const row of rows) {
    const result = await model.updateOne(keyOf(row), { $setOnInsert: row }, { upsert: true }).exec();
    if (result.upsertedCount > 0) inserted++;
  }
  const total = await model.countDocuments().exec();
  return { label, inserted, total };
}

/**
 * Cây tổ chức phải chèn tuần tự vì `parentId` là _id thật của nút cha,
 * chỉ biết được sau khi nút cha đã nằm trong database.
 */
async function seedOrgTree(model: SeedModel): Promise<GroupResult> {
  const idByKey = new Map<string, string>();
  let inserted = 0;

  for (const node of ORG_NODE_SEED) {
    const parentId = node.parentKey ? idByKey.get(node.parentKey) : undefined;
    const result = await model
      .updateOne(
        { name: node.name },
        {
          $setOnInsert: {
            name: node.name,
            subtitle: node.subtitle,
            color: node.color,
            parentId,
            order: node.order,
          },
        },
        { upsert: true },
      )
      .exec();
    if (result.upsertedCount > 0) inserted++;

    const doc = await model.findOne({ name: node.name }).exec();
    if (doc) idByKey.set(node.key, String(doc._id));
  }

  const total = await model.countDocuments().exec();
  return { label: 'Cây tổ chức', inserted, total };
}

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

  const staffModel = app.get<Model<StaffUserDocument>>(getModelToken(StaffUser.name));
  const slaModel = app.get<Model<SlaRuleDocument>>(getModelToken(SlaRule.name));
  const taskModel = app.get<Model<TaskDocument>>(getModelToken(Task.name));
  const documentModel = app.get<Model<IncomingDocumentDocument>>(getModelToken(IncomingDocument.name));
  const feedbackModel = app.get<Model<FeedbackDocument>>(getModelToken(Feedback.name));
  const budgetModel = app.get<Model<BudgetItemDocument>>(getModelToken(BudgetItem.name));
  const articleModel = app.get<Model<ArticleDocument>>(getModelToken(Article.name));
  const videoModel = app.get<Model<VideoDocument>>(getModelToken(Video.name));
  const radioModel = app.get<Model<RadioBulletinDocument>>(getModelToken(RadioBulletin.name));
  const citizenModel = app.get<Model<CitizenUserDocument>>(getModelToken(CitizenUser.name));
  const blacklistModel = app.get<Model<BlacklistRecordDocument>>(getModelToken(BlacklistRecord.name));
  const sessionModel = app.get<Model<LoginSessionDocument>>(getModelToken(LoginSession.name));
  const orgModel = app.get<Model<OrgNodeDocument>>(getModelToken(OrgNode.name));
  const mapLayerModel = app.get<Model<MapLayerDocument>>(getModelToken(MapLayer.name));
  const mapPinModel = app.get<Model<MapPinDocument>>(getModelToken(MapPin.name));

  /* ── Tài khoản cán bộ ─────────────────────────────────────────────────── */

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  for (const staff of STAFF_SEED) {
    const passwordHash = staff.username === ADMIN_USERNAME ? adminHash : defaultHash;
    await staffModel
      .updateOne({ username: staff.username }, { $setOnInsert: { ...staff, passwordHash, status: 'active' } }, { upsert: true })
      .exec();
  }

  logger.log(`Đã tạo/giữ nguyên ${STAFF_SEED.length} tài khoản cán bộ:`);
  logger.log(`  • ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}  (Quản trị hệ thống — dùng để đăng nhập nhanh)`);
  logger.log(`  • 9 tài khoản cán bộ theo danh bạ xã, mật khẩu: ${DEFAULT_PASSWORD}`);
  logger.warn('Đổi mật khẩu ngay trước khi đưa lên môi trường thật.');

  /* ── Cấu hình SLA ─────────────────────────────────────────────────────── */

  for (const rule of SLA_SEED) {
    await slaModel.updateOne({ categoryKey: rule.categoryKey }, { $setOnInsert: rule }, { upsert: true }).exec();
  }
  logger.log(`Đã tạo/giữ nguyên ${SLA_SEED.length} cấu hình SLA lĩnh vực phản ánh`);

  /* ── Dữ liệu nghiệp vụ demo ───────────────────────────────────────────── */

  if (FRESH) {
    logger.warn('╔══════════════════════════════════════════════════════════════════╗');
    logger.warn('║  CỜ --fresh: XOÁ SẠCH toàn bộ dữ liệu nghiệp vụ trước khi seed!   ║');
    logger.warn('║  Nhiệm vụ, văn bản, phản ánh, ngân sách, CMS, công dân, phiên     ║');
    logger.warn('║  đăng nhập, danh sách chặn, cây tổ chức và bản đồ kinh tế số sẽ   ║');
    logger.warn('║  MẤT chỉnh sửa. Tài khoản cán bộ và cấu hình SLA giữ nguyên.      ║');
    logger.warn('╚══════════════════════════════════════════════════════════════════╝');

    const cleared = await Promise.all([
      taskModel.deleteMany({}).exec(),
      documentModel.deleteMany({}).exec(),
      feedbackModel.deleteMany({}).exec(),
      budgetModel.deleteMany({}).exec(),
      articleModel.deleteMany({}).exec(),
      videoModel.deleteMany({}).exec(),
      radioModel.deleteMany({}).exec(),
      citizenModel.deleteMany({}).exec(),
      blacklistModel.deleteMany({}).exec(),
      sessionModel.deleteMany({}).exec(),
      orgModel.deleteMany({}).exec(),
      mapLayerModel.deleteMany({}).exec(),
      mapPinModel.deleteMany({}).exec(),
    ]);
    const removed = cleared.reduce((sum, result) => sum + result.deletedCount, 0);
    logger.warn(`Đã xoá ${removed} bản ghi nghiệp vụ cũ.`);
  }

  const groups: GroupResult[] = [];

  groups.push(await upsertGroup('Nhiệm vụ', taskModel, TASK_SEED, (row) => ({ code: row.code })));
  groups.push(
    await upsertGroup('Văn bản & đơn thư', documentModel, DOCUMENT_SEED, (row) => ({ arrivalNo: row.arrivalNo })),
  );
  groups.push(await upsertGroup('Phản ánh người dân', feedbackModel, FEEDBACK_SEED, (row) => ({ code: row.code })));
  groups.push(await upsertGroup('Hạng mục ngân sách', budgetModel, BUDGET_ITEM_SEED, (row) => ({ code: row.code })));
  groups.push(await upsertGroup('Bài viết CMS', articleModel, ARTICLE_SEED, (row) => ({ title: row.title })));
  groups.push(await upsertGroup('Video tuyên truyền', videoModel, VIDEO_SEED, (row) => ({ title: row.title })));
  groups.push(
    await upsertGroup('Bản tin truyền thanh', radioModel, RADIO_BULLETIN_SEED, (row) => ({ title: row.title })),
  );
  groups.push(await upsertGroup('Công dân Mini App', citizenModel, CITIZEN_USER_SEED, (row) => ({ phone: row.phone })));
  groups.push(
    await upsertGroup('Phiên đăng nhập', sessionModel, LOGIN_SESSION_SEED, (row) => ({
      subject: row.subject,
      device: row.device,
    })),
  );
  groups.push(
    await upsertGroup('Danh sách chặn', blacklistModel, BLACKLIST_SEED, (row) => ({ subject: row.subject })),
  );
  groups.push(await seedOrgTree(orgModel));
  groups.push(await upsertGroup('Lớp bản đồ', mapLayerModel, MAP_LAYER_SEED, (row) => ({ key: row.key })));
  groups.push(await upsertGroup('Ghim bản đồ', mapPinModel, MAP_PIN_SEED, (row) => ({ name: row.name })));

  logger.log('Dữ liệu nghiệp vụ demo (thêm mới / tổng số bản ghi trong database):');
  const width = Math.max(...groups.map((group) => group.label.length));
  for (const group of groups) {
    logger.log(`  • ${group.label.padEnd(width)} : +${group.inserted} mới / ${group.total} bản ghi`);
  }
  const insertedTotal = groups.reduce((sum, group) => sum + group.inserted, 0);
  logger.log(
    insertedTotal === 0
      ? 'Không có bản ghi nào được thêm — dữ liệu demo đã đầy đủ (chạy lại không nhân bản).'
      : `Tổng cộng đã thêm mới ${insertedTotal} bản ghi nghiệp vụ.`,
  );

  await app.close();
}

void seed();
