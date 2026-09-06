import { NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { DossierDocument } from '@vigov/shared';
import { queryChain } from '../../../../../test/support/mongoose-mock';
import { DossiersService, maskPhone, normalizeCode, toLookupView } from './dossiers.service';

/**
 * VÌ SAO ĐÁNG MỘT BỘ TEST RIÊNG: cả ba thứ dưới đây hỏng LẶNG LẼ.
 *
 *   · Chuẩn hoá mã: quên `toUpperCase()` thì hồ sơ CÓ THẬT vẫn báo "không tìm
 *     thấy". Không có lỗi nào, không có nhật ký nào — chỉ là người dân gõ chữ
 *     thường rồi kết luận hệ thống chưa nhận hồ sơ của mình.
 *   · Che số điện thoại: endpoint này CÔNG KHAI. Trả lộn số thật ra là rò dữ
 *     liệu cá nhân, mà phản hồi vẫn "đúng" nên không ai phát hiện qua thử tay.
 *   · Suy `steps[].done`: lệch một chỉ số là tracker báo sai bước, hồ sơ đang
 *     chờ ký hiện thành đã trả kết quả.
 */

/** Mốc thời gian cố định để không phụ thuộc giờ chạy test */
const SUBMITTED = new Date('2026-08-24T02:15:00.000Z');
const APPRAISED = new Date('2026-08-25T02:15:00.000Z');
const DUE = new Date('2026-08-27T16:59:59.999Z');

const DOSSIER = {
  code: 'HS-2026-04182',
  procedure: 'Cấp bản sao trích lục khai sinh',
  applicantName: 'Nguyễn Văn Hùng',
  applicantPhone: '0912480311',
  department: 'Tư pháp, Hộ tịch',
  assignee: 'Trần Thị Lan',
  status: 'appraising',
  note: 'Đang đối chiếu sổ gốc',
  submittedAt: SUBMITTED,
  dueAt: DUE,
  stepTimes: [
    { key: 'received', at: SUBMITTED },
    { key: 'appraising', at: APPRAISED },
  ],
};

interface Harness {
  service: DossiersService;
  /** Bộ lọc mà findOne nhận được — nơi kiểm mã đã chuẩn hoá hay chưa */
  findOne: jest.Mock;
}

function makeService(found: Record<string, unknown> | null = DOSSIER): Harness {
  const findOne = jest.fn(() => queryChain(found));
  const service = new DossiersService({ findOne } as unknown as Model<DossierDocument>);
  return { service, findOne };
}

/** Bộ lọc truy vấn của lần gọi findOne đầu tiên */
function filterOf(findOne: jest.Mock): { code: string } {
  return findOne.mock.calls[0][0] as { code: string };
}

describe('normalizeCode', () => {
  it('đưa về chữ HOA — công dân gõ lại mã từ giấy thường không viết hoa', () => {
    expect(normalizeCode('hs-2026-04182')).toBe('HS-2026-04182');
  });

  it('cắt khoảng trắng hai đầu — dán từ tin nhắn hay kèm dấu cách', () => {
    expect(normalizeCode('  HS-2026-04182 ')).toBe('HS-2026-04182');
  });

  it('mã rỗng / thiếu vẫn cho ra chuỗi rỗng, không nổ', () => {
    expect(normalizeCode('   ')).toBe('');
    expect(normalizeCode(undefined)).toBe('');
  });
});

describe('maskPhone', () => {
  it('giữ 3 số đầu + 3 số cuối, giống UsersService.maskPhone', () => {
    expect(maskPhone('0912480311')).toBe('091•••311');
  });

  it('số quá ngắn để che được thì giữ nguyên, không trả chuỗi hỏng', () => {
    expect(maskPhone('09123')).toBe('09123');
  });

  it('không có số điện thoại thì trả chuỗi rỗng', () => {
    expect(maskPhone('')).toBe('');
    expect(maskPhone(undefined)).toBe('');
  });
});

describe('DossiersService.lookup', () => {
  it('truy vấn bằng mã ĐÃ chuẩn hoá, không phải mã người dùng gõ', async () => {
    const { service, findOne } = makeService();

    await service.lookup('  hs-2026-04182  ');

    expect(filterOf(findOne)).toEqual({ code: 'HS-2026-04182' });
  });

  it('KHÔNG BAO GIỜ trả số điện thoại thật — endpoint này công khai', async () => {
    const { service } = makeService();

    const result = await service.lookup('HS-2026-04182');

    expect(result.applicantPhone).toBe('091•••311');
    expect(JSON.stringify(result)).not.toContain('0912480311');
  });

  it('không thấy mã thì 404 kèm thông báo tiếng Việt có nhắc lại mã đã tra', async () => {
    const { service } = makeService(null);

    await expect(service.lookup('HS-2026-99999')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.lookup('HS-2026-99999')).rejects.toThrow(/Không tìm thấy hồ sơ có mã "HS-2026-99999"/);
  });

  it('mã rỗng thì 404 luôn, KHÔNG chạy truy vấn rỗng xuống cơ sở dữ liệu', async () => {
    const { service, findOne } = makeService();

    await expect(service.lookup('   ')).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).not.toHaveBeenCalled();
  });
});

