import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { FeedbackDocument, SlaRuleDocument } from '@vigov/shared';
import { queryChain } from '../../../../../test/support/mongoose-mock';
import type { OrgNodeDocument } from './schemas/org-node.schema';
import type { FeedbackCategoryDocument } from './schemas/feedback-category.schema';
import { SettingsService } from './settings.service';

/**
 * Kiểm thử danh mục lĩnh vực phản ánh.
 *
 * Trọng tâm là quy tắc nghiệp vụ dễ gây mất dữ liệu nhất: KHÔNG cho xoá lĩnh
 * vực khi còn phiếu phản ánh đang tham chiếu. Xoá được thì các phiếu cũ mang
 * `categoryKey` mồ côi — giao diện mất nhãn, bộ lọc theo lĩnh vực sai số, và
 * không có đường khôi phục vì bản ghi lĩnh vực đã biến mất.
 */

const CATEGORY = { key: 'rac-thai', label: 'Rác thải', color: 'var(--orange)', order: 1 };

interface Harness {
  service: SettingsService;
  categoryModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    insertMany: jest.Mock;
  };
  slaDeleteOne: jest.Mock;
  feedbackCount: jest.Mock;
}

function makeService(opts: {
  /** Số phiếu phản ánh đang tham chiếu lĩnh vực */
  feedbackCount?: number;
  /** Danh mục hiện có trong database */
  existing?: (typeof CATEGORY)[];
  /** Kết quả findOneAndDelete — null nghĩa là không tìm thấy */
  deleted?: unknown;
} = {}): Harness {
  const existing = opts.existing ?? [CATEGORY];

  const categoryModel = {
    find: jest.fn(() => queryChain(existing)),
    findOne: jest.fn(() => queryChain({ order: existing.length })),
    findOneAndUpdate: jest.fn(() => queryChain({ ...CATEGORY, label: 'Rác thải sinh hoạt' })),
    findOneAndDelete: jest.fn(() => queryChain(opts.deleted === undefined ? CATEGORY : opts.deleted)),
    exists: jest.fn(() => queryChain(null)),
    create: jest.fn(async (doc: Record<string, unknown>) => ({ toObject: () => doc })),
    insertMany: jest.fn(async () => []),
  };

  const slaDeleteOne = jest.fn(() => queryChain({ deletedCount: 1 }));
  const feedbackCount = jest.fn(() => queryChain(opts.feedbackCount ?? 0));

  const service = new SettingsService(
    { deleteOne: slaDeleteOne } as unknown as Model<SlaRuleDocument>,
    {} as unknown as Model<OrgNodeDocument>,
    categoryModel as unknown as Model<FeedbackCategoryDocument>,
    { countDocuments: feedbackCount } as unknown as Model<FeedbackDocument>,
  );

  return { service, categoryModel, slaDeleteOne, feedbackCount };
}

describe('SettingsService — danh mục lĩnh vực phản ánh', () => {
  it('nạp bộ mặc định khi database chưa có lĩnh vực nào', async () => {
    const h = makeService({ existing: [] });
    // Lần find đầu trả rỗng, lần sau trả bộ vừa nạp
    h.categoryModel.find
      .mockImplementationOnce(() => queryChain([]))
      .mockImplementationOnce(() => queryChain([CATEGORY]));

    const res = await h.service.getCategories();

    expect(h.categoryModel.insertMany).toHaveBeenCalledTimes(1);
    expect(res.total).toBe(1);
  });

  it('KHÔNG nạp lại bộ mặc định khi đã có dữ liệu', async () => {
    const h = makeService();
    await h.service.getCategories();
    expect(h.categoryModel.insertMany).not.toHaveBeenCalled();
  });

  it('chặn xoá lĩnh vực còn phiếu phản ánh tham chiếu', async () => {
    const h = makeService({ feedbackCount: 12 });

    await expect(h.service.removeCategory('rac-thai')).rejects.toBeInstanceOf(BadRequestException);
    // Quan trọng: phải chặn TRƯỚC khi xoá, không phải xoá rồi mới báo lỗi
    expect(h.categoryModel.findOneAndDelete).not.toHaveBeenCalled();
    expect(h.slaDeleteOne).not.toHaveBeenCalled();
  });

  it('nêu rõ số phiếu đang dùng trong thông báo lỗi', async () => {
    const h = makeService({ feedbackCount: 12 });
    await expect(h.service.removeCategory('rac-thai')).rejects.toThrow(/12 phiếu phản ánh/);
  });

  it('xoá được lĩnh vực không còn phiếu nào, kèm xoá quy tắc SLA gắn với nó', async () => {
    const h = makeService({ feedbackCount: 0 });

    const res = await h.service.removeCategory('rac-thai');

    expect(res).toEqual({ key: 'rac-thai', deleted: true });
    expect(h.slaDeleteOne).toHaveBeenCalledWith({ categoryKey: 'rac-thai' });
  });

  it('báo không tìm thấy khi xoá lĩnh vực không tồn tại', async () => {
    const h = makeService({ feedbackCount: 0, deleted: null });
    await expect(h.service.removeCategory('khong-co')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('chặn tạo lĩnh vực trùng mã', async () => {
    const h = makeService();
    h.categoryModel.exists.mockImplementationOnce(() => queryChain({ _id: 'x' }));

    await expect(
      h.service.createCategory({ key: 'rac-thai', label: 'Rác thải' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.categoryModel.create).not.toHaveBeenCalled();
  });

  it('báo không tìm thấy khi cập nhật lĩnh vực không tồn tại', async () => {
    const h = makeService();
    h.categoryModel.findOneAndUpdate.mockImplementationOnce(() => queryChain(null));

    await expect(
      h.service.updateCategory('khong-co', { label: 'Tên mới' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
