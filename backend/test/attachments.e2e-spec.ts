/**
 * Test đầu-cuối LUỒNG ĐÍNH KÈM TỆP — từ lúc tải tệp lên kho tệp dùng chung cho
 * tới lúc tệp hiện ra trong ngăn chi tiết và tải về được.
 *
 * Vì sao cần riêng một tệp test: cả bốn chỗ đính kèm trên Web Quản trị (bản
 * scan văn bản, phụ lục văn bản, tệp minh chứng nhiệm vụ, ảnh nghiệm thu phản
 * ánh) đều đi qua đúng ba bước — POST /files/upload, POST .../attachments, rồi
 * đọc lại bản ghi. Trước đây không có test nào chạy hết ba bước liền nhau, nên
 * bốn lỗi dưới đây cùng lọt ra bản chạy thật:
 *
 *   1. `DocumentsService` ghi mốc nhật ký với `state: 'done'`, mà enum của
 *      `TimelineStep` chỉ có 'ok' | 'cur' ⇒ Mongoose ném ValidationError ở
 *      `save()`, không phải HttpException nên cả lời gọi thành 500. Gắn phụ lục
 *      vào văn bản KHÔNG BAO GIỜ thành công.
 *   2. Busboy đọc tên tệp theo Latin-1 ⇒ tên tiếng Việt vào Mongo thành chữ rác.
 *   3. Các endpoint ghi khác (PATCH nhiệm vụ / văn bản, thêm bình luận) trả bản
 *      ghi THIẾU `attachmentFiles`. Giao diện lấy nguyên phản hồi thay cho bản
 *      đang mở, nên tệp vừa đính kèm biến mất khỏi màn hình.
 *   4. `deadline` khai `required` trong schema nhưng form tiếp nhận cho bỏ
 *      trống ⇒ vào sổ văn bản không hạn trả về 500.
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

/** Tên tệp tiếng Việt có dấu — đúng thứ hay gặp nhất ở văn thư xã */
const VN_FILENAME = 'Phụ lục biên bản.docx';

/** Mã tạm thời dùng để định danh công dân trong test */
const OTP_BYPASS = '246810';
const CITIZEN_PHONE = '0912345678';
/** Công dân thứ hai — để thử phép cách ly dữ liệu giữa hai người dân */
const OTHER_CITIZEN_PHONE = '0912345679';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

jest.setTimeout(TEST_TIMEOUT_MS);

