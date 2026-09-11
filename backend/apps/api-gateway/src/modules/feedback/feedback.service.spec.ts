import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { FeedbackDocument, SlaRuleDocument } from '@vigov/shared';
import { duplicateKeyError, fakeDoc, queryChain } from '../../../../../test/support/mongoose-mock';
import type { RealtimeService } from '../realtime/realtime.service';
import type { NotificationService } from '../notification/notification.service';
import type { FilesService } from '../files/files.service';
import { FeedbackService } from './feedback.service';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const CITIZEN_PHONE = '0987654321';
const CITIZEN_NAME = 'Trần Thị Hoa';

/** Mã ảnh nghiệm thu dùng cho nhóm test resolve() */
const RESULT_IMAGE_IDS = ['64b7f3a2c1d4e5f6a7b8c9e0', '64b7f3a2c1d4e5f6a7b8c9e1'];

const VALID_DTO = {
  categoryKey: 'giao-thong',
  title: 'Ổ gà lớn đường liên thôn Đoài – Trung',
  description: 'Đoạn đường dài khoảng 60m xuất hiện nhiều ổ gà sâu, nước đọng.',
  location: 'Thôn Đoài, Xã Đại Thắng',
  channel: 'app',
};

/* ─────────────────────────── Tiện ích dựng mock ─────────────────────────── */

interface Harness {
  service: FeedbackService;
  created: Record<string, unknown>[];
  createMock: jest.Mock;
  countMock: jest.Mock;
  notifications: { [K in keyof NotificationService]: jest.Mock };
  realtime: { emitChange: jest.Mock };
  files: { findPrivateById: jest.Mock; mintSignedUrl: jest.Mock };
}

interface HarnessOptions {
  /** Mã phiếu gần nhất trong năm (nguồn để sinh số thứ tự kế tiếp) */
  latestCode?: string | null;
  /** Số phiếu công dân đã gửi trong 24 giờ qua */
  sentIn24h?: number;
  /** resolveDays lấy từ bảng sla_rules; null = chưa cấu hình lĩnh vực này */
  resolveDays?: number | null;
  /** Phiếu trả về cho findOne(...).exec() ở các luồng cập nhật */
  existing?: ReturnType<typeof fakeDoc> | null;
  /** Bản ghi lean trả về cho luồng chỉ đọc của công dân */
  leanDoc?: Record<string, unknown> | null;
  maxPerDay?: number;
}

function buildHarness(options: HarnessOptions = {}): Harness {
  const {
    latestCode = null,
    sentIn24h = 0,
    resolveDays = 5,
    existing = null,
    leanDoc = null,
    maxPerDay = 5,
  } = options;

  const created: Record<string, unknown>[] = [];

  const createMock = jest.fn(async (payload: Record<string, unknown>) => {
    created.push(payload);
    return fakeDoc({ ...payload, _id: `fb-${created.length}` });
  });

  const countMock = jest.fn(() => queryChain(sentIn24h));

  /**
   * `findOne` phục vụ ba dạng gọi khác nhau trong service:
   *   - nextCode:     .sort().select().lean().exec()  → bản ghi mã lớn nhất
   *   - findOrFail:   .exec()                          → tài liệu có save()
   *   - detailMine:   .select().lean().exec()          → bản ghi thuần
   * Mock trả về một chuỗi duy nhất, kết quả chọn theo dữ liệu được cấu hình.
   */
  const findOneMock = jest.fn((filter: Record<string, unknown>) => {
    if (filter.code instanceof RegExp) {
      return queryChain(latestCode ? { code: latestCode } : null);
    }
    return queryChain(existing ?? leanDoc);
  });

  const feedbackModel = {
    create: createMock,
    countDocuments: countMock,
    findOne: findOneMock,
    find: jest.fn(() => queryChain(leanDoc ? [leanDoc] : [])),
    aggregate: jest.fn(() => queryChain([])),
  } as unknown as Model<FeedbackDocument>;

  const slaRuleModel = {
    findOne: jest.fn(() => queryChain(resolveDays === null ? null : { resolveDays })),
  } as unknown as Model<SlaRuleDocument>;

  const notifications = {
    notifyFeedbackReceived: jest.fn(async () => undefined),
    notifyFeedbackResolved: jest.fn(async () => undefined),
    notifyStaff: jest.fn(async () => undefined),
  } as unknown as Harness['notifications'];

  const config = {
    get: jest.fn((key: string, fallback: unknown) =>
      key === 'security.feedbackMaxPerDay' ? maxPerDay : fallback,
    ),
  } as unknown as ConfigService;

  const realtime = { emitChange: jest.fn() };

  /* Ảnh gắn vào phiếu phải là tệp riêng tư (TB-09). Ở test thì mọi mã tệp đều
     coi như hợp lệ — luật đó có bộ test riêng ở tầng FilesService.
     `mintSignedUrl` trả một chuỗi nhận ra được để kiểm tra rằng phản hồi cho
     công dân có link đọc ảnh, không phải chỉ có mã tệp. */
  const files = {
    findPrivateById: jest.fn(async () => ({ isPrivate: true })),
    mintSignedUrl: jest.fn((id: string, ttl: number) => `/api/v1/files/${id}?exp=1&sig=sig&ttl=${ttl}`),
  };

  const service = new FeedbackService(
    feedbackModel,
    slaRuleModel,
    notifications as unknown as NotificationService,
    config,
    realtime as unknown as RealtimeService,
    files as unknown as FilesService,
  );

  return { service, created, createMock, countMock, notifications, realtime, files };
}

