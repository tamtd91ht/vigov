/**
 * Test đầu-cuối: THU HỒI KHÔNG ĐƯỢC DÙNG ĐỂ LÁCH CHỐT CHỐNG SPAM.
 *
 * Chốt `FEEDBACK_MAX_PER_DAY` đếm số phiếu một số điện thoại gửi trong 24 giờ.
 * Câu hỏi nghiệp vụ: phiếu người dân đã THU HỒI có còn bị đếm không?
 *
 * Quyết định đã chốt (khách hàng duyệt 10/09/2026, xem
 * docs/quyet-dinh/0001-thu-hoi-phan-anh.md): CÓ, vẫn đếm. Nếu không đếm thì vòng
 * "gửi đủ hạn mức → thu hồi hết → gửi tiếp" lặp vô hạn, và chốt chống spam trở
 * thành vô nghĩa đúng vào ngày có người muốn lạm dụng nó.
 *
 * VÌ SAO TÁCH RA TỆP RIÊNG: `feedback-withdraw.e2e-spec.ts` phải NỚI hạn mức lên
 * 500 để dựng gần hai chục tình huống thu hồi. Muốn thử chính cái hạn mức đó thì
 * phải chạy trong một tiến trình có hạn mức THẤP — hai yêu cầu loại trừ nhau, nên
 * không nhét chung một tệp được.
 *
 * Đây là hành vi dễ bị "sửa nhầm cho tử tế": một người đọc mã sau này rất dễ nghĩ
 * phiếu đã gỡ thì không nên tính, rồi thêm NOT_DELETED vào `assertNotSpamming`.
 * Test này là thứ chặn việc đó.
 *
 * Chạy: npm run test:e2e
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

const API = '/api/v1';
const TEST_TIMEOUT_MS = 180_000;

const OTP_BYPASS = '246810';
const CITIZEN_PHONE = '0912345678';

/** Hạn mức THẤP để thử được chính chốt chống spam — mặc định thật là 5 */
const MAX_PER_DAY = 2;

jest.setTimeout(TEST_TIMEOUT_MS);

describe('ViGov API — thu hồi không lách được chốt chống spam', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let citizenToken: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vigov-test-withdraw-spam');
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.CITIZEN_OTP_BYPASS_CODE = OTP_BYPASS;
    process.env.FEEDBACK_MAX_PER_DAY = String(MAX_PER_DAY);
    // Nới hạn mức chung của ThrottlerModule; chốt đang thử là chốt theo NGÀY, không phải theo phút
    process.env.THROTTLE_LIMIT = '10000';

    const { AppModule } = await import('../apps/api-gateway/src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    await api().post(`${API}/auth/citizen/otp/request`).send({ phone: CITIZEN_PHONE }).expect(201);
    const res = await api()
      .post(`${API}/auth/citizen/otp/verify`)
      .send({ phone: CITIZEN_PHONE, otp: OTP_BYPASS })
      .expect(201);
    citizenToken = res.body.accessToken as string;
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const api = () => request(app.getHttpServer());
  const asCitizen = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set('Authorization', `Bearer ${citizenToken}`);
  const codePath = (code: string) => encodeURIComponent(code);

  /** Gửi một phiếu; trả mã phiếu, hoặc null khi bị chốt chống spam chặn (429) */
  async function trySend(title: string): Promise<string | null> {
    const res = await asCitizen(api().post(`${API}/feedback/citizen`)).send({
      categoryKey: 'rac-thai',
      title,
      description: 'Nội dung phản ánh dùng cho kiểm thử tự động',
      location: 'Thôn 1',
      channel: 'zalo',
    });
    if (res.status === 429) return null;
    expect(res.status).toBe(201);
    return res.body.code as string;
  }

  it('gửi đủ hạn mức thì phiếu tiếp theo bị chặn', async () => {
    for (let i = 0; i < MAX_PER_DAY; i += 1) {
      expect(await trySend(`Phiếu trong hạn mức số ${i + 1}`)).toBeTruthy();
    }
    expect(await trySend('Phiếu vượt hạn mức phải bị chặn')).toBeNull();
  });

  it('THU HỒI HẾT rồi vẫn KHÔNG gửi thêm được — phiếu đã gỡ vẫn bị đếm', async () => {
    // Thu hồi toàn bộ phiếu đang có của công dân này
    const list = await asCitizen(api().get(`${API}/feedback/citizen/mine`)).expect(200);
    const codes = (list.body.items as { code: string }[]).map((i) => i.code);
    expect(codes.length).toBe(MAX_PER_DAY);

    for (const code of codes) {
      const res = await asCitizen(
        api().post(`${API}/feedback/citizen/mine/${codePath(code)}/withdraw`),
      )
        .send({ reason: 'Thu hồi để thử lách hạn mức' })
        .expect(201);
      // Chưa ai tiếp nhận nên gỡ thẳng, không qua bước chờ duyệt
      expect(res.body.removed).toBe(true);
    }

    // Danh sách của công dân giờ trống — nhưng hạn mức thì KHÔNG được reset theo
    const after = await asCitizen(api().get(`${API}/feedback/citizen/mine`)).expect(200);
    expect((after.body.items as unknown[]).length).toBe(0);

    expect(await trySend('Gửi lại sau khi đã thu hồi hết')).toBeNull();
  });
});
