/**
 * Test đầu-cuối LUỒNG THU HỒI PHẢN ÁNH của người dân.
 *
 * Nghiệp vụ có hai nhánh và ranh giới giữa chúng là chỗ dễ sai nhất:
 *
 *   • CHƯA ai tiếp nhận → người dân sửa được nội dung, và gỡ được ngay.
 *   • ĐÃ có người tiếp nhận → khoá sửa; xin thu hồi thì chuyển sang chờ cán bộ
 *     xác nhận, phiếu chỉ biến mất sau khi cán bộ đồng ý.
 *
 * Ba thứ test này canh, vì cả ba đều hỏng trong im lặng nếu sai:
 *
 *   1. "Gỡ" phải là XOÁ MỀM. Phiếu phản ánh là tài liệu hành chính có thời hạn
 *      lưu theo quy định — xoá cứng là tiêu huỷ tài liệu. Test khẳng định phiếu
 *      biến mất khỏi cả hai danh sách nhưng vẫn tra lại được bằng bộ lọc
 *      `deleted=true`, kèm nguyên vẹn nhật ký.
 *   2. Phiếu đã gỡ KHÔNG được lọt vào thống kê. Đây là loại lỗi không ai thấy
 *      cho tới lúc đối chiếu báo cáo cuối tháng với cấp trên.
 *   3. Cách ly giữa hai người dân vẫn giữ nguyên trên các đường mới: công dân
 *      khác dò đúng mã phiếu phải nhận 404, không phải 403 — 403 tiết lộ rằng
 *      mã đó có thật.
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
import { StaffUser, type StaffUserDocument } from '@vigov/shared';

const PASSWORD = 'ViGov@2026';
const ADMIN = { username: 'binh.nv', password: PASSWORD };
const API = '/api/v1';
const TEST_TIMEOUT_MS = 180_000;

const OTP_BYPASS = '246810';
const CITIZEN_PHONE = '0912345678';
/** Công dân thứ hai — để thử phép cách ly dữ liệu giữa hai người dân */
const OTHER_CITIZEN_PHONE = '0912345679';

jest.setTimeout(TEST_TIMEOUT_MS);

