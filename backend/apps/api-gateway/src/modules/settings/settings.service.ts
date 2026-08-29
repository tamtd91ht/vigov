import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ROLES, SlaRule, type SlaRuleDocument } from '@vigov/shared';
import { CreateOrgNodeDto, SlaRuleDto, UpdateOrgNodeDto } from './dto/settings.dto';
import { OrgNode, type OrgNodeDocument } from './schemas/org-node.schema';

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

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SlaRule.name) private readonly slaModel: Model<SlaRuleDocument>,
    @InjectModel(OrgNode.name) private readonly orgModel: Model<OrgNodeDocument>,
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
