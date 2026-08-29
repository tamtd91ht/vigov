/**
 * Test đầu-cuối các LUỒNG nghiệp vụ xuyên phân hệ (P5-07).
 *
 * Bổ sung cho `smoke.e2e-spec.ts` (không sửa file đó): ở đây đi hết một luồng
 * nhiều bước thay vì gọi lẻ từng endpoint —
 *   1. Văn bản đến → nhiệm vụ (và gọi lại lần hai phải idempotent)
 *   2. Công dân gửi phản ánh → cán bộ phân công → xác nhận xong → công dân đánh giá
 *   3. Phân quyền: kế toán không được tạo nhiệm vụ
 *   4. Thu hồi phiên đăng nhập làm token đang cầm mất hiệu lực ngay
 *   5. Kết xuất Excel trả đúng kiểu nội dung và đúng chữ ký tệp
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

const PASSWORD = 'ViGov@2026';
const ADMIN = { username: 'binh.nv', password: PASSWORD };
const ACCOUNTANT = { username: 'hoa.kt', password: PASSWORD };
const CITIZEN_PHONE = '0912345678';
const API = '/api/v1';
const TEST_TIMEOUT_MS = 180_000;

/** Hai byte đầu của mọi tệp .xlsx (thực chất là kho ZIP) */
const ZIP_SIGNATURE = 'PK';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

jest.setTimeout(TEST_TIMEOUT_MS);