/* ───────────────────────── Sinh mã #PA-YYYY-nnnn ───────────────────────── */

describe('FeedbackService — sinh mã #PA-<năm>-<4 chữ số>', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 9, 30, 0)));
  afterEach(() => jest.useRealTimers());

  it('phiếu đầu tiên của năm là #PA-2026-0001', async () => {
    const h = buildHarness({ latestCode: null });
    const result = await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);
    expect(result.code).toBe('#PA-2026-0001');
  });

  it('tăng tiếp theo mã gần nhất: 0141 → 0142', async () => {
    const h = buildHarness({ latestCode: '#PA-2026-0141' });
    const result = await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);
    expect(result.code).toBe('#PA-2026-0142');
  });

  it('giữ đủ 4 chữ số có số 0 đứng đầu', async () => {
    const h = buildHarness({ latestCode: '#PA-2026-0008' });
    expect(
      (await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME)).code,
    ).toBe('#PA-2026-0009');
  });

  it('vượt 4 chữ số thì không cắt bớt: 9999 → 10000', async () => {
    const h = buildHarness({ latestCode: '#PA-2026-9999' });
    expect(
      (await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME)).code,
    ).toBe('#PA-2026-10000');
  });

  it('mã khớp đúng khuôn dạng mà app công dân đang phân tích', async () => {
    const h = buildHarness({ latestCode: '#PA-2026-0033' });
    const result = await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);
    expect(result.code).toMatch(/^#PA-\d{4}-\d{4}$/);
  });

  it('sinh lại mã khi trùng khoá do hai phiếu vào cùng lúc', async () => {
    const h = buildHarness({ latestCode: '#PA-2026-0010' });
    h.createMock.mockRejectedValueOnce(duplicateKeyError());

    const result = await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);
    expect(h.createMock).toHaveBeenCalledTimes(2);
    expect(result.code).toBe('#PA-2026-0011');
  });

  it('trả 503 sau 5 lần trùng khoá liên tiếp', async () => {
    const h = buildHarness({ latestCode: '#PA-2026-0010' });
    h.createMock.mockRejectedValue(duplicateKeyError());

    await expect(
      h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME),
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    expect(h.createMock).toHaveBeenCalledTimes(5);
  });

  it('lỗi khác lỗi trùng khoá được ném thẳng ra', async () => {
    const h = buildHarness();
    h.createMock.mockRejectedValueOnce(new Error('mất kết nối'));

    await expect(
      h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME),
    ).rejects.toThrow('mất kết nối');
    expect(h.createMock).toHaveBeenCalledTimes(1);
  });
});

/* ───────────────────────────── SLA ───────────────────────────── */

