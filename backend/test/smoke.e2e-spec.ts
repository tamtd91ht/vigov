/**
 * Smoke test đầu-cuối: khởi động API Gateway với MongoDB in-memory,
 * seed tài khoản cán bộ rồi gọi thử các luồng chính của Phase 1.
 *
 * Chạy: npm run test:e2e
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { SlaRule, type SlaRuleDocument, StaffUser, type StaffUserDocument } from '@vigov/shared';

const ADMIN = { username: 'binh.nv', password: 'ViGov@2026' };
const CITIZEN_PHONE = '0987654321';
const TEST_TIMEOUT_MS = 180_000;

jest.setTimeout(TEST_TIMEOUT_MS);

describe('ViGov API — smoke Phase 1', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let staffToken: string;
  let citizenToken: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vigov-test');
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';

    // Import sau khi đặt biến môi trường để ConfigModule đọc đúng URI
    const { AppModule } = await import('../apps/api-gateway/src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Cấu hình giống main.ts để đường dẫn khớp môi trường thật
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    // forbidNonWhitelisted đồng bộ với main.ts sau khi siết bảo mật (P4-36):
    // yêu cầu chứa trường lạ bị từ chối 400 thay vì âm thầm bỏ qua
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    // Seed tài khoản cán bộ + SLA tối thiểu cho luồng phản ánh
    const staffModel = app.get<Model<StaffUserDocument>>(getModelToken(StaffUser.name));
    await staffModel.create({
      username: ADMIN.username,
      passwordHash: await bcrypt.hash(ADMIN.password, 10),
      displayName: 'Nguyễn Văn Bình',
      initials: 'NB',
      color: '#1B3A5C',
      department: 'Văn phòng UBND',
      roleKey: 'admin',
      status: 'active',
    });

    const slaModel = app.get<Model<SlaRuleDocument>>(getModelToken(SlaRule.name));
    await slaModel.create({
      categoryKey: 'giao-thong',
      intakeDays: 4,
      resolveDays: 5,
      unit: 'ngày làm việc',
      warnBefore: 'Trước hạn 12 giờ',
    });
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const api = () => request(app.getHttpServer());

  it('chặn truy cập khi chưa đăng nhập', async () => {
    await api().get('/api/v1/tasks').expect(401);
  });

  it('cán bộ đăng nhập được và nhận JWT', async () => {
    const res = await api().post('/api/v1/auth/staff/login').send(ADMIN).expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.roleKey).toBe('admin');
    staffToken = res.body.accessToken;
  });

  it('từ chối sai mật khẩu', async () => {
    await api()
      .post('/api/v1/auth/staff/login')
      .send({ username: ADMIN.username, password: 'sai-mat-khau' })
      .expect(401);
  });

  it('tạo và đọc lại nhiệm vụ', async () => {
    const created = await api()
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Rà soát quỹ đất công ích năm 2026',
        assignee: 'Lê Minh Tuấn',
        department: 'Địa chính – Xây dựng',
        deadline: '30/09/2026',
        priority: 'cao',
        description: 'Rà soát, thống kê toàn bộ diện tích đất công ích trên địa bàn xã.',
        checklist: [{ title: 'Trích lục hồ sơ địa chính' }, { title: 'Đo đạc hiện trạng' }],
      })
      .expect(201);

    expect(created.body.code).toMatch(/^NV-\d+$/);

    const list = await api().get('/api/v1/tasks').set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(list.body.total).toBe(1);

    // Tick việc con đầu tiên → tiến độ 50%
    const toggled = await api()
      .patch(`/api/v1/tasks/${created.body.code}/checklist/0`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ done: true })
      .expect(200);
    expect(toggled.body.progress).toBe(50);
  });

  it('tiếp nhận văn bản đến và cấp số đến', async () => {
    const res = await api()
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        refNo: '214/UBND-VP',
        date: '08/08/2026',
        sender: 'UBND huyện Phú Xuyên',
        summary: 'V/v báo cáo kết quả quản lý, sử dụng đất công ích trên địa bàn',
        docType: 'Công văn',
        kind: 'incoming',
        department: 'Địa chính – Xây dựng',
        deadline: '19/09/2026',
      })
      .expect(201);
    expect(res.body.arrivalNo).toBeDefined();
  });

  it('công dân định danh bằng OTP rồi gửi phản ánh', async () => {
    await api().post('/api/v1/auth/citizen/otp/request').send({ phone: CITIZEN_PHONE }).expect(201);

    // Lấy mã OTP từ AuthService (Phase 1 chưa gửi SMS thật)
    const { AuthService } = await import('../apps/api-gateway/src/modules/auth/auth.service');
    const auth = app.get(AuthService);
    const otpStore = (auth as unknown as { otpStore: Map<string, { code: string }> }).otpStore;
    const otp = otpStore.get(CITIZEN_PHONE)?.code;
    expect(otp).toBeDefined();

    const verified = await api()
      .post('/api/v1/auth/citizen/otp/verify')
      .send({ phone: CITIZEN_PHONE, otp })
      .expect(201);
    citizenToken = verified.body.accessToken;
    expect(citizenToken).toBeDefined();

    const feedback = await api()
      .post('/api/v1/feedback/citizen')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        categoryKey: 'giao-thong',
        title: 'Ổ gà lớn đường liên thôn Đoài – Trung',
        description: 'Đoạn đường dài khoảng 60m xuất hiện nhiều ổ gà sâu, nước đọng.',
        location: 'Thôn Đoài, Xã Đại Thắng',
        channel: 'app',
      })
      .expect(201);
    expect(feedback.body.code).toMatch(/^#PA-\d{4}-\d{4}$/);

    const mine = await api()
      .get('/api/v1/feedback/citizen/mine')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(200);
    expect(mine.body.items).toHaveLength(1);
  });

  it('công dân không xem được danh sách quản trị', async () => {
    await api().get('/api/v1/tasks').set('Authorization', `Bearer ${citizenToken}`).expect(403);
  });

  it('cán bộ thấy phiếu phản ánh vừa gửi và thống kê', async () => {
    const list = await api().get('/api/v1/feedback').set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(list.body.total).toBe(1);

    await api().get('/api/v1/feedback/stats').set('Authorization', `Bearer ${staffToken}`).expect(200);
  });

  it('tìm kiếm toàn cục trả kết quả xuyên phân hệ', async () => {
    const res = await api()
      .get('/api/v1/search')
      .query({ q: 'đất công ích' })
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('trả cấu hình SLA và danh sách vai trò', async () => {
    const sla = await api().get('/api/v1/settings/sla').set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(Array.isArray(sla.body.rules)).toBe(true);
    expect(sla.body.rules.some((r: { categoryKey: string }) => r.categoryKey === 'giao-thong')).toBe(true);

    await api().get('/api/v1/settings/roles').set('Authorization', `Bearer ${staffToken}`).expect(200);
  });

  it('nội dung công khai cho app công dân không cần đăng nhập', async () => {
    await api().get('/api/v1/content/public/articles').expect(200);
  });
});