describe('toLookupView — tracker 4 bước', () => {
  it('luôn trả đủ 4 bước theo đúng thứ tự và nhãn của hợp đồng API', () => {
    const view = toLookupView(DOSSIER);

    expect(view.steps.map((step) => step.key)).toEqual([
      'received',
      'appraising',
      'awaiting_signature',
      'returned',
    ]);
    expect(view.steps.map((step) => step.label)).toEqual([
      'Tiếp nhận',
      'Thẩm định',
      'Chờ ký duyệt',
      'Trả kết quả',
    ]);
  });

  it('bước trước bước hiện tại là xong; bước hiện tại CHƯA xong', () => {
    const view = toLookupView(DOSSIER);

    expect(view.steps.map((step) => step.done)).toEqual([true, false, false, false]);
  });

  it('bước chưa tới thì at = null, bước đã đi qua có mốc ISO', () => {
    const view = toLookupView(DOSSIER);

    expect(view.steps[0].at).toBe(SUBMITTED.toISOString());
    expect(view.steps[1].at).toBe(APPRAISED.toISOString());
    expect(view.steps[2].at).toBeNull();
    expect(view.steps[3].at).toBeNull();
  });

  it('hồ sơ đã trả kết quả thì CẢ 4 bước đều xong', () => {
    const view = toLookupView({ ...DOSSIER, status: 'returned' });

    expect(view.steps.every((step) => step.done)).toBe(true);
  });

  it('hồ sơ mới tiếp nhận thì chưa bước nào xong', () => {
    const view = toLookupView({ ...DOSSIER, status: 'received' });

    expect(view.steps.map((step) => step.done)).toEqual([false, false, false, false]);
  });

  it('thiếu mốc của một bước đã đi qua thì at = null, không nổ và không trả rác', () => {
    const view = toLookupView({ ...DOSSIER, stepTimes: [] });

    expect(view.steps.map((step) => step.at)).toEqual([null, null, null, null]);
    expect(view.steps[0].done).toBe(true);
  });

  it('trạng thái lạ (dữ liệu di trú lỗi) thì không bước nào được coi là xong', () => {
    const view = toLookupView({ ...DOSSIER, status: 'khong-ton-tai' });

    expect(view.steps.every((step) => !step.done)).toBe(true);
    expect(view.steps.every((step) => step.at === null)).toBe(true);
  });

  it('mốc thời gian trả về dạng ISO để client tự định dạng theo múi giờ', () => {
    const view = toLookupView(DOSSIER);

    expect(view.submittedAt).toBe(SUBMITTED.toISOString());
    expect(view.dueAt).toBe(DUE.toISOString());
  });
});
