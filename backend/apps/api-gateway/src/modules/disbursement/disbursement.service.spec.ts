import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { BudgetItemDocument, JwtPayload } from '@vigov/shared';
import { fakeDoc, queryChain } from '../../../../../test/support/mongoose-mock';
import { DisbursementService } from './disbursement.service';

/**
 * Luật nghiệp vụ của phân hệ Giải ngân.
 *
 * Bộ test trước đây kiểm hàm `parseAmountToTyDong` — nhận số tiền dạng chuỗi tự
 * do ("1,25 tỷ") rồi quy về số thực đơn vị tỷ đồng. Cả cơ chế đó đã bỏ: nó làm
 * mất tiền khi làm tròn, và "1,200 triệu" bị hiểu thành 1,2 triệu (sai 1000
 * lần). Nay tiền là SỐ NGUYÊN ĐƠN VỊ ĐỒNG, chặn ngay ở DTO.
 *
 * Bộ test này khoá lại những luật mà nếu sai thì số liệu quyết toán sai:
 * workflow phê duyệt, điều chỉnh dự toán phải có căn cứ, hoàn trả, và các chốt
 * chặn không cho phát sinh tiền ngoài hồ sơ đã duyệt.
 */

const TY = 1_000_000_000;

const CONFIG = {
  get: (key: string) =>
    ({ 'disbursement.riskRatio': 0.8, 'disbursement.dueSoonDays': 30 })[key],
} as unknown as ConfigService;

const KE_TOAN = { username: 'ha.dt', displayName: 'Đỗ Thanh Hà' } as unknown as JwtPayload;
const LANH_DAO = { username: 'binh.nv', displayName: 'Nguyễn Văn Bình' } as unknown as JwtPayload;

/** Hạng mục giả — mặc định đã phê duyệt, dự toán 3 tỷ, đã chi 1 tỷ */
function makeService(over: Record<string, unknown> = {}) {
  const item = fakeDoc({
    code: 'HM-01',
    name: 'Đường giao thông thôn Đông',
    year: 2026,
    approvalStatus: 'da-duyet',
    initialPlannedDong: 3 * TY,
    plannedDong: 3 * TY,
    actualDong: 1 * TY,
    startDate: '01/01/2026',
    endDate: '31/12/2026',
    entries: [
      { type: 'chi', amountDong: 1 * TY, date: '10/03/2026', content: 'Đợt 1' },
    ] as Record<string, unknown>[],
    adjustments: [] as Record<string, unknown>[],
    documents: [] as Record<string, unknown>[],
    progressLogs: [] as Record<string, unknown>[],
    quarterPlans: [] as Record<string, unknown>[],
    comments: [] as Record<string, unknown>[],
    obstacles: [] as Record<string, unknown>[],
    requests: [] as Record<string, unknown>[],
    ...over,
  });
  const findOne = jest.fn(() => queryChain(item));
  const service = new DisbursementService(
    { findOne } as unknown as Model<BudgetItemDocument>,
    CONFIG,
  );
  return { service, item };
}