describe('FeedbackService — hạn xử lý SLA', () => {
  const NOW = new Date(2026, 2, 10, 9, 30, 0);

  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('slaDueAt = thời điểm gửi + resolveDays của lĩnh vực', async () => {
    const h = buildHarness({ resolveDays: 5 });
    await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);

    const due = h.created[0].slaDueAt as Date;
    expect(due.getTime() - NOW.getTime()).toBe(5 * MS_PER_DAY);
  });

  it('lĩnh vực chưa cấu hình SLA thì dùng mặc định 7 ngày', async () => {
    const h = buildHarness({ resolveDays: null });
    await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);

    const due = h.created[0].slaDueAt as Date;
    expect(due.getTime() - NOW.getTime()).toBe(7 * MS_PER_DAY);
  });

  it('slaHoursLeft ngay sau khi gửi = resolveDays × 24 giờ', async () => {
    const h = buildHarness({ resolveDays: 3 });
    const result = await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);
    expect(result.slaHoursLeft).toBeCloseTo(72, 1);
  });

  it('slaHoursLeft ÂM khi phiếu đã quá hạn', async () => {
    const overdueBy = 5.5 * MS_PER_HOUR;
    const h = buildHarness({
      leanDoc: {
        code: '#PA-2026-0007',
        status: 'processing',
        slaDueAt: new Date(NOW.getTime() - overdueBy),
      },
    });

    const result = await h.service.detailMine('#PA-2026-0007', CITIZEN_PHONE);
    expect(result.slaHoursLeft).toBeCloseTo(-5.5, 1);
    expect(result.slaHoursLeft as number).toBeLessThan(0);
  });

  it('slaHoursLeft dương khi còn hạn', async () => {
    const h = buildHarness({
      leanDoc: {
        code: '#PA-2026-0007',
        status: 'processing',
        slaDueAt: new Date(NOW.getTime() + 12 * MS_PER_HOUR),
      },
    });

    expect((await h.service.detailMine('#PA-2026-0007', CITIZEN_PHONE)).slaHoursLeft).toBeCloseTo(12, 1);
  });

  it('phiếu không có mốc SLA thì slaHoursLeft là null (không phải 0)', async () => {
    const h = buildHarness({ leanDoc: { code: '#PA-2026-0007', status: 'received' } });
    expect((await h.service.detailMine('#PA-2026-0007', CITIZEN_PHONE)).slaHoursLeft).toBeNull();
  });

  it('phiếu của người khác coi như không tồn tại', async () => {
    const h = buildHarness({ leanDoc: null });
    await expect(h.service.detailMine('#PA-2026-0007', CITIZEN_PHONE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/* ──────────────────────── Ngưỡng chống spam ──────────────────────── */

describe('FeedbackService — chống spam phản ánh', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 9, 30, 0)));
  afterEach(() => jest.useRealTimers());

  const send = (h: Harness) =>
    h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);

  it('DƯỚI ngưỡng vẫn gửi được', async () => {
    const h = buildHarness({ maxPerDay: 5, sentIn24h: 4 });
    await expect(send(h)).resolves.toMatchObject({ status: 'received' });
    expect(h.createMock).toHaveBeenCalledTimes(1);
  });

  it('ĐÚNG ngưỡng đã bị chặn (so sánh >=, không phải >)', async () => {
    const h = buildHarness({ maxPerDay: 5, sentIn24h: 5 });
    await expect(send(h)).rejects.toBeInstanceOf(HttpException);
    expect(h.createMock).not.toHaveBeenCalled();
  });

  it('vượt ngưỡng trả mã 429 kèm thông báo có số liệu thật', async () => {
    const h = buildHarness({ maxPerDay: 3, sentIn24h: 7 });

    await expect(send(h)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(send(h)).rejects.toThrow(/7 phản ánh trong 24 giờ/);
    await expect(send(h)).rejects.toThrow(/tối đa 3 phản ánh mỗi ngày/);
  });

  it('chỉ đếm phiếu của CHÍNH số điện thoại đó trong cửa sổ 24 giờ', async () => {
    const h = buildHarness({ maxPerDay: 5, sentIn24h: 0 });
    await send(h);

    const filter = h.countMock.mock.calls[0][0] as {
      citizenPhone: string;
      createdAt: { $gte: Date };
    };
    expect(filter.citizenPhone).toBe(CITIZEN_PHONE);
    expect(Date.now() - filter.createdAt.$gte.getTime()).toBe(24 * MS_PER_HOUR);
  });

  it('ngưỡng lấy từ cấu hình security.feedbackMaxPerDay', async () => {
    const h = buildHarness({ maxPerDay: 1, sentIn24h: 1 });
    await expect(send(h)).rejects.toBeInstanceOf(HttpException);
  });
});

/* ─────────────────── Nội dung phiếu vừa tạo ─────────────────── */