describe('ViGov API — luồng đính kèm tệp', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vigov-test-attachments');
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    /* Định danh công dân trong test bằng mã tạm thời: mã OTP thật được băm
       trong kho OTP nên test không đọc lại được. Đây là cơ chế có sẵn của
       ứng dụng (CITIZEN_OTP_BYPASS_CODE), không phải cửa sau riêng cho test. */
    process.env.CITIZEN_OTP_BYPASS_CODE = OTP_BYPASS;

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
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const api = () => request(app.getHttpServer());

  const asAdmin = <T extends { set: (k: string, v: string) => T }>(req: T) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  /** Định danh một số điện thoại công dân, trả về access token */
  async function loginCitizen(phone: string): Promise<string> {
    await api().post(`${API}/auth/citizen/otp/request`).send({ phone }).expect(201);
    const res = await api()
      .post(`${API}/auth/citizen/otp/verify`)
      .send({ phone, otp: OTP_BYPASS })
      .expect(201);
    return res.body.accessToken as string;
  }

  /** Tải một tệp riêng tư lên kho tệp, trả về mã tệp — bước 1 của mọi chỗ đính kèm */
  async function uploadPrivate(filename = VN_FILENAME, contentType = DOCX_MIME): Promise<string> {
    const res = await asAdmin(api().post(`${API}/files/upload`))
      .field('purpose', 'other')
      .field('isPrivate', 'true')
      .attach('file', Buffer.from('noi dung phu luc'), { filename, contentType })
      .expect(201);
    return res.body.id as string;
  }

  /* ─────────── 1. Kho tệp dùng chung ─────────── */

  describe('POST /files/upload', () => {
    it('giữ nguyên tên tệp tiếng Việt có dấu', async () => {
      const res = await asAdmin(api().post(`${API}/files/upload`))
        .field('purpose', 'other')
        .field('isPrivate', 'true')
        .attach('file', Buffer.from('x'), { filename: VN_FILENAME, contentType: DOCX_MIME })
        .expect(201);

      expect(res.body.originalName).toBe(VN_FILENAME);
      expect(res.body.isPrivate).toBe(true);
    });

    it('không chọn tệp thì báo lỗi tiếng Việt, không phải 500', async () => {
      const res = await asAdmin(api().post(`${API}/files/upload`))
        .field('purpose', 'other')
        .field('isPrivate', 'true')
        .expect(400);

      expect(res.body.message).toContain('chọn tệp');
    });

    it('tệp riêng tư tải về được qua link ký sẵn, đúng tên trong Content-Disposition', async () => {
      const fileId = await uploadPrivate();

      const signed = await asAdmin(api().get(`${API}/files/${fileId}/signed-url?ttl=300`)).expect(200);
      const download = await api().get(signed.body.url as string).expect(200);

      // filename* mang tên đầy đủ; phần filename thuần ASCII chỉ để trình duyệt cũ không lỗi
      expect(download.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent(VN_FILENAME)}`,
      );
    });
  });

  /* ─────────── 2. Tệp đính kèm của văn bản ─────────── */

  describe('Đính kèm phụ lục vào văn bản', () => {
    let arrivalNo: string;
    let fileId: string;

    it('vào sổ được văn bản KHÔNG có hạn xử lý (form tiếp nhận cho bỏ trống)', async () => {
      const res = await asAdmin(api().post(`${API}/documents`))
        .send({
          refNo: '777/UBND-VP',
          date: '10/08/2026',
          sender: 'UBND huyện Phú Xuyên',
          summary: 'V/v rà soát hồ sơ đất đai',
          kind: 'incoming',
        })
        .expect(201);

      arrivalNo = res.body.arrivalNo;
      expect(arrivalNo).toBeTruthy();
      expect(res.body.deadline).toBe('');
      expect(res.body.attachmentFiles).toEqual([]);
    });

    it('gắn tệp và trả về ngay siêu dữ liệu tệp kèm tên đúng', async () => {
      fileId = await uploadPrivate();
      const res = await asAdmin(
        api().post(`${API}/documents/${encodeURIComponent(arrivalNo)}/attachments`),
      )
        .send({ fileIds: [fileId] })
        .expect(201);

      expect(res.body.attachmentFiles).toEqual([
        { fileId, name: VN_FILENAME, size: expect.any(Number), contentType: DOCX_MIME },
      ]);
    });

    it('ghi một mốc hợp lệ vào nhật ký luân chuyển', async () => {
      const res = await asAdmin(api().get(`${API}/documents/${encodeURIComponent(arrivalNo)}`)).expect(200);
      const step = (res.body.timeline as { title: string; state: string }[]).at(-1);

      expect(step?.title).toContain(VN_FILENAME);
      // 'done' không thuộc enum ⇒ save() ném ValidationError ⇒ 500 ở lời gọi trước
      expect(['ok', 'cur']).toContain(step?.state);
    });

    it('đọc lại chi tiết vẫn thấy tệp', async () => {
      const res = await asAdmin(api().get(`${API}/documents/${encodeURIComponent(arrivalNo)}`)).expect(200);
      expect(res.body.attachmentFiles).toHaveLength(1);
    });

    it('sửa văn bản (đổi bộ phận) KHÔNG làm mất cột tệp đính kèm', async () => {
      const res = await asAdmin(api().patch(`${API}/documents/${encodeURIComponent(arrivalNo)}`))
        .send({ department: 'Địa chính – Xây dựng' })
        .expect(200);

      expect(res.body.attachmentFiles).toHaveLength(1);
    });

    it('gắn lại tệp đã có thì không nhân bản', async () => {
      const res = await asAdmin(
        api().post(`${API}/documents/${encodeURIComponent(arrivalNo)}/attachments`),
      )
        .send({ fileIds: [fileId] })
        .expect(201);

      expect(res.body.attachmentFiles).toHaveLength(1);
    });

    it('gỡ tệp khỏi văn bản', async () => {
      const res = await asAdmin(
        api().delete(
          `${API}/documents/${encodeURIComponent(arrivalNo)}/attachments/${encodeURIComponent(fileId)}`,
        ),
      ).expect(200);

      expect(res.body.attachmentFiles).toEqual([]);
    });

    it('từ chối tệp CÔNG KHAI — tài liệu văn thư là nội bộ (TB-09)', async () => {
      const publicUpload = await asAdmin(api().post(`${API}/files/upload`))
        .field('purpose', 'other')
        .field('isPrivate', 'false')
        .attach('file', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(201);

      await asAdmin(api().post(`${API}/documents/${encodeURIComponent(arrivalNo)}/attachments`))
        .send({ fileIds: [publicUpload.body.id] })
        .expect(400);
    });
  });

  /* ─────────── 3. Tệp minh chứng của nhiệm vụ ─────────── */

  describe('Đính kèm minh chứng vào nhiệm vụ', () => {
    let taskCode: string;
    let fileId: string;

    it('giao nhiệm vụ rồi gắn tệp minh chứng', async () => {
      const task = await asAdmin(api().post(`${API}/tasks`))
        .send({
          title: 'Kiểm tra hiện trường tổ 4',
          assignee: 'Lê Minh Tuấn',
          department: 'Văn phòng UBND',
          deadline: '25/09/2026',
        })
        .expect(201);
      taskCode = task.body.code;

      fileId = await uploadPrivate();
      const res = await asAdmin(api().post(`${API}/tasks/${taskCode}/attachments`))
        .send({ fileIds: [fileId] })
        .expect(201);

      expect(res.body.attachmentFiles).toEqual([
        { fileId, name: VN_FILENAME, size: expect.any(Number), contentType: DOCX_MIME },
      ]);
    });

    /*
     * Ba endpoint dưới đây là những thao tác cán bộ làm NGAY SAU khi đính kèm.
     * Web Quản trị thay bản ghi đang mở bằng phản hồi của chúng, nên phản hồi
     * thiếu `attachmentFiles` là tệp vừa đính kèm biến mất khỏi màn hình.
     */
    it('cập nhật tiến độ vẫn trả kèm danh sách tệp', async () => {
      const res = await asAdmin(api().patch(`${API}/tasks/${taskCode}`))
        .send({ progress: 40 })
        .expect(200);
      expect(res.body.attachmentFiles).toHaveLength(1);
    });

    it('thêm ý kiến trao đổi vẫn trả kèm danh sách tệp', async () => {
      const res = await asAdmin(api().post(`${API}/tasks/${taskCode}/comments`))
        .send({ content: 'Đã kiểm tra, đề nghị nghiệm thu' })
        .expect(201);
      expect(res.body.attachmentFiles).toHaveLength(1);
    });

    it('tick việc con vẫn trả kèm danh sách tệp', async () => {
      await asAdmin(api().patch(`${API}/tasks/${taskCode}`))
        .send({ checklist: [{ title: 'Khảo sát', done: false }] })
        .expect(200);

      const res = await asAdmin(api().patch(`${API}/tasks/${taskCode}/checklist/0`))
        .send({ done: true })
        .expect(200);
      expect(res.body.attachmentFiles).toHaveLength(1);
    });

    it('gỡ tệp minh chứng', async () => {
      const res = await asAdmin(
        api().delete(`${API}/tasks/${taskCode}/attachments/${encodeURIComponent(fileId)}`),
      ).expect(200);
      expect(res.body.attachmentFiles).toEqual([]);
    });
  });

  /* ─────────── 4. Ảnh hiện trường và ảnh nghiệm thu của phản ánh ─────────── */

  describe('Đính kèm ảnh vào phiếu phản ánh', () => {
    let code: string;

    it('cán bộ lập phiếu kèm ảnh hiện trường', async () => {
      const imageId = await uploadPrivate('hien-truong.jpg', 'image/jpeg');
      const res = await asAdmin(api().post(`${API}/feedback`))
        .send({
          categoryKey: 'giao-thong',
          title: 'Cống thoát nước tổ 4 bị tắc',
          description: 'Nước ứ đọng tràn ra mặt đường sau mưa',
          location: 'Đường liên thôn, tổ 4',
          imageFileIds: [imageId],
        })
        .expect(201);

      code = res.body.code;
      expect(res.body.imageFileIds).toEqual([imageId]);
    });

    it('xác nhận xử lý xong kèm ảnh nghiệm thu — phản hồi trả lại đúng danh sách ảnh', async () => {
      await asAdmin(api().patch(`${API}/feedback/${encodeURIComponent(code)}/assign`))
        .send({ assignee: 'Lê Minh Tuấn', department: 'Địa chính – Xây dựng' })
        .expect(200);

      const resultImageId = await uploadPrivate('sau-xu-ly.jpg', 'image/jpeg');
      const res = await asAdmin(api().patch(`${API}/feedback/${encodeURIComponent(code)}/resolve`))
        .send({ note: 'Đã nạo vét cống, khơi thông dòng chảy', resultImageFileIds: [resultImageId] })
        .expect(200);

      expect(res.body.status).toBe('resolved');
      expect(res.body.resultImageFileIds).toEqual([resultImageId]);
    });

    it('đọc lại phiếu vẫn thấy cả ảnh hiện trường và ảnh nghiệm thu', async () => {
      const res = await asAdmin(api().get(`${API}/feedback/${encodeURIComponent(code)}`)).expect(200);
      expect(res.body.imageFileIds).toHaveLength(1);
      expect(res.body.resultImageFileIds).toHaveLength(1);
    });
  });
  /* ─────────── 5. Công dân gửi ảnh từ Zalo Mini App ─────────── */

  /**
   * Đây là luồng Mini App: công dân tự tải ảnh lên kho tệp rồi gửi kèm mã tệp.
   *
   * Ba phép thử cách ly ở cuối là bắt buộc theo `cach-ly-du-lieu-cong-dan.md`:
   * bỏ token, đổi token sang công dân khác, và cả hai đều KHÔNG được để lọt
   * dữ liệu — người khác dò mã phiếu phải nhận 404, không phải 403.
   */
  describe('Ảnh phản ánh của công dân', () => {
    let citizenToken: string;
    let code: string;
    let imageId: string;

    /** Ảnh do CÔNG DÂN tải lên (không phải cán bộ) — đúng như Mini App làm */
    async function uploadAsCitizen(token: string): Promise<string> {
      const res = await api()
        .post(`${API}/files/upload`)
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'feedback')
        .field('isPrivate', 'true')
        .attach('file', Buffer.from('anh hien truong'), {
          filename: 'hiện trường ngõ 12.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      return res.body.id as string;
    }

    it('công dân tải được ảnh hiện trường lên kho tệp', async () => {
      citizenToken = await loginCitizen(CITIZEN_PHONE);
      imageId = await uploadAsCitizen(citizenToken);
      expect(imageId).toBeTruthy();
    });

    it('gửi phiếu kèm mã ảnh, phản hồi có link đọc ảnh dùng được ngay', async () => {
      const res = await api()
        .post(`${API}/feedback/citizen`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          categoryKey: 'giao-thong',
          title: 'Cống thoát nước tắc gây ngập đầu ngõ 12',
          description: 'Mỗi khi mưa to nước ngập tới 40cm, xe máy không qua được.',
          location: 'Ngõ 12, Thôn Trung',
          imageFileIds: [imageId],
          channel: 'zalo',
        })
        .expect(201);

      code = res.body.code;
      expect(res.body.imageFileIds).toEqual([imageId]);
      expect(res.body.imageUrls).toHaveLength(1);
    });

    it('link đó tải được ảnh về thật, không phải chuỗi trang trí', async () => {
      const detail = await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent(code)}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      const url = detail.body.imageUrls[0] as string;
      const image = await api().get(url).expect(200);
      expect(image.headers['content-type']).toContain('image/jpeg');
    });

    /*
     * Đây là lỗi im lặng nhất của cả luồng: header đúng cú pháp, ảnh tải về
     * được bằng curl, nhưng trong webview Zalo (h5.zdn.vn — KHÁC site với tên
     * miền API) trình duyệt chặn thẻ <img> và không báo gì. Người dân chỉ thấy
     * ô ảnh trống. Không có test thì không cách nào biết nó tái diễn.
     */
    it('ảnh riêng tư phục vụ được cho webview KHÁC site (Zalo Mini App)', async () => {
      const detail = await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent(code)}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      const download = await api().get(detail.body.imageUrls[0] as string).expect(200);
      expect(download.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('tên tệp tiếng Việt của công dân cũng không bị hỏng', async () => {
      const detail = await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent(code)}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      const download = await api().get(detail.body.imageUrls[0] as string).expect(200);
      expect(download.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent('hiện trường ngõ 12.jpg')}`,
      );
    });

    /*
     * Đây là điểm đổi hướng so với `assertCanSign`: ảnh nghiệm thu do CÁN BỘ
     * tải lên, nên phân quyền theo người tải lên sẽ chặn chính công dân chủ
     * phiếu. Quyền đúng là quyền trên PHIẾU.
     */
    it('công dân xem được ảnh NGHIỆM THU do cán bộ tải lên cho phiếu của mình', async () => {
      await asAdmin(api().patch(`${API}/feedback/${encodeURIComponent(code)}/assign`))
        .send({ assignee: 'Lê Minh Tuấn', department: 'Địa chính – Xây dựng' })
        .expect(200);

      const resultId = await uploadPrivate('sau-xu-ly.jpg', 'image/jpeg');
      await asAdmin(api().patch(`${API}/feedback/${encodeURIComponent(code)}/resolve`))
        .send({ note: 'Đã nạo vét cống, khơi thông dòng chảy', resultImageFileIds: [resultId] })
        .expect(200);

      const detail = await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent(code)}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(detail.body.resultImageUrls).toHaveLength(1);
      await api().get(detail.body.resultImageUrls[0] as string).expect(200);
    });

    it('nhưng KHÔNG tự ký được link cho mã tệp của cán bộ (assertCanSign giữ nguyên)', async () => {
      const staffFileId = await uploadPrivate();
      await api()
        .get(`${API}/files/${staffFileId}/signed-url`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);
    });

    it('không có token thì không đọc được phiếu', async () => {
      await api().get(`${API}/feedback/citizen/mine/${encodeURIComponent(code)}`).expect(401);
    });

    it('công dân khác dò đúng mã phiếu vẫn nhận 404, không lộ là mã có thật', async () => {
      const otherToken = await loginCitizen(OTHER_CITIZEN_PHONE);
      await api()
        .get(`${API}/feedback/citizen/mine/${encodeURIComponent(code)}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('link ảnh KHÔNG xuất hiện trong danh sách phiếu của công dân khác', async () => {
      const otherToken = await loginCitizen(OTHER_CITIZEN_PHONE);
      const page = await api()
        .get(`${API}/feedback/citizen/mine`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(page.body.items).toHaveLength(0);
    });
  });
});
