import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Article,
  type ArticleDocument,
  BudgetItem,
  type BudgetItemDocument,
  CitizenUser,
  type CitizenUserDocument,
  IncomingDocument,
  type IncomingDocumentDocument,
  findRole,
  StaffUser,
  type StaffUserDocument,
} from '@vigov/shared';
import { OrgNode, type OrgNodeDocument } from '../settings/schemas/org-node.schema';
import {
  RadioBulletin,
  type RadioBulletinDocument,
  Video,
  type VideoDocument,
} from '../content/content.schema';

/** Một cán bộ trong danh bạ phân công — KHÔNG chứa username/passwordHash */
export interface StaffOption {
  name: string;
  title: string;
  department: string;
  initials: string;
  color: string;
}

/**
 * Danh mục dùng chung cho các dropdown / bộ lọc của Web Quản trị.
 *
 * Nguyên tắc: danh mục lấy từ DỮ LIỆU THẬT đang có trong database (giá trị
 * phân biệt của chính các collection nghiệp vụ), không khai báo hằng số cứng —
 * nhờ đó thêm bản ghi mới là danh mục tự có thêm lựa chọn.
 */
/** Loại văn bản hành chính thông dụng — bộ khởi tạo khi database còn rỗng */
const DEFAULT_DOCUMENT_TYPES = [
  'Công văn',
  'Quyết định',
  'Thông báo',
  'Kế hoạch',
  'Giấy mời',
  'Tờ trình',
  'Báo cáo',
];

@Injectable()
export class CatalogsService {
  constructor(
    @InjectModel(OrgNode.name) private readonly orgModel: Model<OrgNodeDocument>,
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
    @InjectModel(RadioBulletin.name) private readonly radioModel: Model<RadioBulletinDocument>,
    @InjectModel(BudgetItem.name) private readonly budgetModel: Model<BudgetItemDocument>,
    @InjectModel(IncomingDocument.name)
    private readonly documentModel: Model<IncomingDocumentDocument>,
  ) {}

  /**
   * Bộ phận chuyên môn.
   * Ưu tiên cây tổ chức: bộ phận là các nút LÁ (nút có con là cấp lãnh đạo,
   * không phải bộ phận). Cây tổ chức chưa dựng thì lùi về giá trị `department`
   * phân biệt trong tài khoản cán bộ.
   */
  async departments(): Promise<{ items: string[]; source: string }> {
    const nodes = await this.orgModel.find().sort({ order: 1, name: 1 }).lean().exec();
    if (nodes.length > 0) {
      const parentIds = new Set(nodes.map((node) => node.parentId).filter(Boolean));
      const leaves = nodes.filter((node) => !parentIds.has(String(node._id)));
      const items = this.uniqueStrings(leaves.map((node) => node.name));
      if (items.length > 0) return { items, source: 'org_nodes' };
    }

    const fromStaff = await this.staffModel.distinct('department').exec();
    return { items: this.uniqueStrings(fromStaff), source: 'staff_users' };
  }

  /** Danh bạ cán bộ cho dropdown phân công (chỉ tài khoản đang hoạt động) */
  async staff(): Promise<{ items: StaffOption[] }> {
    const rows = await this.staffModel
      .find({ status: 'active' }, 'displayName initials color department roleKey')
      .sort({ department: 1, displayName: 1 })
      .lean()
      .exec();

    const items = rows.map((row) => ({
      name: row.displayName,
      // Chưa có trường chức danh riêng trên tài khoản — dùng nhãn vai trò RBAC
      // (câu hỏi mở #12: khách chưa chốt danh mục chức danh chuẩn của xã).
      title: findRole(row.roleKey)?.label ?? row.roleKey,
      department: row.department,
      initials: row.initials,
      color: row.color,
    }));
    return { items };
  }

  /** Thôn / tổ dân phố — lấy từ hồ sơ công dân Mini App */
  async areas(): Promise<{ items: string[] }> {
    const rows = await this.citizenModel.distinct('area').exec();
    return { items: this.uniqueStrings(rows) };
  }

  /** Chuyên mục bài viết CMS */
  async articleCategories(): Promise<{ items: string[] }> {
    const rows = await this.articleModel.distinct('category').exec();
    return { items: this.uniqueStrings(rows) };
  }

  /**
   * Loại văn bản đến.
   *
   * Khác các danh mục còn lại ở một điểm: form "Tiếp nhận văn bản" cần danh sách
   * này để tạo bản ghi ĐẦU TIÊN, mà lúc đó collection còn rỗng nên `distinct`
   * trả mảng rỗng và dropdown sẽ trắng. Vì vậy hợp nhất với bộ mặc định — thêm
   * văn bản loại mới thì loại đó tự xuất hiện ở lần gọi sau.
   */
  async documentTypes(): Promise<{ items: string[] }> {
    const rows = await this.documentModel.distinct('docType').exec();
    return { items: this.uniqueStrings([...DEFAULT_DOCUMENT_TYPES, ...rows]) };
  }

  /** Chủ đề video tuyên truyền */
  async videoTopics(): Promise<{ items: string[] }> {
    const rows = await this.videoModel.distinct('topic').exec();
    return { items: this.uniqueStrings(rows) };
  }

  /** Chuyên mục bản tin truyền thanh */
  async radioCategories(): Promise<{ items: string[] }> {
    const rows = await this.radioModel.distinct('category').exec();
    return { items: this.uniqueStrings(rows) };
  }

  /** Năm ngân sách có dữ liệu — năm mới nhất đứng đầu */
  async budgetYears(): Promise<{ items: number[] }> {
    const rows = await this.budgetModel.distinct('year').exec();
    const items = (rows as unknown[])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a);
    return { items };
  }

  /** Bỏ giá trị rỗng/trùng rồi sắp xếp theo bảng chữ cái tiếng Việt */
  private uniqueStrings(values: unknown[]): string[] {
    const cleaned = values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
    return [...new Set(cleaned)].sort((a, b) => a.localeCompare(b, 'vi'));
  }
}