describe('Workflow trạng thái hồ sơ', () => {
  it('chỉ cho những bước chuyển đã khai, và nói rõ bước hợp lệ là gì', async () => {
    const { service } = makeService({ approvalStatus: 'nhap' });

    // Nháp không nhảy thẳng sang Đã phê duyệt được — phải qua Chờ duyệt
    await expect(
      service.changeStatus('HM-01', { status: 'da-duyet' }, LANH_DAO),
    ).rejects.toThrow(/Bước chuyển hợp lệ/);
  });

  it('nháp → chờ duyệt được, và ghi một mốc vào lịch sử tiến độ', async () => {
    const { service, item } = makeService({ approvalStatus: 'nhap' });

    await service.changeStatus('HM-01', { status: 'cho-duyet' }, KE_TOAN);

    expect(item.approvalStatus).toBe('cho-duyet');
    expect(item.progressLogs).toHaveLength(1);
    expect(item.progressLogs[0]).toMatchObject({
      fromStatus: 'nhap',
      toStatus: 'cho-duyet',
      by: 'Đỗ Thanh Hà',
    });
  });

  it('từ chối / tạm dừng / huỷ BẮT BUỘC nêu lý do', async () => {
    const { service } = makeService({ approvalStatus: 'cho-duyet' });

    await expect(service.changeStatus('HM-01', { status: 'tu-choi' }, LANH_DAO)).rejects.toThrow(
      /phải nêu lý do/,
    );
  });

  it('không quyết toán được khi còn đề nghị chưa ghi nhận đã chi', async () => {
    // Quyết toán là mốc chốt số liệu năm; còn đề nghị treo là còn tiền chưa rõ
    const { service } = makeService({
      requests: [{ code: 'DN-01', amountDong: 500_000_000, status: 'approved' }],
    });

    await expect(
      service.changeStatus('HM-01', { status: 'quyet-toan' }, LANH_DAO),
    ).rejects.toThrow(/chưa ghi nhận đã chi/);
  });

  it('hạng mục đã quyết toán thì KHOÁ mọi đường ghi', async () => {
    const { service } = makeService({ approvalStatus: 'quyet-toan' });

    await expect(
      service.addEntry('HM-01', { date: '01/12/2026', amountDong: 1000, content: 'x' }, KE_TOAN),
    ).rejects.toThrow(/Đã quyết toán/);
  });

  it('mức quyền của từng bước chuyển tra được, không viết cứng ở controller', async () => {
    const { service } = makeService();

    expect(service.requiredLevelFor('nhap', 'cho-duyet')).toBe('edit');
    expect(service.requiredLevelFor('cho-duyet', 'da-duyet')).toBe('approve');
    expect(service.requiredLevelFor('da-duyet', 'huy')).toBe('admin');
    expect(service.requiredLevelFor('quyet-toan', 'nhap')).toBeNull();
  });
});

describe('Chốt chặn: chỉ hạng mục ĐÃ PHÊ DUYỆT mới phát sinh tiền', () => {
  it('không ghi nhận giao dịch cho hạng mục còn ở Nháp', async () => {
    const { service } = makeService({ approvalStatus: 'nhap' });

    await expect(
      service.addEntry(
        'HM-01',
        { date: '01/04/2026', amountDong: 100_000_000, content: 'Tạm ứng' },
        KE_TOAN,
      ),
    ).rejects.toThrow(/Phải được phê duyệt trước khi/);
  });

  it('không gửi đề nghị giải ngân cho hạng mục chờ duyệt', async () => {
    const { service } = makeService({ approvalStatus: 'cho-duyet' });

    await expect(
      service.createRequest('HM-01', { amountDong: 100_000_000, content: 'Đợt 1' }, KE_TOAN),
    ).rejects.toThrow(/Phải được phê duyệt trước khi/);
  });
});