describe('FeedbackService.createByCitizen — nội dung phiếu', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 9, 30, 0)));
  afterEach(() => jest.useRealTimers());

  it('phiếu mới ở trạng thái "received", chưa phân công, chưa đánh giá', async () => {
    const h = buildHarness();
    await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);

    expect(h.created[0]).toMatchObject({
      status: 'received',
      assignee: '',
      department: '',
      rating: 0,
      citizenPhone: CITIZEN_PHONE,
      sentAt: '10/03/2026 09:30',
    });
  });

  it('nhật ký ban đầu có mốc "đã gửi" và mốc "chờ tiếp nhận"', async () => {
    const h = buildHarness();
    await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);

    const timeline = h.created[0].timeline as { title: string; state: string }[];
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ state: 'ok' });
    expect(timeline[0].title).toContain('Công dân gửi phản ánh');
    expect(timeline[1]).toMatchObject({ state: 'cur' });
  });

  it('lấy tên công dân từ hồ sơ khi phiếu không khai tên', async () => {
    const h = buildHarness();
    await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);
    expect(h.created[0].citizenName).toBe(CITIZEN_NAME);
  });

  it('báo công dân và phát tín hiệu thời gian thực sau khi tạo', async () => {
    const h = buildHarness();
    await h.service.createByCitizen(VALID_DTO as never, CITIZEN_PHONE, CITIZEN_NAME);

    expect(h.notifications.notifyFeedbackReceived).toHaveBeenCalledTimes(1);
    expect(h.realtime.emitChange).toHaveBeenCalledTimes(1);
  });
});

/* ─────────────────── Che số điện thoại cho cán bộ ─────────────────── */

describe('FeedbackService — che số điện thoại trong dữ liệu trả cho cán bộ', () => {
  it('giữ 3 số đầu và 3 số cuối', async () => {
    const h = buildHarness({ leanDoc: { code: '#PA-2026-0007', citizenPhone: '0987654321' } });
    const result = await h.service.detail('#PA-2026-0007');
    expect(result.citizenPhone).toBe('098•••321');
  });

  it('số quá ngắn thì giữ nguyên (không lộ thêm gì)', async () => {
    const h = buildHarness({ leanDoc: { code: '#PA-2026-0007', citizenPhone: '09876' } });
    expect((await h.service.detail('#PA-2026-0007')).citizenPhone).toBe('09876');
  });

  it('không có số điện thoại thì trả chuỗi rỗng', async () => {
    const h = buildHarness({ leanDoc: { code: '#PA-2026-0007' } });
    expect((await h.service.detail('#PA-2026-0007')).citizenPhone).toBe('');
  });
});

/* ─────────────────── Công dân đánh giá ─────────────────── */

