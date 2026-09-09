import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { BudgetItemDocument, JwtPayload } from '@vigov/shared';
import { fakeDoc, queryChain } from '../../../../../test/support/mongoose-mock';
import { DisbursementService } from './disbursement.service';

/** Người dùng giả đóng vai lãnh đạo duyệt */
const LEADER = { username: 'binh.nv', displayName: 'Nguyễn Văn Bình' } as unknown as JwtPayload;

/** Đề nghị mẫu: 0,5 tỷ đang chờ duyệt */
const REQUEST = {
  code: 'DN-01',
  amount: '0,5 tỷ',
  amountTyDong: 0.5,
  content: 'Thanh toán khối lượng đợt 2',
  vendor: 'Công ty A',
  status: 'pending',
  requestedBy: 'Kế toán',
  requestedAt: '09:00 20/08/2026',
  decidedBy: '',
  decidedAt: '',
  rejectReason: '',
  voucherNo: '',
  disbursedAt: '',
};

/**
 * Vòng đời đề nghị giải ngân — luồng một cấp duyệt:
 *   pending → approved → disbursed, hoặc pending → rejected.
 *
 * Điểm dễ sai nhất: tiền chỉ được cộng vào luỹ kế ĐÚNG MỘT LẦN, ở bước ghi nhận
 * đã chi. Duyệt hai lần hay ghi nhận chi lại đề nghị đã chi mà lọt thì báo cáo
 * giải ngân sẽ vượt số tiền thật đã chuyển.
 */
