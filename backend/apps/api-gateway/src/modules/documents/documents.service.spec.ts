import { NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { IncomingDocumentDocument } from '@vigov/shared';
import { fakeDoc, queryChain } from '../../../../../test/support/mongoose-mock';
import type { FilesService } from '../files/files.service';
import type { OcrService } from '../integrations/ocr/ocr.service';
import { DocumentsService } from './documents.service';

/* ───────────────────────────── Tiện ích dựng mock ───────────────────────── */

/**
 * FilesService giả — các bộ test dưới đây không đụng tới tệp đính kèm, nhưng
 * DocumentsService nhận nó qua constructor nên phải truyền vào. `findById` ném
 * lỗi để test nào lỡ chạm vào tệp cũng hỏng ngay chứ không im lặng.
 */
const filesMock = () =>
  ({
    findById: jest.fn(() => {
      throw new Error('Test này không được dùng tới FilesService');
    }),
    findPrivateById: jest.fn(() => {
      throw new Error('Test này không được dùng tới FilesService');
    }),
  }) as unknown as FilesService;

const ocrMock = () => ({}) as unknown as OcrService;

/**
 * Bộ giá đỡ cho xoá mềm: `findOne` ghi lại bộ lọc mà service truyền vào để test
 * bắt được lỗi quên điều kiện `isDeleted`, và trả `null` khi bộ lọc không khớp
 * trạng thái xoá hiện tại của tài liệu (giống Mongo thật).
 */
function softDeleteHarness(deleted = false) {
  const doc = fakeDoc({
    arrivalNo: '128',
    refNo: '128/UBND-VP',
    sender: 'UBND huyện',
    summary: 'Về việc rà soát quỹ đất công ích',
    department: 'Văn phòng',
    status: 'moi',
    kind: 'incoming',
    isDeleted: deleted,
    deletedAt: deleted ? new Date('2026-09-01T00:00:00Z') : null,
    deletedById: undefined as string | undefined,
    deleteReason: undefined as string | undefined,
    timeline: [] as { action: string; detail: string; state: string; at: number }[],
    attachmentFileIds: [] as string[],
  });

  const filters: Record<string, unknown>[] = [];
  const findOne = jest.fn((filter: Record<string, unknown>) => {
    filters.push(filter);
    // NOT_DELETED là `{ isDeleted: { $ne: true } }`, IS_DELETED là `{ isDeleted: true }`
    const wantsAlive = JSON.stringify(filter).includes('$ne');
    const includeDeleted = !('isDeleted' in filter);
    const matched = includeDeleted || (wantsAlive ? !doc.isDeleted : doc.isDeleted);
    return queryChain(matched ? doc : null);
  });

  const service = new DocumentsService(
    { findOne } as unknown as Model<IncomingDocumentDocument>,
    ocrMock(),
    filesMock(),
  );

  return { service, doc, filters };
}

/* ─────────────────── Xoá mềm / khôi phục văn bản ─────────────────── */

describe('DocumentsService.remove', () => {
  it('CHỈ đặt cờ isDeleted, không xoá tài liệu khỏi CSDL', async () => {
    const { service, doc } = softDeleteHarness();

    await service.remove(
      '128',
      { sub: '66f10000000000000000cb01', username: 'binh.nv', displayName: 'Nguyễn Văn Bình' } as never,
      'Vào sổ trùng số đến',
    );

    expect(doc.isDeleted).toBe(true);
    // Khuôn v2: mốc thời gian là SỐ, người xoá là ID cán bộ
    expect(typeof doc.deletedAt).toBe('number');
    expect(doc.deletedById).toBe('66f10000000000000000cb01');
    expect(doc.deleteReason).toBe('Vào sổ trùng số đến');
    expect(doc.save).toHaveBeenCalled();
  });

  it('ghi lý do xoá vào nhật ký để còn đọc lại được sau khi khôi phục', async () => {
    const { service, doc } = softDeleteHarness();

    await service.remove('128', undefined, 'Gửi sai địa chỉ');

    expect(doc.timeline.at(-1)?.action).toBe('document.delete');
    expect(doc.timeline.at(-1)?.detail).toBe('Gửi sai địa chỉ');
  });

  it('không nêu lý do thì nhật ký chỉ ghi hành động', async () => {
    const { service, doc } = softDeleteHarness();

    await service.remove('128');

    expect(doc.timeline.at(-1)?.action).toBe('document.delete');
    expect(doc.timeline.at(-1)?.detail).toBe('');
    expect(doc.deleteReason).toBeUndefined();
  });

  it('xoá văn bản đã xoá rồi thì 404, không ghi gì thêm', async () => {
    const { service, doc } = softDeleteHarness(true);

    await expect(service.remove('128')).rejects.toBeInstanceOf(NotFoundException);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('DocumentsService.restore', () => {
  it('bỏ cờ xoá và dọn luôn người xoá / lý do xoá', async () => {
    const { service, doc } = softDeleteHarness(true);
    doc.deletedById = '66f10000000000000000cb01';
    doc.deleteReason = 'Vào sổ trùng';

    await service.restore('128', { username: 'hoa.tt', displayName: 'Trần Thị Hoa' } as never);

    expect(doc.isDeleted).toBe(false);
    expect(doc.deletedAt).toBeNull();
    expect(doc.deletedById).toBeUndefined();
    expect(doc.deleteReason).toBeUndefined();
    expect(doc.timeline.at(-1)?.action).toBe('document.restore');
  });

  it('khôi phục văn bản chưa bị xoá thì 404', async () => {
    const { service, doc } = softDeleteHarness();

    await expect(service.restore('128')).rejects.toBeInstanceOf(NotFoundException);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('DocumentsService — đường ghi từ chối văn bản đã xoá mềm', () => {
  it('gỡ tệp đính kèm của văn bản đã xoá thì 404 (bản ghi đã xoá là bất biến)', async () => {
    const { service } = softDeleteHarness(true);

    await expect(service.removeAttachment('128', 'f1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne VẪN mở được bản đã xoá để cán bộ kiểm tra trước khi khôi phục', async () => {
    const { service } = softDeleteHarness(true);

    const result = await service.findOne('128');

    expect(result.arrivalNo).toBe('128');
  });
});

describe('DocumentsService.list — bộ lọc xoá mềm', () => {
  /** Model giả chỉ để soi bộ lọc mà `list()` dựng, không quan tâm dữ liệu trả về */
  function listFilterHarness() {
    const filters: Record<string, unknown>[] = [];
    const find = jest.fn((filter: Record<string, unknown>) => {
      filters.push(filter);
      return queryChain([]);
    });
    const countDocuments = jest.fn(() => queryChain(0));
    const service = new DocumentsService(
      { find, countDocuments } as unknown as Model<IncomingDocumentDocument>,
      ocrMock(),
      filesMock(),
    );
    return { service, filters };
  }

  it('mặc định ẩn văn bản đã xoá mềm', async () => {
    const { service, filters } = listFilterHarness();

    await service.list({});

    expect(filters[0]).toMatchObject({ isDeleted: { $ne: true } });
  });

  it('deleted=true thì CHỈ trả văn bản đã xoá mềm', async () => {
    const { service, filters } = listFilterHarness();

    await service.list({ deleted: true });

    expect(filters[0]).toMatchObject({ isDeleted: true });
  });
});

/* ───────────────── Quét thử OCR ở form tiếp nhận (previewOcr) ───────────── */

/**
 * Đường này để cán bộ kéo bản scan vào form tiếp nhận rồi bấm quét, máy điền hộ
 * các trường trước khi vào sổ. Ba điều phải giữ:
 *
 *   1. KHÔNG ghi gì vào cơ sở dữ liệu — chưa có văn bản nào để ghi, và cán bộ
 *      còn phải sửa lại trước khi lưu.
 *   2. Chỉ nhận tệp NGHIỆP VỤ (isPrivate = true). Bản scan văn bản để ở chế độ
 *      công khai là ai có mã tệp cũng đọc được nội dung công văn.
 *   3. Không trả cờ `confirmed` — chưa có gì để xác nhận, và trả ra sẽ khiến
 *      giao diện tưởng cán bộ đã rà soát.
 */
describe('DocumentsService.previewOcr', () => {
  const scanFile = { _id: 'f1', originalName: 'cong-van.pdf', isPrivate: true };

  function harness(overrides: { findPrivateById?: jest.Mock; extract?: jest.Mock } = {}) {
    const findPrivateById = overrides.findPrivateById ?? jest.fn().mockResolvedValue(scanFile);
    const extract =
      overrides.extract ??
      jest.fn().mockResolvedValue({
        fields: [
          { key: 'refNo', label: 'Số ký hiệu', value: '1245/UBND-VP', confidence: 0.5 },
          { key: 'deadline', label: 'Hạn xử lý', value: '', confidence: 0 },
        ],
      });

    const findOne = jest.fn(() => {
      throw new Error('previewOcr KHÔNG được truy vấn collection văn bản');
    });

    const service = new DocumentsService(
      { findOne } as unknown as Model<IncomingDocumentDocument>,
      { extract } as unknown as OcrService,
      { findPrivateById } as unknown as FilesService,
    );

    return { service, findPrivateById, extract, findOne };
  }

  it('trả về các trường OCR đọc được từ bản scan', async () => {
    const { service } = harness();

    const result = await service.previewOcr('f1');

    expect(result.fileId).toBe('f1');
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0]).toEqual({
      key: 'refNo',
      label: 'Số ký hiệu',
      value: '1245/UBND-VP',
      confidence: 0.5,
    });
  });

  it('KHÔNG chạm tới collection văn bản — chưa có văn bản nào để ghi', async () => {
    const { service, findOne } = harness();

    await service.previewOcr('f1');

    expect(findOne).not.toHaveBeenCalled();
  });

  it('giữ nguyên trường OCR đọc rỗng, không bịa giá trị thay thế', async () => {
    const { service } = harness();

    const result = await service.previewOcr('f1');

    const deadline = result.fields.find((f) => f.key === 'deadline');
    expect(deadline?.value).toBe('');
    expect(deadline?.confidence).toBe(0);
  });

  it('KHÔNG trả cờ confirmed — chưa có gì để cán bộ xác nhận', async () => {
    const { service } = harness();

    const result = await service.previewOcr('f1');

    for (const field of result.fields) {
      expect(field).not.toHaveProperty('confirmed');
    }
  });

  it('bắt buộc tệp phải là tệp nghiệp vụ riêng tư', async () => {
    const findPrivateById = jest.fn().mockRejectedValue(new Error('tệp đang ở chế độ công khai'));
    const { service, extract } = harness({ findPrivateById });

    await expect(service.previewOcr('f-public')).rejects.toThrow('công khai');
    // Không được gọi OCR khi tệp đã bị từ chối
    expect(extract).not.toHaveBeenCalled();
  });

  it('quét đúng mã tệp được truyền vào', async () => {
    const { service, extract, findPrivateById } = harness();

    await service.previewOcr('f-abc');

    expect(findPrivateById).toHaveBeenCalledWith('f-abc', expect.any(String));
    expect(extract).toHaveBeenCalledWith('f-abc');
  });
});