describe('FeedbackService.rateMine', () => {
  it('chỉ cho đánh giá khi phiếu ĐÃ xử lý xong (409 nếu chưa)', async () => {
    const h = buildHarness({
      existing: fakeDoc({ code: '#PA-2026-0007', status: 'processing', timeline: [] as unknown[] }),
    });

    await expect(
      h.service.rateMine('#PA-2026-0007', CITIZEN_PHONE, { rating: 5 } as never),
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
  });

  it('ghi điểm, nhận xét và một mốc nhật ký khi phiếu đã xong', async () => {
    const fb = fakeDoc({ code: '#PA-2026-0007', status: 'resolved', timeline: [] as unknown[] });
    const h = buildHarness({ existing: fb });

    const result = await h.service.rateMine('#PA-2026-0007', CITIZEN_PHONE, {
      rating: 4,
      ratingComment: 'Xử lý nhanh',
    } as never);

    expect(result).toMatchObject({ rating: 4, ratingComment: 'Xử lý nhanh' });
    expect(fb.timeline).toHaveLength(1);
    const moc = fb.timeline[0] as { action: string; detail: string; actorId: string };
    expect(moc.action).toBe('feedback.rate');
    expect(moc.detail).toBe('4 · Xử lý nhanh');
    // Công dân không có tài khoản cán bộ nên actorId để rỗng
    expect(moc.actorId).toBe('');
    expect(fb.save).toHaveBeenCalled();
  });

  it('không tìm thấy phiếu của mình thì 404', async () => {
    const h = buildHarness({ existing: null, leanDoc: null });
    await expect(
      h.service.rateMine('#PA-2026-0007', CITIZEN_PHONE, { rating: 5 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

/**
 * Ảnh phản ánh là tệp RIÊNG TƯ, nên `<img src="/files/<id>">` bị máy chủ từ
 * chối. Phản hồi cho công dân phải kèm link ĐÃ KÝ, nếu không người dân gửi ảnh
 * xong không bao giờ xem lại được chính ảnh mình gửi — và ảnh nghiệm thu do cán
 * bộ chụp thì càng không, vì `assertCanSign` phân quyền theo người tải lên.
 */
describe('FeedbackService — link đọc ảnh trong phản hồi cho công dân', () => {
  const IMAGE_IDS = ['64b7f3a2c1d4e5f6a7b8c9d0', '64b7f3a2c1d4e5f6a7b8c9d1'];
  const RESULT_IDS = ['64b7f3a2c1d4e5f6a7b8c9d2'];

  /** Bản ghi lean như CITIZEN_PROJECTION trả về */
  const leanTicket = {
    code: '#PA-2026-0009',
    status: 'resolved',
    imageFileIds: IMAGE_IDS,
    resultImageFileIds: RESULT_IDS,
  };

  it('chi tiết phiếu kèm link cho cả ảnh hiện trường và ảnh nghiệm thu', async () => {
    const h = buildHarness({ leanDoc: leanTicket });

    const result = await h.service.detailMine('#PA-2026-0009', CITIZEN_PHONE);

    expect(result.imageUrls).toHaveLength(IMAGE_IDS.length);
    expect(result.resultImageUrls).toHaveLength(RESULT_IDS.length);
    // Mã tệp vẫn giữ nguyên trong phản hồi — giao diện cũ dựa vào nó
    expect(result.imageFileIds).toEqual(IMAGE_IDS);
  });

  it('link được ký cho ĐÚNG mã tệp của phiếu', async () => {
    const h = buildHarness({ leanDoc: leanTicket });

    await h.service.detailMine('#PA-2026-0009', CITIZEN_PHONE);

    const signedIds = h.files.mintSignedUrl.mock.calls.map((call) => call[0]);
    expect(signedIds).toEqual([...IMAGE_IDS, ...RESULT_IDS]);
  });

  it('danh sách phiếu cũng kèm link, không chỉ màn chi tiết', async () => {
    const h = buildHarness({ leanDoc: leanTicket });

    const page = await h.service.listMine(CITIZEN_PHONE, {} as never);

    expect(page.items[0].imageUrls).toHaveLength(IMAGE_IDS.length);
  });

  it('phiếu không có ảnh thì trả mảng rỗng, không phải undefined', async () => {
    const h = buildHarness({ leanDoc: { code: '#PA-2026-0010', status: 'received' } });

    const result = await h.service.detailMine('#PA-2026-0010', CITIZEN_PHONE);

    expect(result.imageUrls).toEqual([]);
    expect(result.resultImageUrls).toEqual([]);
    expect(h.files.mintSignedUrl).not.toHaveBeenCalled();
  });

  it('phiếu công dân vừa gửi đã có link đọc ảnh ngay trong phản hồi', async () => {
    const h = buildHarness();

    const result = await h.service.createByCitizen(
      { ...VALID_DTO, imageFileIds: IMAGE_IDS } as never,
      CITIZEN_PHONE,
      CITIZEN_NAME,
    );

    expect(result.imageUrls).toHaveLength(IMAGE_IDS.length);
  });
});

/** Ảnh nghiệm thu cũng phải riêng tư — cùng một lý do với ảnh hiện trường */
describe('FeedbackService.resolve — ảnh nghiệm thu', () => {
  it('kiểm tra từng mã ảnh nghiệm thu phải là tệp riêng tư', async () => {
    const fb = fakeDoc({ code: '#PA-2026-0011', status: 'processing', timeline: [] as unknown[] });
    const h = buildHarness({ existing: fb });

    await h.service.resolve(
      '#PA-2026-0011',
      { note: 'Đã nạo vét cống', resultImageFileIds: RESULT_IMAGE_IDS } as never,
      { id: '66f10000000000000000cb01', name: 'Lê Minh Tuấn' },
    );

    expect(h.files.findPrivateById).toHaveBeenCalledTimes(RESULT_IMAGE_IDS.length);
    expect(h.files.findPrivateById).toHaveBeenCalledWith(RESULT_IMAGE_IDS[0], 'Ảnh nghiệm thu');
  });

  it('không gửi ảnh nghiệm thu thì không kiểm tra gì', async () => {
    const fb = fakeDoc({ code: '#PA-2026-0012', status: 'processing', timeline: [] as unknown[] });
    const h = buildHarness({ existing: fb });

    await h.service.resolve('#PA-2026-0012', { note: 'Đã xử lý' } as never, {
      id: '66f10000000000000000cb01',
      name: 'Lê Minh Tuấn',
    });

    expect(h.files.findPrivateById).not.toHaveBeenCalled();
  });
});