/** Đọc phần payload của JWT để lấy mã phiên (sid) — không cần khoá bí mật */
function readJwtPayload(token: string): { sub: string; username: string; sid?: string } {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

/** Gom toàn bộ thân phản hồi dạng nhị phân (tệp Excel) thành Buffer */
function binaryParser(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('ViGov API — luồng nghiệp vụ đầu-cuối', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let adminToken: string;
  let accountantToken: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vigov-test-flows');
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';

    const { AppModule } = await import('../apps/api-gateway/src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Cấu hình giống main.ts để đường dẫn và luật kiểm tra khớp môi trường thật
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const staffModel = app.get<Model<StaffUserDocument>>(getModelToken(StaffUser.name));
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await staffModel.create([
      {
        username: ADMIN.username,
        passwordHash,
        displayName: 'Nguyễn Văn Bình',
        initials: 'NB',
        color: '#1B3A5C',
        department: 'Văn phòng UBND',
        roleKey: 'admin',
        status: 'active',
      },
      {
        username: ACCOUNTANT.username,
        passwordHash,
        displayName: 'Phạm Thị Hoa',
        initials: 'PH',
        color: '#0F766E',
        department: 'Tài chính – Kế toán',
        roleKey: 'accountant',
        status: 'active',
      },
    ]);

    const slaModel = app.get<Model<SlaRuleDocument>>(getModelToken(SlaRule.name));
    await slaModel.create({
      categoryKey: 'giao-thong',
      intakeDays: 4,
      resolveDays: 5,
      unit: 'ngày làm việc',
      warnBefore: 'Trước hạn 12 giờ',
    });

    adminToken = await login(ADMIN);
    accountantToken = await login(ACCOUNTANT);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const api = () => request(app.getHttpServer());

  async function login(account: { username: string; password: string }): Promise<string> {
    const res = await api().post(`${API}/auth/staff/login`).send(account).expect(201);
    return res.body.accessToken as string;
  }

  const asAdmin = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  /* ─────────────── 1. Văn bản đến → nhiệm vụ (idempotent) ─────────────── */

  describe('Luồng văn bản đến → nhiệm vụ', () => {
    let documentId: string;
    let arrivalNo: string;
    let taskCode: string;

    it('tiếp nhận văn bản đến và cấp số đến', async () => {
      const res = await asAdmin(api().post(`${API}/documents`))
        .send({
          refNo: '512/UBND-VP',
          date: '10/08/2026',
          sender: 'UBND huyện Phú Xuyên',
          summary: 'V/v triển khai kế hoạch chỉnh trang đô thị quý IV',
          docType: 'Kế hoạch',
          kind: 'incoming',
          department: 'Địa chính – Xây dựng',
          deadline: '25/09/2026',
          urgency: 'Khẩn',
        })
        .expect(201);

      documentId = res.body._id;
      arrivalNo = res.body.arrivalNo;
      expect(documentId).toBeTruthy();
      expect(arrivalNo).toBeTruthy();
      expect(res.body.linkedTaskCode).toBeFalsy();
    });

    it('chuyển văn bản thành nhiệm vụ theo dõi', async () => {
      const res = await asAdmin(api().post(`${API}/workflow/document-to-task`))
        .send({ documentId, assignee: 'Lê Minh Tuấn' })
        .expect(201);

      taskCode = res.body.code;
      expect(taskCode).toMatch(/^NV-\d+$/);
    });

    it('nhiệm vụ vừa sinh mang đúng nguồn, hạn và mức ưu tiên của văn bản', async () => {
      const task = await asAdmin(api().get(`${API}/tasks/${taskCode}`)).expect(200);

      expect(task.body).toMatchObject({
        code: taskCode,
        sourceType: 'vb',
        sourceLabel: 'Từ 512/UBND-VP',
        department: 'Địa chính – Xây dựng',
        assignee: 'Lê Minh Tuấn',
        deadline: '25/09/2026',
        // urgency 'Khẩn' → mức ưu tiên 'cao'
        priority: 'cao',
        status: 'moi',
      });
      expect(task.body.title).toContain('Xử lý văn bản');
    });

    it('văn bản gốc được gắn mã nhiệm vụ và ghi thêm mốc nhật ký', async () => {
      const doc = await asAdmin(api().get(`${API}/documents/${arrivalNo}`)).expect(200);

      expect(doc.body.linkedTaskCode).toBe(taskCode);
      expect(
        (doc.body.timeline as { title: string }[]).some((s) => s.title.includes(taskCode)),
      ).toBe(true);
    });

    it('gọi lần thứ hai TRẢ CÙNG MÃ và không tạo thêm nhiệm vụ (idempotent)', async () => {
      const before = await asAdmin(api().get(`${API}/tasks`)).expect(200);

      const again = await asAdmin(api().post(`${API}/workflow/document-to-task`))
        .send({ documentId, assignee: 'Lê Minh Tuấn' })
        .expect(201);
      expect(again.body.code).toBe(taskCode);

      const after = await asAdmin(api().get(`${API}/tasks`)).expect(200);
      expect(after.body.total).toBe(before.body.total);
    });

    it('văn bản không tồn tại thì báo 404', async () => {
      await asAdmin(api().post(`${API}/workflow/document-to-task`))
        .send({ documentId: '000000000000000000000000' })
        .expect(404);
    });

    it('mã văn bản sai định dạng thì báo 400', async () => {
      await asAdmin(api().post(`${API}/workflow/document-to-task`))
        .send({ documentId: 'khong-phai-objectid' })
        .expect(400);
    });
  });

  /* ─────────────── 2. Luồng phản ánh của công dân ─────────────── */

  describe('Luồng phản ánh: gửi → phân công → xử lý xong → đánh giá', () => {
    let citizenToken: string;
    let feedbackCode: string;
    /** Mã phiếu trong URL phải mã hoá vì bắt đầu bằng ký tự '#' */
    const path = (suffix = '') => `${API}/feedback/${encodeURIComponent(feedbackCode)}${suffix}`;

    it('công dân định danh bằng OTP', async () => {
      await api().post(`${API}/auth/citizen/otp/request`).send({ phone: CITIZEN_PHONE }).expect(201);

      const { AuthService } = await import('../apps/api-gateway/src/modules/auth/auth.service');
      const auth = app.get(AuthService);
      const otp = (auth as unknown as { otpStore: Map<string, { code: string }> }).otpStore.get(
        CITIZEN_PHONE,
      )?.code;
      expect(otp).toBeDefined();

      const verified = await api()
        .post(`${API}/auth/citizen/otp/verify`)
        .send({ phone: CITIZEN_PHONE, otp })
        .expect(201);
      citizenToken = verified.body.accessToken;
      expect(citizenToken).toBeTruthy();
    });

    it('công dân gửi phiếu phản ánh, hệ thống cấp mã và tính hạn SLA', async () => {
      const res = await api()
        .post(`${API}/feedback/citizen`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          categoryKey: 'giao-thong',
          title: 'Cống thoát nước tắc gây ngập đầu ngõ 12',
          description: 'Mỗi khi mưa to nước ngập tới 40cm, xe máy không qua được.',
          location: 'Ngõ 12, Thôn Trung',
          channel: 'app',
        })
        .expect(201);

      feedbackCode = res.body.code;
      expect(feedbackCode).toMatch(/^#PA-\d{4}-\d{4}$/);
      expect(res.body.status).toBe('received');
      // SLA 5 ngày của lĩnh vực giao-thong → còn khoảng 120 giờ
      expect(res.body.slaHoursLeft).toBeGreaterThan(119);
      expect(res.body.slaHoursLeft).toBeLessThanOrEqual(120);
    });

    it('chưa xử lý xong thì công dân CHƯA được đánh giá (409)', async () => {
      await api()
        .post(`${API}/feedback/citizen/mine/${encodeURIComponent(feedbackCode)}/rating`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 5 })
        .expect(409);
    });

    it('cán bộ phân công xử lý → phiếu chuyển sang "đang xử lý"', async () => {
      const res = await asAdmin(api().patch(path('/assign')))
        .send({
          assignee: 'Trần Văn Nam',
          department: 'Địa chính – Xây dựng',
          note: 'Đề nghị kiểm tra trong tuần',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'processing',
        assignee: 'Trần Văn Nam',
        department: 'Địa chính – Xây dựng',
      });
      // Số điện thoại công dân luôn ở dạng che khi trả ra Web Quản trị
      expect(res.body.citizenPhone).toBe('091•••678');
    });

    it('cán bộ xác nhận xử lý xong → phiếu chuyển "resolved" và ghi nhật ký', async () => {
      const res = await asAdmin(api().patch(path('/resolve')))
        .send({ note: 'Đã nạo vét cống, thoát nước bình thường' })
        .expect(200);

      expect(res.body.status).toBe('resolved');
      const timeline = res.body.timeline as { title: string; state: string }[];
      expect(timeline[timeline.length - 1]).toMatchObject({ title: 'Đã xử lý xong', state: 'cur' });
      // Chỉ mốc cuối cùng ở trạng thái đang diễn ra
      expect(timeline.filter((s) => s.state === 'cur')).toHaveLength(1);
    });

    it('công dân đánh giá 5 sao sau khi phiếu đã xong', async () => {
      const res = await api()
        .post(`${API}/feedback/citizen/mine/${encodeURIComponent(feedbackCode)}/rating`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 5, ratingComment: 'Cán bộ xử lý nhanh, cảm ơn' })
        .expect(201);

      expect(res.body).toMatchObject({ rating: 5, ratingComment: 'Cán bộ xử lý nhanh, cảm ơn' });
    });

    it('điểm đánh giá được lưu và công dân đọc lại được phiếu của mình', async () => {
      const mine = await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent(feedbackCode)}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(mine.body).toMatchObject({ code: feedbackCode, status: 'resolved', rating: 5 });
    });

    it('tài khoản cán bộ không dùng được nhóm endpoint dành cho công dân', async () => {
      const res = await asAdmin(api().post(`${API}/feedback/citizen`))
        .send({ categoryKey: 'giao-thong', title: 'Phiếu thử', description: 'Không dùng' })
        .expect(403);
      expect(res.body.message).toContain('công dân');
    });

    it('công dân không đọc được phiếu KHÔNG phải của mình (404 chứ không lộ tồn tại)', async () => {
      await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent('#PA-2026-9999')}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(404);
    });

    it('đánh giá ngoài thang 1–5 bị từ chối', async () => {
      await api()
        .post(`${API}/feedback/citizen/mine/${encodeURIComponent(feedbackCode)}/rating`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 6 })
        .expect(400);
    });

    it('thống kê của cán bộ phản ánh đúng số phiếu đã xử lý', async () => {
      const stats = await asAdmin(api().get(`${API}/feedback/stats`)).expect(200);
      expect(stats.body.receivedThisMonth).toBeGreaterThanOrEqual(1);
      expect(stats.body.resolvedThisMonth).toBeGreaterThanOrEqual(1);
      expect(stats.body.avgRating).toBe(5);
      expect(stats.body.ratedCount).toBe(1);
    });
  });

  /* ─────────────── 3. Phân quyền theo vai trò ─────────────── */

  describe('Phân quyền theo vai trò', () => {
    const asAccountant = <T extends { set: (k: string, v: string) => T }>(req: T) =>
      req.set('Authorization', `Bearer ${accountantToken}`);

    const newTask = {
      title: 'Kế toán thử tạo nhiệm vụ',
      assignee: 'Phạm Thị Hoa',
      department: 'Tài chính – Kế toán',
      deadline: '30/11/2026',
    };

    it('kế toán KHÔNG được tạo nhiệm vụ (403)', async () => {
      const res = await asAccountant(api().post(`${API}/tasks`)).send(newTask).expect(403);
      expect(res.body.message).toContain('không có quyền');
    });

    it('kế toán KHÔNG được sửa nhiệm vụ (403)', async () => {
      await asAccountant(api().patch(`${API}/tasks/NV-2601`))
        .send({ title: 'đổi tên' })
        .expect(403);
    });

    it('kế toán VẪN xem được danh sách nhiệm vụ (quyền view)', async () => {
      await asAccountant(api().get(`${API}/tasks`)).expect(200);
    });

    it('kế toán ghi được vào phân hệ Giải ngân — đúng vai trò của mình', async () => {
      await asAccountant(api().post(`${API}/disbursement`))
        .send({
          name: 'Sửa chữa nhà văn hoá thôn Đoài',
          planned: 1.2,
          fundingSource: 'Ngân sách xã',
          owner: 'Tài chính – Kế toán',
          year: 2026,
        })
        .expect(201);
    });

    it('quản trị viên tạo nhiệm vụ bình thường — chứng minh 403 là do vai trò', async () => {
      await asAdmin(api().post(`${API}/tasks`)).send(newTask).expect(201);
    });

    it('kế toán KHÔNG được xoá nhiệm vụ (yêu cầu quyền admin)', async () => {
      await asAccountant(api().delete(`${API}/tasks/NV-2601`)).expect(403);
    });
  });

  /* ─────────────── 4. Thu hồi phiên đăng nhập ─────────────── */

  describe('Thu hồi phiên đăng nhập làm token mất hiệu lực', () => {
    let victimToken: string;
    let sessionId: string;

    it('đăng nhập lấy token mới và đọc được mã phiên từ payload JWT', async () => {
      victimToken = await login(ACCOUNTANT);
      const payload = readJwtPayload(victimToken);
      expect(payload.username).toBe(ACCOUNTANT.username);
      expect(payload.sid).toBeTruthy();
      sessionId = payload.sid as string;
    });

    it('token còn hiệu lực thì gọi API bình thường', async () => {
      await api().get(`${API}/tasks`).set('Authorization', `Bearer ${victimToken}`).expect(200);
    });

    it('quản trị viên thu hồi phiên đó', async () => {
      const res = await asAdmin(api().delete(`${API}/users/sessions/${sessionId}`)).expect(200);
      expect(res.body).toMatchObject({ id: sessionId, revoked: true });
    });

    it('token cũ lập tức bị từ chối với 401', async () => {
      const res = await api()
        .get(`${API}/tasks`)
        .set('Authorization', `Bearer ${victimToken}`)
        .expect(401);
      expect(res.body.message).toContain('thu hồi');
    });

    it('các phiên khác của cùng tài khoản KHÔNG bị ảnh hưởng', async () => {
      await api().get(`${API}/tasks`).set('Authorization', `Bearer ${accountantToken}`).expect(200);
    });

    it('đăng nhập lại tạo phiên mới dùng được ngay', async () => {
      const fresh = await login(ACCOUNTANT);
      expect(readJwtPayload(fresh).sid).not.toBe(sessionId);
      await api().get(`${API}/tasks`).set('Authorization', `Bearer ${fresh}`).expect(200);
    });

    it('mã phiên không hợp lệ thì báo lỗi thay vì thu hồi nhầm', async () => {
      await asAdmin(api().delete(`${API}/users/sessions/khong-phai-objectid`)).expect(400);
    });
  });

  /* ─────────────── 5. Kết xuất Excel ─────────────── */

  describe('Kết xuất báo cáo Excel', () => {
    it('trả tệp .xlsx đúng kiểu nội dung và đúng chữ ký ZIP "PK"', async () => {
      const res = await asAdmin(api().get(`${API}/reports/export/excel`))
        .query({ period: 'year', year: 2026 })
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);

      expect(res.headers['content-type']).toContain(XLSX_MIME);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.xlsx');

      const body = res.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.length).toBeGreaterThan(1000);
      expect(body.subarray(0, 2).toString('ascii')).toBe(ZIP_SIGNATURE);
    });

    it('kế toán cũng tải được báo cáo — mọi vai trò đều có quyền xem phân hệ Báo cáo', async () => {
      await api()
        .get(`${API}/reports/export/excel`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);
    });

    it('chưa đăng nhập thì không tải được báo cáo', async () => {
      await api().get(`${API}/reports/export/excel`).expect(401);
    });

    it('kỳ báo cáo sai giá trị bị từ chối', async () => {
      await asAdmin(api().get(`${API}/reports/export/excel`)).query({ period: 'thang' }).expect(400);
    });
  });
});
