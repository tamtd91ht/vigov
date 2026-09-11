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
  OrgNode, type OrgNodeDocument,
  checkPasswordPolicy
} from '@vigov/shared';
import {
  Article,
  type ArticleDocument,
  BlacklistRecord,
  type BlacklistRecordDocument,
  BudgetItem,
  type BudgetItemDocument,
  CitizenUser,
  type CitizenUserDocument,
  Dossier,
  type DossierDocument,
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
import {
  MapLayer,
  type MapLayerDocument,
  MapPin,
  type MapPinDocument,
} from './modules/map/map.schema';

import { TASK_SEED } from './seed-data/tasks.seed';
import { DOCUMENT_SEED } from './seed-data/documents.seed';
import { FEEDBACK_SEED } from './seed-data/feedback.seed';
import { DOSSIER_SEED } from './seed-data/dossiers.seed';
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
            isDepartment: node.isDepartment ?? false,
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

/**
 * Quy đổi tham chiếu của dữ liệu seed từ TÊN sang ID — nâng cấp v2.
 *
 * Tệp seed viết tên cán bộ và tên bộ phận cho người đọc; cơ sở dữ liệu lưu id.
 * Bước quy đổi nằm ở đây chứ không trong từng tệp seed, vì id chỉ có sau khi cây
 * tổ chức và danh bạ đã được chèn.
 *
 * Tên không tra được thì **không đoán**: id để rỗng và tên gốc được giữ ở
 * `legacyRefs`, đúng quy ước của `SoftDeletable.legacyRefs`. Seed chạy trên máy
 * phát triển nên chuyện này chỉ xảy ra khi ai đó sửa tên trong một tệp mà quên
 * tệp kia — và lúc đó phải nhìn ra được, không được im lặng bỏ qua.
 */
function mapRefs<T extends Record<string, unknown>>(
  rows: T[],
  staffIdByName: Map<string, string>,
  deptIdByName: Map<string, string>,
  fields: { staff?: string[]; staffList?: string[]; dept?: string[] },
  logger: Logger,
): Record<string, unknown>[] {
  const missing = new Set<string>();

  const tra = (bang: Map<string, string>, ten: unknown): string | undefined => {
    if (typeof ten !== 'string' || !ten.trim()) return undefined;
    const id = bang.get(ten.trim());
    if (!id) missing.add(ten.trim());
    return id;
  };

  const mapped = rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    const legacy: Record<string, string> = {};

    for (const field of fields.staff ?? []) {
      const id = tra(staffIdByName, row[field]);
      delete out[field];
      out[`${field}Id`] = id ?? '';
      if (!id && row[field]) legacy[field] = String(row[field]);
    }
    for (const field of fields.dept ?? []) {
      const id = tra(deptIdByName, row[field]);
      delete out[field];
      out[`${field}Id`] = id ?? '';
      if (!id && row[field]) legacy[field] = String(row[field]);
    }
    for (const field of fields.staffList ?? []) {
      const names = (row[field] ?? []) as string[];
      delete out[field];
      out[`${field.replace(/s$/, '')}Ids`] = names
        .map((ten) => tra(staffIdByName, ten))
        .filter((id): id is string => !!id);
    }

    if (Object.keys(legacy).length > 0) out.legacyRefs = legacy;
    return out;
  });

  if (missing.size > 0) {
    logger.warn(
      `Không tra được id cho ${missing.size} tên trong dữ liệu seed, đã giữ tên gốc ở legacyRefs: ` +
        [...missing].join(', '),
    );
  }
  return mapped;
}

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

  const staffModel = app.get<Model<StaffUserDocument>>(getModelToken(StaffUser.name));
  const slaModel = app.get<Model<SlaRuleDocument>>(getModelToken(SlaRule.name));
  const taskModel = app.get<Model<TaskDocument>>(getModelToken(Task.name));
  const documentModel = app.get<Model<IncomingDocumentDocument>>(getModelToken(IncomingDocument.name));
  const feedbackModel = app.get<Model<FeedbackDocument>>(getModelToken(Feedback.name));
  const dossierModel = app.get<Model<DossierDocument>>(getModelToken(Dossier.name));
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

  /* ── Cây tổ chức ──────────────────────────────────────────────────────── */

  /*
   * Chèn TRƯỚC mọi thứ khác. Từ v2, cả tài khoản cán bộ lẫn hồ sơ nghiệp vụ đều
   * trỏ tới bộ phận bằng `org_nodes._id`, nên danh mục bộ phận phải có trước.
   *
   * `--fresh` xoá `org_nodes` ở bước dưới rồi chèn lại, nên bước này gọi hai
   * lần là bình thường: `seedOrgTree` dùng upsert theo tên, chạy lại không nhân
   * bản nút nào.
   */
  const orgResult = await seedOrgTree(orgModel);

  /* ── Tài khoản cán bộ ─────────────────────────────────────────────────── */

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  /* Bảng tra id bộ phận cho tài khoản cán bộ */
  const deptIdForStaff = new Map(
    (await orgModel.find({}, 'name').lean().exec()).map((row) => [row.name, String(row._id)]),
  );

  for (const staff of STAFF_SEED) {
    const { department, ...rest } = staff;
    const departmentId = deptIdForStaff.get(department) ?? '';
    if (!departmentId) {
      logger.warn(`Tài khoản ${staff.username}: không tra được bộ phận "${department}"`);
    }
    const passwordHash = staff.username === ADMIN_USERNAME ? adminHash : defaultHash;
    await staffModel
      .updateOne({ username: staff.username }, { $setOnInsert: { ...rest, departmentId, passwordHash, status: 'active' } }, { upsert: true })
      .exec();
  }

  logger.log(`Đã tạo/giữ nguyên ${STAFF_SEED.length} tài khoản cán bộ:`);
  logger.log(`  • ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}  (Quản trị hệ thống — dùng để đăng nhập nhanh)`);
  logger.log(`  • 9 tài khoản cán bộ theo danh bạ xã, mật khẩu: ${DEFAULT_PASSWORD}`);
  logger.warn('Đổi mật khẩu ngay trước khi đưa lên môi trường thật.');

  /*
   * Seed ghi thẳng passwordHash nên KHÔNG đi qua chính sách mật khẩu (T-10) —
   * cố tình, để bản demo giữ được tài khoản đăng nhập nhanh. Nhưng phải nói rõ
   * khi mật khẩu seed không đạt chuẩn, nếu không người triển khai sẽ tưởng
   * mình đã có một tài khoản hợp lệ, rồi tới lúc chính chủ đổi mật khẩu mới
   * phát hiện mật khẩu hiện tại không thể đặt lại được.
   */
  for (const [label, password] of [
    [`tài khoản quản trị ${ADMIN_USERNAME}`, ADMIN_PASSWORD],
    ['9 tài khoản cán bộ', DEFAULT_PASSWORD],
  ] as const) {
    const problem = checkPasswordPolicy(password);
    if (problem) {
      logger.warn(`Mật khẩu seed của ${label} KHÔNG đạt chính sách hiện hành: ${problem}`);
    }
  }

  /* ── Cấu hình SLA ─────────────────────────────────────────────────────── */

  for (const rule of SLA_SEED) {
    await slaModel.updateOne({ categoryKey: rule.categoryKey }, { $setOnInsert: rule }, { upsert: true }).exec();
  }
  logger.log(`Đã tạo/giữ nguyên ${SLA_SEED.length} cấu hình SLA lĩnh vực phản ánh`);

  /* ── Dữ liệu nghiệp vụ demo ───────────────────────────────────────────── */

  if (FRESH) {
    logger.warn('╔══════════════════════════════════════════════════════════════════╗');
    logger.warn('║  CỜ --fresh: XOÁ SẠCH toàn bộ dữ liệu nghiệp vụ trước khi seed!   ║');
    logger.warn('║  Nhiệm vụ, văn bản, phản ánh, hồ sơ một cửa, ngân sách, CMS,      ║');
    logger.warn('║  công dân, phiên đăng nhập, danh sách chặn, cây tổ chức và bản    ║');
    logger.warn('║  đồ kinh tế số sẽ MẤT chỉnh sửa. Tài khoản cán bộ và cấu hình    ║');
    logger.warn('║  SLA giữ nguyên.                                                  ║');
    logger.warn('╚══════════════════════════════════════════════════════════════════╝');

    const cleared = await Promise.all([
      taskModel.deleteMany({}).exec(),
      documentModel.deleteMany({}).exec(),
      feedbackModel.deleteMany({}).exec(),
      dossierModel.deleteMany({}).exec(),
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

  /* `--fresh` vừa xoá cây tổ chức ở trên nên phải dựng lại trước khi quy đổi
     tham chiếu của dữ liệu nghiệp vụ */
  groups.push(FRESH ? await seedOrgTree(orgModel) : orgResult);

  // Hai bảng tra tên → id cho bước quy đổi tham chiếu của dữ liệu seed
  const staffIdByName = new Map(
    (await staffModel.find({}, 'displayName').lean().exec()).map((row) => [
      row.displayName,
      String(row._id),
    ]),
  );
  const deptIdByName = new Map(
    (await orgModel.find({}, 'name').lean().exec()).map((row) => [row.name, String(row._id)]),
  );

  groups.push(
    await upsertGroup(
      'Nhiệm vụ',
      taskModel,
      mapRefs(
        TASK_SEED,
        staffIdByName,
        deptIdByName,
        { staff: ['assignee', 'assigner'], staffList: ['collaborators'], dept: ['department'] },
        logger,
      ),
      (row) => ({ code: row.code }),
    ),
  );
  groups.push(
    await upsertGroup(
      'Văn bản & đơn thư',
      documentModel,
      mapRefs(DOCUMENT_SEED, staffIdByName, deptIdByName, { dept: ['department'] }, logger),
      (row) => ({ arrivalNo: row.arrivalNo }),
    ),
  );
  groups.push(
    await upsertGroup(
      'Phản ánh người dân',
      feedbackModel,
      mapRefs(
        FEEDBACK_SEED,
        staffIdByName,
        deptIdByName,
        { staff: ['assignee'], dept: ['department'] },
        logger,
      ),
      (row) => ({ code: row.code }),
    ),
  );
  groups.push(
    await upsertGroup(
      'Hồ sơ một cửa',
      dossierModel,
      mapRefs(
        DOSSIER_SEED,
        staffIdByName,
        deptIdByName,
        { staff: ['assignee'], dept: ['department'] },
        logger,
      ),
      (row) => ({ code: row.code }),
    ),
  );
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
