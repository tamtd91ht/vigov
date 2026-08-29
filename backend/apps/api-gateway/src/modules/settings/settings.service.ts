import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback, type FeedbackDocument, ROLES, SlaRule, type SlaRuleDocument } from '@vigov/shared';
import {
  CreateFeedbackCategoryDto,
  CreateOrgNodeDto,
  SlaRuleDto,
  UpdateFeedbackCategoryDto,
  UpdateOrgNodeDto,
} from './dto/settings.dto';
import { OrgNode, type OrgNodeDocument } from './schemas/org-node.schema';
import {
  FeedbackCategory,
  type FeedbackCategoryDocument,
} from './schemas/feedback-category.schema';

/**
 * Bộ SLA mặc định cho 8 lĩnh vực phản ánh.
 * Khớp admin-web/src/config/sla.config.ts — sửa một nơi phải sửa cả hai.
 */
const DEFAULT_SLA_RULES: SlaRuleDto[] = [
  { categoryKey: 'rac-thai', intakeDays: 4, resolveDays: 3, unit: 'ngày làm việc', warnBefore: 'Trước hạn 8 giờ' },
  { categoryKey: 'giao-thong', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  {
    categoryKey: 've-sinh-moi-truong',
    intakeDays: 4,
    resolveDays: 3,
    unit: 'ngày làm việc',
    warnBefore: 'Trước hạn 8 giờ',
  },
  {
    categoryKey: 'trat-tu-do-thi',
    intakeDays: 6,
    resolveDays: 5,
    unit: 'ngày làm việc',
    warnBefore: 'Trước hạn 12 giờ',
  },
  { categoryKey: 'an-ninh', intakeDays: 2, resolveDays: 2, unit: 'ngày làm việc', warnBefore: 'Trước hạn 4 giờ' },
  { categoryKey: 'xay-dung', intakeDays: 8, resolveDays: 7, unit: 'ngày làm việc', warnBefore: 'Trước hạn 24 giờ' },
  { categoryKey: 'can-bo', intakeDays: 4, resolveDays: 5, unit: 'ngày làm việc', warnBefore: 'Trước hạn 12 giờ' },
  { categoryKey: 'khac', intakeDays: 8, resolveDays: 7, unit: 'ngày làm việc', warnBefore: 'Trước hạn 24 giờ' },
];

/** Giá trị mặc định khi DTO không truyền */
const DEFAULT_SLA_UNIT = 'ngày làm việc';
const DEFAULT_ORG_COLOR = 'var(--blue)';

/** Nút tổ chức ở dạng cây lồng nhau trả ra FE */
interface OrgTreeNode {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  parentId?: string;
  order: number;
  children: OrgTreeNode[];
}

/**
 * Bộ lĩnh vực phản ánh mặc định — nạp khi database chưa có danh mục nào.
 * Khớp admin-web/src/config/sla.config.ts và DEFAULT_SLA_RULES ở trên.
 */
const DEFAULT_CATEGORIES = [
  { key: 'rac-thai', label: 'Rác thải', color: 'var(--orange)', order: 1 },
  { key: 'giao-thong', label: 'Giao thông', color: 'var(--blue)', order: 2 },
  { key: 've-sinh-moi-truong', label: 'Vệ sinh môi trường', color: 'var(--green)', order: 3 },
  { key: 'trat-tu-do-thi', label: 'Trật tự đô thị', color: 'var(--purple)', order: 4 },
  { key: 'an-ninh', label: 'An ninh', color: 'var(--red)', order: 5 },
  { key: 'xay-dung', label: 'Xây dựng', color: 'var(--teal)', order: 6 },
  { key: 'can-bo', label: 'Cán bộ', color: 'var(--pink)', order: 7 },
  { key: 'khac', label: 'Khác', color: 'var(--mut)', order: 8 },
];

/** Chỉ trả các trường giao diện cần; giấu _id và mốc thời gian của Mongo */
function toCategoryView(doc: { key: string; label: string; color: string; order: number }) {
  return { key: doc.key, label: doc.label, color: doc.color, order: doc.order };
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SlaRule.name) private readonly slaModel: Model<SlaRuleDocument>,
    @InjectModel(OrgNode.name) private readonly orgModel: Model<OrgNodeDocument>,
    @InjectModel(FeedbackCategory.name)
    private readonly categoryModel: Model<FeedbackCategoryDocument>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
  ) {}

  // ─── Cấu hình SLA ────────────────────────────────────────────────────────

  /** Toàn bộ bảng SLA; chưa cấu hình lần nào thì trả bộ mặc định 8 lĩnh vực */
  async getSla() {
    const docs = await this.slaModel.find().sort({ categoryKey: 1 }).exec();
    if (docs.length === 0) {
      return { rules: DEFAULT_SLA_RULES, isDefault: true };
    }
    return {
      rules: docs.map((doc) => ({
        categoryKey: doc.categoryKey,
        intakeDays: doc.intakeDays,
        resolveDays: doc.resolveDays,
        unit: doc.unit,
        warnBefore: doc.warnBefore,
      })),
      isDefault: false,
    };
  }

  /** Lưu cả bảng SLA — upsert theo categoryKey để không mất cấu hình cũ */
  async saveSla(rules: SlaRuleDto[]) {
    await Promise.all(
      rules.map((rule) =>
        this.slaModel
          .updateOne(
            { categoryKey: rule.categoryKey },
            {
              $set: {
                intakeDays: rule.intakeDays,
                resolveDays: rule.resolveDays,
                unit: rule.unit ?? DEFAULT_SLA_UNIT,
                warnBefore: rule.warnBefore ?? '',
              },
            },
            { upsert: true },
          )
          .exec(),
      ),
    );
    return this.getSla();
  }

  /** Khôi phục bộ SLA mặc định (xoá cấu hình đang có rồi ghi lại bản gốc) */
  async resetSla() {
    await this.slaModel.deleteMany({}).exec();
    return this.saveSla(DEFAULT_SLA_RULES);
  }

  // ─── Cây tổ chức ─────────────────────────────────────────────────────────

  /** Cây tổ chức lồng nhau dựng từ parentId */
  async getOrgTree() {
    const docs = await this.orgModel.find().sort({ order: 1, name: 1 }).exec();

    const byId = new Map<string, OrgTreeNode>();
    for (const doc of docs) {
      byId.set(String(doc._id), {
        id: String(doc._id),
        name: doc.name,
        subtitle: doc.subtitle,
        color: doc.color,
        parentId: doc.parentId,
        order: doc.order,
        children: [],
      });
    }

    const roots: OrgTreeNode[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      // Nút cha đã bị xoá → coi như nút gốc để không mất dữ liệu trên giao diện
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return { tree: roots, total: docs.length };
  }

  /** Thêm một đơn vị vào cây tổ chức */
  async createOrgNode(dto: CreateOrgNodeDto) {
    if (dto.parentId) await this.assertOrgNodeExists(dto.parentId);

    const doc = await this.orgModel.create({
      name: dto.name,
      subtitle: dto.subtitle ?? '',
      color: dto.color ?? DEFAULT_ORG_COLOR,
      parentId: dto.parentId || undefined,
      order: dto.order ?? 0,
    });
    return this.toOrgView(doc);
  }

  /** Cập nhật thông tin một đơn vị */
  async updateOrgNode(id: string, dto: UpdateOrgNodeDto) {
    this.assertObjectId(id);

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.subtitle !== undefined) patch.subtitle = dto.subtitle;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.order !== undefined) patch.order = dto.order;
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new BadRequestException('Đơn vị không thể là cấp trên của chính nó');
      if (dto.parentId) await this.assertOrgNodeExists(dto.parentId);
      patch.parentId = dto.parentId || undefined;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Không có thông tin nào cần cập nhật');
    }

    const doc = await this.orgModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy đơn vị trong cây tổ chức');
    return this.toOrgView(doc);
  }

  /** Xoá một đơn vị — chặn nếu còn đơn vị con để không tạo nhánh mồ côi */
  async removeOrgNode(id: string) {
    this.assertObjectId(id);

    const childCount = await this.orgModel.countDocuments({ parentId: id }).exec();
    if (childCount > 0) {
      throw new BadRequestException(
        `Không thể xoá đơn vị đang có ${childCount} đơn vị trực thuộc. Vui lòng xoá hoặc chuyển các đơn vị con trước.`,
      );
    }

    const doc = await this.orgModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy đơn vị trong cây tổ chức');
    return { id, deleted: true };
  }

  // ─── Lĩnh vực phản ánh ───────────────────────────────────────────────────

  /**
   * Danh mục lĩnh vực phản ánh.
   * Lần gọi đầu trên database trống sẽ tự nạp bộ mặc định — nếu trả rỗng thì
   * Mini App không có lĩnh vực nào để người dân chọn, không gửi được phản ánh.
   */
  async getCategories() {
    const existing = await this.categoryModel.find().sort({ order: 1, label: 1 }).lean().exec();
    if (existing.length > 0) return { items: existing.map(toCategoryView), total: existing.length };

    await this.categoryModel.insertMany(DEFAULT_CATEGORIES);
    const seeded = await this.categoryModel.find().sort({ order: 1, label: 1 }).lean().exec();
    return { items: seeded.map(toCategoryView), total: seeded.length };
  }

  async createCategory(dto: CreateFeedbackCategoryDto) {
    const existed = await this.categoryModel.exists({ key: dto.key }).exec();
    if (existed) throw new BadRequestException(`Mã lĩnh vực "${dto.key}" đã tồn tại`);

    const last = await this.categoryModel.findOne().sort({ order: -1 }).select('order').lean().exec();
    const doc = await this.categoryModel.create({
      key: dto.key,
      label: dto.label,
      color: dto.color ?? 'var(--mut)',
      order: dto.order ?? (last?.order ?? 0) + 1,
    });
    return toCategoryView(doc.toObject());
  }

  /** Cập nhật lĩnh vực theo `key`; bản thân `key` không đổi được (xem DTO) */
  async updateCategory(key: string, dto: UpdateFeedbackCategoryDto) {
    const doc = await this.categoryModel
      .findOneAndUpdate({ key }, { $set: dto }, { new: true })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy lĩnh vực phản ánh');
    return toCategoryView(doc);
  }

  /**
   * Xoá lĩnh vực.
   *
   * Chặn khi còn phiếu phản ánh đang tham chiếu: xoá đi thì các phiếu cũ mang
   * `categoryKey` mồ côi, giao diện mất nhãn và bộ lọc theo lĩnh vực sai số.
   * Quy tắc SLA gắn kèm thì xoá theo, vì nó vô nghĩa khi không còn lĩnh vực.
   */
  async removeCategory(key: string) {
    const used = await this.feedbackModel.countDocuments({ categoryKey: key }).exec();
    if (used > 0) {
      throw new BadRequestException(
        `Không thể xoá lĩnh vực đang có ${used} phiếu phản ánh. Hãy chuyển các phiếu sang lĩnh vực khác trước.`,
      );
    }

    const doc = await this.categoryModel.findOneAndDelete({ key }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy lĩnh vực phản ánh');

    await this.slaModel.deleteOne({ categoryKey: key }).exec();
    return { key, deleted: true };
  }

  // ─── Vai trò ─────────────────────────────────────────────────────────────

  /** Danh mục vai trò RBAC (chỉ đọc) — phục vụ dropdown phía FE */
  getRoles() {
    return { roles: ROLES, total: ROLES.length };
  }

  // ─── Tiện ích ────────────────────────────────────────────────────────────

  private toOrgView(doc: OrgNodeDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      subtitle: doc.subtitle,
      color: doc.color,
      parentId: doc.parentId,
      order: doc.order,
    };
  }

  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã đơn vị không hợp lệ');
    }
  }

  private async assertOrgNodeExists(id: string): Promise<void> {
    this.assertObjectId(id);
    const existed = await this.orgModel.exists({ _id: id }).exec();
    if (!existed) throw new NotFoundException('Không tìm thấy đơn vị cấp trên');
  }
}