describe('ViGov API — thu hồi và sửa phản ánh', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let adminToken: string;
  let citizenToken: string;
  let otherToken: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vigov-test-withdraw');
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.CITIZEN_OTP_BYPASS_CODE = OTP_BYPASS;
    /*
     * Nới hai hạn mức chống lạm dụng cho lần chạy test.
     *
     * Bộ test này gửi gần hai chục phiếu từ CÙNG một số điện thoại để dựng đủ
     * các tình huống thu hồi, nên đụng ngay `FEEDBACK_MAX_PER_DAY` (mặc định 5)
     * và hạn mức chung của ThrottlerModule. Đây là NỚI CẤU HÌNH cho môi trường
     * test, không phải tắt cơ chế: hai chốt đó có bộ test riêng, và mặc định
     * production vẫn nguyên vẹn.
     */
    process.env.FEEDBACK_MAX_PER_DAY = '500';
    process.env.THROTTLE_LIMIT = '10000';

    const { AppModule } = await import('../apps/api-gateway/src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const staffModel = app.get<Model<StaffUserDocument>>(getModelToken(StaffUser.name));
    await staffModel.create({
      username: ADMIN.username,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      displayName: 'Nguyễn Văn Bình',
      initials: 'NB',
      color: '#1B3A5C',
      department: 'Văn phòng UBND',
      roleKey: 'admin',
      status: 'active',
    });

    const res = await request(app.getHttpServer())
      .post(`${API}/auth/staff/login`)
      .send(ADMIN)
      .expect(201);
    adminToken = res.body.accessToken as string;

    citizenToken = await loginCitizen(CITIZEN_PHONE);
    otherToken = await loginCitizen(OTHER_CITIZEN_PHONE);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const api = () => request(app.getHttpServer());

  const asAdmin = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const asCitizen = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set('Authorization', `Bearer ${citizenToken}`);
  const asOther = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set('Authorization', `Bearer ${otherToken}`);

  async function loginCitizen(phone: string): Promise<string> {
    await api().post(`${API}/auth/citizen/otp/request`).send({ phone }).expect(201);
    const res = await api()
      .post(`${API}/auth/citizen/otp/verify`)
      .send({ phone, otp: OTP_BYPASS })
      .expect(201);
    return res.body.accessToken as string;
  }

  /** Công dân gửi một phiếu mới, trả về mã phiếu */
  async function sendFeedback(title: string): Promise<string> {
    const res = await asCitizen(api().post(`${API}/feedback/citizen`))
      .send({
        categoryKey: 'rac-thai',
        title,
        description: 'Nội dung phản ánh dùng cho kiểm thử tự động',
        location: 'Thôn 1',
        channel: 'zalo',
      })
      .expect(201);
    return res.body.code as string;
  }

  const codePath = (code: string) => encodeURIComponent(code);

  /** Cán bộ phân công — đây chính là hành vi "đã có người tiếp nhận" */
  async function assignToStaff(code: string): Promise<void> {
    await asAdmin(api().patch(`${API}/feedback/${codePath(code)}/assign`))
      .send({ assignee: 'Nguyễn Văn Bình', department: 'Văn phòng UBND' })
      .expect(200);
  }

  /* ─────────── 1. Chưa ai tiếp nhận ─────────── */

  describe('Phiếu CHƯA có người tiếp nhận', () => {
    it('phiếu mới gửi báo là chưa tiếp nhận, sửa được và gỡ thẳng được', async () => {
      const code = await sendFeedback('Rác tồn đọng đầu ngõ cần thu gom');
      const res = await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);

      expect(res.body.accepted).toBe(false);
      expect(res.body.canEdit).toBe(true);
      expect(res.body.canWithdrawDirectly).toBe(true);
      expect(res.body.withdrawStatus).toBe('none');
    });

    it('KHÔNG trả tên cán bộ hay bộ phận cho công dân', async () => {
      const code = await sendFeedback('Cống thoát nước tắc gây ngập');
      const res = await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);

      expect(res.body.assignee).toBeUndefined();
      expect(res.body.department).toBeUndefined();
    });

    it('công dân sửa được tiêu đề và nội dung', async () => {
      const code = await sendFeedback('Tiêu đề ban đầu cần được sửa lại');
      const res = await asCitizen(api().patch(`${API}/feedback/citizen/mine/${codePath(code)}`))
        .send({ title: 'Tiêu đề đã sửa cho rõ nghĩa hơn', description: 'Nội dung đã bổ sung chi tiết' })
        .expect(200);

      expect(res.body.title).toBe('Tiêu đề đã sửa cho rõ nghĩa hơn');
      expect(res.body.description).toBe('Nội dung đã bổ sung chi tiết');
    });

    it('mỗi lần sửa đều ghi một mốc vào nhật ký xử lý', async () => {
      const code = await sendFeedback('Đèn đường hỏng chưa được thay thế');
      await asCitizen(api().patch(`${API}/feedback/citizen/mine/${codePath(code)}`))
        .send({ title: 'Đèn đường hỏng đã hai tuần chưa thay' })
        .expect(200);

      const res = await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);
      const titles = (res.body.timeline as { title: string }[]).map((t) => t.title);
      expect(titles.some((t) => t.includes('Công dân sửa'))).toBe(true);
    });

    it('gỡ thẳng được, và phiếu biến mất khỏi danh sách của công dân', async () => {
      const code = await sendFeedback('Phiếu này sẽ được người dân tự gỡ');
      const res = await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`))
        .send({ reason: 'Sự việc đã tự giải quyết' })
        .expect(201);

      expect(res.body.removed).toBe(true);
      expect(res.body.withdrawStatus).toBe('approved');

      await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(404);

      const list = await asCitizen(api().get(`${API}/feedback/citizen/mine`)).expect(200);
      expect((list.body.items as { code: string }[]).some((i) => i.code === code)).toBe(false);
    });

    it('phiếu đã gỡ cũng biến mất khỏi danh sách của CÁN BỘ', async () => {
      const code = await sendFeedback('Phiếu gỡ rồi thì cán bộ cũng không thấy');
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);

      const list = await asAdmin(api().get(`${API}/feedback?limit=100`)).expect(200);
      expect((list.body.items as { code: string }[]).some((i) => i.code === code)).toBe(false);
      await asAdmin(api().get(`${API}/feedback/${codePath(code)}`)).expect(404);
    });

    it('nhưng vẫn là XOÁ MỀM: tra lại được bằng bộ lọc deleted=true, nhật ký còn nguyên', async () => {
      const code = await sendFeedback('Phiếu gỡ mềm vẫn phải tra lại được');
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`))
        .send({ reason: 'Gửi nhầm lĩnh vực' })
        .expect(201);

      const list = await asAdmin(api().get(`${API}/feedback?deleted=true&limit=100`)).expect(200);
      const found = (list.body.items as { code: string; timeline: unknown[] }[]).find((i) => i.code === code);
      expect(found).toBeDefined();
      expect(found!.timeline.length).toBeGreaterThan(0);
    });
  });

  /* ─────────── 2. Đã có người tiếp nhận ─────────── */

  describe('Phiếu ĐÃ có người tiếp nhận', () => {
    it('khoá sửa nội dung — trả 409 kèm lời giải thích cho người dân', async () => {
      const code = await sendFeedback('Phiếu này sẽ được cán bộ tiếp nhận ngay');
      await assignToStaff(code);

      const res = await asCitizen(api().patch(`${API}/feedback/citizen/mine/${codePath(code)}`))
        .send({ title: 'Cố sửa sau khi cán bộ đã nhận việc' })
        .expect(409);
      expect(String(res.body.message)).toContain('thu hồi');
    });

    it('cờ canEdit / canWithdrawDirectly đảo lại sau khi phân công', async () => {
      const code = await sendFeedback('Phiếu để kiểm hai cờ sau phân công');
      await assignToStaff(code);

      const res = await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);
      expect(res.body.accepted).toBe(true);
      expect(res.body.canEdit).toBe(false);
      expect(res.body.canWithdrawDirectly).toBe(false);
    });

    it('xin thu hồi thì CHỜ duyệt, phiếu vẫn còn nguyên cho cả hai bên', async () => {
      const code = await sendFeedback('Phiếu xin thu hồi nhưng phải chờ duyệt');
      await assignToStaff(code);

      const res = await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`))
        .send({ reason: 'Gia đình đã tự khắc phục' })
        .expect(201);
      expect(res.body.removed).toBe(false);
      expect(res.body.withdrawStatus).toBe('pending');

      // Người dân vẫn xem được phiếu, kèm trạng thái đang chờ
      const mine = await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);
      expect(mine.body.withdrawStatus).toBe('pending');
      expect(mine.body.withdrawReason).toBe('Gia đình đã tự khắc phục');

      // Cán bộ vẫn thấy phiếu trong hàng đợi
      await asAdmin(api().get(`${API}/feedback/${codePath(code)}`)).expect(200);
    });

    it('xin thu hồi lần hai khi đang chờ thì bị từ chối', async () => {
      const code = await sendFeedback('Phiếu bấm xin thu hồi hai lần liên tiếp');
      await assignToStaff(code);
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(409);
    });

    it('cán bộ lọc được đúng nhóm phiếu đang chờ duyệt thu hồi', async () => {
      const code = await sendFeedback('Phiếu phải hiện trong bộ lọc chờ duyệt');
      await assignToStaff(code);
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);

      const list = await asAdmin(api().get(`${API}/feedback?withdrawStatus=pending&limit=100`)).expect(200);
      expect((list.body.items as { code: string }[]).some((i) => i.code === code)).toBe(true);
    });

    it('cán bộ ĐỒNG Ý thì phiếu mới được gỡ', async () => {
      const code = await sendFeedback('Phiếu được cán bộ đồng ý cho thu hồi');
      await assignToStaff(code);
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);

      const res = await asAdmin(api().patch(`${API}/feedback/${codePath(code)}/withdraw/approve`))
        .send({ note: 'Đồng ý theo đề nghị của người dân' })
        .expect(200);
      expect(res.body.removed).toBe(true);

      await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(404);
    });

    it('cán bộ TỪ CHỐI thì phiếu ở lại, người dân đọc được lý do', async () => {
      const code = await sendFeedback('Phiếu bị từ chối cho thu hồi');
      await assignToStaff(code);
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);

      await asAdmin(api().patch(`${API}/feedback/${codePath(code)}/withdraw/reject`))
        .send({ note: 'Sự việc đang được xử lý, đề nghị giữ phiếu để theo dõi' })
        .expect(200);

      const mine = await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);
      expect(mine.body.withdrawStatus).toBe('rejected');
      expect(mine.body.withdrawDecisionNote).toContain('đang được xử lý');
    });

    it('từ chối mà KHÔNG nêu lý do thì bị chặn — người dân phải biết vì sao', async () => {
      const code = await sendFeedback('Phiếu từ chối thu hồi mà quên nêu lý do');
      await assignToStaff(code);
      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);

      await asAdmin(api().patch(`${API}/feedback/${codePath(code)}/withdraw/reject`)).send({}).expect(400);
      await asAdmin(api().patch(`${API}/feedback/${codePath(code)}/withdraw/reject`))
        .send({ note: '   ' })
        .expect(400);
    });

    it('duyệt một phiếu không có yêu cầu nào đang chờ thì bị từ chối', async () => {
      const code = await sendFeedback('Phiếu chưa ai xin thu hồi lần nào');
      await assignToStaff(code);
      await asAdmin(api().patch(`${API}/feedback/${codePath(code)}/withdraw/approve`)).send({}).expect(409);
    });
  });

  /* ─────────── 3. Cách ly dữ liệu và thống kê ─────────── */

  describe('Cách ly dữ liệu công dân', () => {
    it('công dân khác KHÔNG sửa được phiếu của người ta — 404, không phải 403', async () => {
      const code = await sendFeedback('Phiếu của người khác không ai sửa được');
      await asOther(api().patch(`${API}/feedback/citizen/mine/${codePath(code)}`))
        .send({ title: 'Cố sửa phiếu của người khác' })
        .expect(404);
    });

    it('công dân khác KHÔNG thu hồi được phiếu của người ta — 404', async () => {
      const code = await sendFeedback('Phiếu của người khác không ai gỡ được');
      await asOther(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`))
        .send({})
        .expect(404);

      // Và phiếu vẫn còn nguyên với chủ của nó
      await asCitizen(api().get(`${API}/feedback/citizen/mine/${codePath(code)}`)).expect(200);
    });

    it('không có token thì không sửa và không thu hồi được', async () => {
      const code = await sendFeedback('Phiếu thử gọi khi chưa đăng nhập');
      await api().patch(`${API}/feedback/citizen/mine/${codePath(code)}`).send({ title: 'Sửa chui' }).expect(401);
      await api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`).send({}).expect(401);
    });

    it('phiếu đã gỡ KHÔNG được tính vào thống kê', async () => {
      const before = await asAdmin(api().get(`${API}/feedback/stats`)).expect(200);
      const receivedBefore = Number(before.body.receivedThisMonth ?? 0);

      const code = await sendFeedback('Phiếu gỡ rồi không được vào báo cáo');
      const mid = await asAdmin(api().get(`${API}/feedback/stats`)).expect(200);
      expect(Number(mid.body.receivedThisMonth ?? 0)).toBe(receivedBefore + 1);

      await asCitizen(api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`)).send({}).expect(201);

      const after = await asAdmin(api().get(`${API}/feedback/stats`)).expect(200);
      expect(Number(after.body.receivedThisMonth ?? 0)).toBe(receivedBefore);
    });
  });
});