describe('DisbursementService — vòng đời đề nghị giải ngân', () => {
  /** Hạng mục giả: kế hoạch 3 tỷ, đã chi 1 tỷ, sẵn một đề nghị theo `overrides` */
  function makeService(overrides: Partial<typeof REQUEST> = {}, planned = 3, actual = 1) {
    const item = fakeDoc({
      code: 'HM-01',
      name: 'Đường giao thông thôn Đông',
      planned,
      actual,
      delayed: false,
      entries: [] as Record<string, unknown>[],
      comments: [] as Record<string, unknown>[],
      obstacles: [] as Record<string, unknown>[],
      requests: [{ ...REQUEST, ...overrides }],
    });
    const findOne = jest.fn(() => queryChain(item));
    const service = new DisbursementService({ findOne } as unknown as Model<BudgetItemDocument>);
    return { service, item };
  }

  it('duyệt: pending → approved, CHƯA cộng tiền vào luỹ kế', async () => {
    const { service, item } = makeService();

    await service.approveRequest('HM-01', 'DN-01', LEADER);

    expect(item.requests[0].status).toBe('approved');
    expect(item.requests[0].decidedBy).toBe('Nguyễn Văn Bình');
    // Mấu chốt: duyệt xong tiền vẫn chưa rời kho bạc nên luỹ kế giữ nguyên
    expect(item.actual).toBe(1);
    expect(item.entries).toHaveLength(0);
  });

  it('từ chối: lưu lý do và chuyển sang rejected', async () => {
    const { service, item } = makeService();

    await service.rejectRequest('HM-01', 'DN-01', { reason: 'Thiếu hồ sơ thẩm định' }, LEADER);

    expect(item.requests[0].status).toBe('rejected');
    expect(item.requests[0].rejectReason).toBe('Thiếu hồ sơ thẩm định');
    expect(item.actual).toBe(1);
  });

  it('ghi nhận đã chi: cộng luỹ kế và sinh một dòng lịch sử giải ngân', async () => {
    const { service, item } = makeService({ status: 'approved' });

    const res = await service.disburseRequest(
      'HM-01',
      'DN-01',
      { voucherNo: 'UNC 118/2026', date: '25/08/2026' },
      LEADER,
    );

    expect(item.requests[0].status).toBe('disbursed');
    expect(item.actual).toBe(1.5); // 1 + 0,5
    expect(item.entries).toHaveLength(1);
    expect(item.entries[0]).toMatchObject({
      date: '25/08/2026',
      amount: '0,5 tỷ',
      voucherNo: 'UNC 118/2026',
      content: 'Thanh toán khối lượng đợt 2',
    });
    expect(res.percent).toBe(50);
  });

  it('không ghi nhận chi được hai lần cho cùng một đề nghị', async () => {
    const { service, item } = makeService({ status: 'disbursed' });

    await expect(
      service.disburseRequest('HM-01', 'DN-01', { voucherNo: 'UNC 999' }, LEADER),
    ).rejects.toThrow(BadRequestException);
    // Luỹ kế không bị cộng thêm lần nữa
    expect(item.actual).toBe(1);
  });

  it('không duyệt được đề nghị đã bị từ chối', async () => {
    const { service } = makeService({ status: 'rejected' });

    await expect(service.approveRequest('HM-01', 'DN-01', LEADER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('không ghi nhận chi được đề nghị còn đang chờ duyệt', async () => {
    const { service } = makeService({ status: 'pending' });

    await expect(
      service.disburseRequest('HM-01', 'DN-01', { voucherNo: 'UNC 1' }, LEADER),
    ).rejects.toThrow(BadRequestException);
  });

  it('không tìm thấy mã đề nghị thì trả 404', async () => {
    const { service } = makeService();

    await expect(service.approveRequest('HM-01', 'DN-99', LEADER)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('chặn đề nghị vượt phần vốn còn lại, có tính cả đề nghị đang treo', async () => {
    // Kế hoạch 3, đã chi 1, đang treo 0,5 → chỉ còn 1,5 tỷ
    const { service } = makeService({ status: 'pending' });

    await expect(
      service.createRequest('HM-01', { amount: '2 tỷ', content: 'Đợt 3' }, LEADER),
    ).rejects.toThrow(BadRequestException);
  });

  it('đề nghị nằm trong phần vốn còn lại được ghi nhận, mã DN tăng dần', async () => {
    const { service, item } = makeService({ status: 'pending' });

    const res = await service.createRequest(
      'HM-01',
      { amount: '1 tỷ', content: 'Đợt 3', vendor: 'Công ty B' },
      LEADER,
    );

    expect(res.request.code).toBe('DN-02');
    expect(res.request.status).toBe('pending');
    expect(item.requests).toHaveLength(2);
    // Còn lại = 3 − 1 đã chi − (0,5 treo + 1 vừa gửi) = 0,5
    expect(res.remaining).toBeCloseTo(0.5, 9);
  });

  it('đề nghị đã bị từ chối không chiếm phần vốn còn lại', async () => {
    const { service } = makeService({ status: 'rejected' });

    // Kế hoạch 3, đã chi 1, đề nghị cũ bị từ chối → còn nguyên 2 tỷ để đề nghị
    const res = await service.createRequest('HM-01', { amount: '2 tỷ', content: 'Đợt 3' }, LEADER);

    expect(res.request.code).toBe('DN-02');
    expect(res.remaining).toBeCloseTo(0, 9);
  });
});

/**
 * Xoá mềm hạng mục ngân sách.
 *
 * Hạng mục đã phát sinh lần chi là số liệu quyết toán — xoá cứng là mất dấu
 * tiền đã giải ngân, nên chỉ bật cờ `isDeleted` và cho khôi phục.
 */
describe('DisbursementService.softDelete / restore', () => {
  const deletedDoc = {
    code: 'HM-09',
    name: 'Hạng mục nhập trùng',
    isDeleted: true,
    deletedAt: new Date(),
  };

  function makeService(doc: Record<string, unknown> | null = deletedDoc) {
    const findOneAndUpdate: jest.Mock = jest.fn(() => queryChain(doc));
    const service = new DisbursementService({
      findOneAndUpdate,
    } as unknown as Model<BudgetItemDocument>);
    return { service, findOneAndUpdate };
  }

  const admin = { username: 'admin' } as unknown as JwtPayload;

  it('bật cờ isDeleted chứ không xoá tài liệu khỏi CSDL', async () => {
    const { service, findOneAndUpdate } = makeService();

    await service.softDelete('HM-09', { reason: '  Nhập trùng HM-04  ' }, admin);

    const [filter, update] = findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
    ];
    // Chỉ xoá được bản ghi CHƯA xoá — gọi lần hai phải ra 404, không ghi đè mốc xoá cũ
    expect(filter).toMatchObject({ code: 'HM-09', isDeleted: { $ne: true } });
    expect(update.$set.isDeleted).toBe(true);
    expect(update.$set.deletedAt).toBeInstanceOf(Date);
    expect(update.$set.deletedBy).toBe('admin');
    // Lý do được cắt khoảng trắng thừa trước khi lưu
    expect(update.$set.deleteReason).toBe('Nhập trùng HM-04');
  });

  it('không nhập lý do thì không ghi trường rỗng vào bản ghi', async () => {
    const { service, findOneAndUpdate } = makeService();

    await service.softDelete('HM-09', { reason: '   ' }, admin);

    const update = findOneAndUpdate.mock.calls[0][1] as { $set: Record<string, unknown> };
    expect(update.$set).not.toHaveProperty('deleteReason');
  });

  it('xoá hạng mục không tồn tại hoặc đã xoá rồi thì trả 404', async () => {
    const { service } = makeService(null);

    await expect(service.softDelete('HM-99', {}, admin)).rejects.toThrow(NotFoundException);
  });

  it('khôi phục xoá mốc deletedAt và các trường đi kèm', async () => {
    const { service, findOneAndUpdate } = makeService();

    await service.restore('HM-09');

    const [filter, update] = findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $unset: Record<string, unknown> },
    ];
    expect(filter).toMatchObject({ code: 'HM-09', isDeleted: true });
    expect(update.$set).toEqual({ isDeleted: false, deletedAt: null });
    expect(update.$unset).toEqual({ deletedBy: '', deleteReason: '' });
  });

  it('khôi phục hạng mục chưa từng bị xoá thì trả 404', async () => {
    const { service } = makeService(null);

    await expect(service.restore('HM-01')).rejects.toThrow(NotFoundException);
  });
});

/**
 * Danh sách hạng mục phải loại hạng mục đã xoá mềm khỏi cả danh sách LẪN số
 * liệu tổng hợp — nếu vẫn cộng vào tổng kế hoạch vốn thì tỷ lệ giải ngân sai.
 */
describe('DisbursementService.list — lọc hạng mục đã xoá', () => {
  function makeService() {
    const find: jest.Mock = jest.fn(() => queryChain([] as Record<string, unknown>[]));
    const service = new DisbursementService({ find } as unknown as Model<BudgetItemDocument>);
    return { service, find };
  }

  it('mặc định chỉ lấy hạng mục chưa xoá', async () => {
    const { service, find } = makeService();

    await service.list({ year: 2026 });

    // `$ne: true` chứ không phải `false`: khớp cả bản ghi cũ chưa có trường isDeleted
    expect(find.mock.calls[0][0]).toMatchObject({ year: 2026, isDeleted: { $ne: true } });
  });

  it('deleted=true thì chỉ lấy hạng mục đã xoá', async () => {
    const { service, find } = makeService();

    await service.list({ year: 2026, deleted: true });

    expect(find.mock.calls[0][0]).toMatchObject({ year: 2026, isDeleted: true });
  });
});
