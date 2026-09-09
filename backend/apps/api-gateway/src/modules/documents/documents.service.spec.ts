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
    deletedBy: undefined as string | undefined,
    deleteReason: undefined as string | undefined,
    timeline: [] as { title: string; meta: string; state: string }[],
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

    await service.remove('128', { username: 'binh.nv', displayName: 'Nguyễn Văn Bình' } as never, 'Vào sổ trùng số đến');

    expect(doc.isDeleted).toBe(true);
    expect(doc.deletedAt).toBeInstanceOf(Date);
    // `deletedBy` lưu TÊN ĐĂNG NHẬP, không phải họ tên hiển thị
    expect(doc.deletedBy).toBe('binh.nv');
    expect(doc.deleteReason).toBe('Vào sổ trùng số đến');
    expect(doc.save).toHaveBeenCalled();
  });

  it('ghi lý do xoá vào nhật ký để còn đọc lại được sau khi khôi phục', async () => {
    const { service, doc } = softDeleteHarness();

    await service.remove('128', undefined, 'Gửi sai địa chỉ');

    expect(doc.timeline.at(-1)?.title).toBe('Xoá văn bản khỏi sổ: Gửi sai địa chỉ');
  });

  it('không nêu lý do thì nhật ký chỉ ghi hành động', async () => {
    const { service, doc } = softDeleteHarness();

    await service.remove('128');

    expect(doc.timeline.at(-1)?.title).toBe('Xoá văn bản khỏi sổ');
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
    doc.deletedBy = 'Nguyễn Văn Bình';
    doc.deleteReason = 'Vào sổ trùng';

    await service.restore('128', { username: 'hoa.tt', displayName: 'Trần Thị Hoa' } as never);

    expect(doc.isDeleted).toBe(false);
    expect(doc.deletedAt).toBeNull();
    expect(doc.deletedBy).toBeUndefined();
    expect(doc.deleteReason).toBeUndefined();
    expect(doc.timeline.at(-1)?.title).toBe('Khôi phục văn bản vào sổ');
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