describe('Điều chỉnh dự toán', () => {
  it('cộng vào kế hoạch vốn và giữ nguyên căn cứ trong lịch sử', async () => {
    const { service, item } = makeService();

    await service.addAdjustment(
      'HM-01',
      {
        decisionNo: '45/QĐ-UBND',
        decidedAt: '15/06/2026',
        deltaDong: 500_000_000,
        reason: 'Bổ sung vốn theo nghị quyết HĐND xã',
      },
      LANH_DAO,
    );

    // Kế hoạch vốn = dự toán đầu năm + tổng điều chỉnh, KHÔNG sửa đè
    expect(item.initialPlannedDong).toBe(3 * TY);
    expect(item.plannedDong).toBe(3_500_000_000);
    expect(item.adjustments).toHaveLength(1);
    expect(item.adjustments[0]).toMatchObject({
      decisionNo: '45/QĐ-UBND',
      deltaDong: 500_000_000,
    });
  });

  it('giảm dự toán được, nhưng KHÔNG xuống dưới số đã giải ngân', async () => {
    const { service } = makeService();

    // Đã chi 1 tỷ; giảm dự toán còn 800 triệu là số liệu tự mâu thuẫn
    await expect(
      service.addAdjustment(
        'HM-01',
        {
          decisionNo: '46/QĐ-UBND',
          decidedAt: '20/06/2026',
          deltaDong: -2_200_000_000,
          reason: 'Cắt giảm vốn',
        },
        LANH_DAO,
      ),
    ).rejects.toThrow(/thấp hơn số đã giải ngân/);
  });

  it('mức điều chỉnh 0 bị từ chối — không có gì để ghi vào lịch sử', async () => {
    const { service } = makeService();

    await expect(
      service.addAdjustment(
        'HM-01',
        { decisionNo: 'X', decidedAt: '01/01/2026', deltaDong: 0, reason: 'y' },
        LANH_DAO,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('Giao dịch chi trả và hoàn trả', () => {
  it('chi trả cộng vào luỹ kế', async () => {
    const { service, item } = makeService();

    await service.addEntry(
      'HM-01',
      { date: '01/07/2026', amountDong: 500_000_000, content: 'Đợt 2', voucherNo: 'UNC 12' },
      KE_TOAN,
    );

    expect(item.actualDong).toBe(1_500_000_000);
  });

  it('hoàn trả TRỪ khỏi luỹ kế — không phải xoá chứng từ cũ', async () => {
    const { service, item } = makeService();

    await service.addEntry(
      'HM-01',
      {
        date: '05/07/2026',
        type: 'hoan-tra',
        amountDong: 200_000_000,
        content: 'Nhà thầu trả lại phần chưa thi công',
      },
      KE_TOAN,
    );

    expect(item.actualDong).toBe(800_000_000);
    // Chứng từ chi cũ vẫn còn nguyên, chỉ thêm một dòng hoàn trả
    expect(item.entries).toHaveLength(2);
    expect(item.entries[0]).toMatchObject({ type: 'chi', amountDong: 1 * TY });
  });

  it('không hoàn trả nhiều hơn số đã giải ngân', async () => {
    const { service } = makeService();

    await expect(
      service.addEntry(
        'HM-01',
        { date: '05/07/2026', type: 'hoan-tra', amountDong: 2 * TY, content: 'x' },
        KE_TOAN,
      ),
    ).rejects.toThrow(/lớn hơn số đã giải ngân/);
  });

  it('chi vượt phần vốn còn lại bị chặn, và nhắc phải điều chỉnh dự toán trước', async () => {
    const { service } = makeService();

    await expect(
      service.addEntry(
        'HM-01',
        { date: '01/08/2026', amountDong: 2_500_000_000, content: 'Đợt lớn' },
        KE_TOAN,
      ),
    ).rejects.toThrow(/điều chỉnh dự toán/);
  });

  it('số tiền phải là số nguyên đồng — số thập phân bị từ chối', async () => {
    // Chốt chặn cuối cùng ở service; DTO cũng đã chặn bằng maxDecimalPlaces: 0
    const { service } = makeService();

    await expect(
      service.addEntry(
        'HM-01',
        { date: '01/08/2026', amountDong: 1_000_000.5, content: 'x' },
        KE_TOAN,
      ),
    ).rejects.toThrow(/số nguyên không âm, đơn vị đồng/);
  });
});

describe('Kế hoạch quý', () => {
  it('tổng kế hoạch 4 quý không được vượt kế hoạch vốn', async () => {
    const { service } = makeService();

    await expect(
      service.update(
        'HM-01',
        {
          quarterPlans: [
            { quarter: 1, amountDong: 2 * TY },
            { quarter: 2, amountDong: 2 * TY },
          ],
        },
        KE_TOAN,
      ),
    ).rejects.toThrow(/vượt kế hoạch vốn/);
  });

  it('không khai trùng một quý hai lần', async () => {
    const { service } = makeService();

    await expect(
      service.update(
        'HM-01',
        {
          quarterPlans: [
            { quarter: 1, amountDong: 500_000_000 },
            { quarter: 1, amountDong: 500_000_000 },
          ],
        },
        KE_TOAN,
      ),
    ).rejects.toThrow(/khai hai lần/);
  });

  it('ngày bắt đầu không được sau ngày kết thúc', async () => {
    const { service } = makeService();

    await expect(
      service.update('HM-01', { startDate: '01/12/2026', endDate: '01/03/2026' }, KE_TOAN),
    ).rejects.toThrow(/không được sau ngày kết thúc/);
  });
});

describe('Hồ sơ đính kèm', () => {
  it('không gỡ được hồ sơ đang là căn cứ của một lần điều chỉnh dự toán', async () => {
    const { service } = makeService({
      documents: [{ fileId: 'f1', refNo: '45/QĐ-UBND' }],
      adjustments: [
        {
          decisionNo: '45/QĐ-UBND',
          decidedAt: '15/06/2026',
          deltaDong: 500_000_000,
          reason: 'Bổ sung vốn',
          fileIds: ['f1'],
        },
      ],
    });

    await expect(service.removeDocument('HM-01', 'f1', KE_TOAN)).rejects.toThrow(
      /căn cứ của một lần điều chỉnh/,
    );
  });
});
