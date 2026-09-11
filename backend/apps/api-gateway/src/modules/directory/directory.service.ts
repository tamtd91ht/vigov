import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NOT_DELETED,
  OrgNode,
  StaffUser,
  findRole,
  legacyRef,
  nowMs,
  type DepartmentRef,
  type OrgNodeDocument,
  type RefOut,
  type StaffRef,
  type StaffUserDocument,
} from '@vigov/shared';

/**
 * Tra tên hiển thị của cán bộ và bộ phận từ id — nâng cấp v2.
 *
 * ## Vì sao phải có một service riêng
 *
 * v2 lưu **id** ở mọi tham chiếu (`rules` — "lưu id, hiển thị tên"). Nhưng phản
 * hồi API vẫn phải mang tên, nếu không giao diện phải tự gọi thêm một lượt cho
 * từng dòng của mỗi danh sách — đó là N+1 trên toàn bộ hệ thống.
 *
 * Nên mọi phân hệ tra tên qua ĐÚNG service này, và nó đọc **theo lô**: một danh
 * sách 20 nhiệm vụ với 20 người thực hiện khác nhau tốn một truy vấn, không
 * phải hai mươi.
 *
 * ## Bộ đệm ngắn
 *
 * Danh bạ cán bộ và cây tổ chức đổi rất ít (vài lần một tháng) nhưng được đọc ở
 * gần như mọi lời gọi API. Bộ đệm 30 giây giữ cho việc resolve gần như miễn phí,
 * mà vẫn ngắn hơn mọi khoảng thời gian con người chờ được sau khi sửa danh bạ.
 *
 * KHÔNG dùng bộ đệm dài hoặc vĩnh viễn: đổi tên cán bộ rồi mà giao diện vẫn
 * hiện tên cũ là loại lỗi không ai báo, chỉ âm thầm làm mất niềm tin vào số liệu.
 */

/** Thời gian sống của bộ đệm danh bạ — hằng số kỹ thuật, không phụ thuộc khách hàng */
const CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  at: number;
  data: Map<string, T>;
}

@Injectable()
export class DirectoryService {
  private staffCache?: CacheEntry<StaffRef>;
  private deptCache?: CacheEntry<DepartmentRef>;

  constructor(
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(OrgNode.name) private readonly orgModel: Model<OrgNodeDocument>,
  ) {}

  /**
   * Bảng tra cán bộ theo id.
   *
   * Trả về **toàn bộ** danh bạ chứ không chỉ những id được hỏi: quy mô cấp xã là
   * vài chục tài khoản, nên một truy vấn không điều kiện rẻ hơn nhiều lần truy
   * vấn theo `$in` và cho phép dùng chung một bộ đệm cho mọi lời gọi.
   *
   * Bao gồm cả tài khoản **đã xoá mềm**: hồ sơ cũ vẫn trỏ tới cán bộ đã nghỉ, và
   * hiển thị tên họ là đúng — bỏ đi thì hồ sơ mất người thực hiện.
   */
  async staffById(): Promise<Map<string, StaffRef>> {
    if (this.staffCache && nowMs() - this.staffCache.at < CACHE_TTL_MS) {
      return this.staffCache.data;
    }

    const rows = await this.staffModel
      .find({}, 'displayName initials color departmentId roleKey')
      .lean()
      .exec();

    const data = new Map<string, StaffRef>(
      rows.map((row) => [
        String(row._id),
        {
          id: String(row._id),
          displayName: row.displayName,
          // Chưa có trường chức danh riêng trên tài khoản — dùng nhãn vai trò RBAC
          // (câu hỏi mở #12: khách chưa chốt danh mục chức danh chuẩn của xã)
          title: findRole(row.roleKey)?.label ?? row.roleKey,
          departmentId: row.departmentId,
        },
      ]),
    );

    this.staffCache = { at: nowMs(), data };
    return data;
  }

  /** Bảng tra bộ phận theo id — nguồn chuẩn là cây tổ chức `org_nodes` */
  async departmentById(): Promise<Map<string, DepartmentRef>> {
    if (this.deptCache && nowMs() - this.deptCache.at < CACHE_TTL_MS) {
      return this.deptCache.data;
    }

    const rows = await this.orgModel.find({}, 'name parentId').lean().exec();
    const data = new Map<string, DepartmentRef>(
      rows.map((row) => [
        String(row._id),
        { id: String(row._id), displayName: row.name, parentId: row.parentId },
      ]),
    );

    this.deptCache = { at: nowMs(), data };
    return data;
  }

  /**
   * Danh sách bộ phận **nhận việc**, cho ô chọn "Bộ phận chủ trì".
   *
   * Lọc theo cờ `isDepartment` khai tường minh, không suy ra "nút lá" như v1 —
   * cách cũ làm một bộ phận biến mất khỏi mọi ô chọn ngay khi có nút con.
   */
  async departmentOptions(): Promise<DepartmentRef[]> {
    const rows = await this.orgModel
      .find({ isDepartment: true }, 'name parentId order')
      .sort({ order: 1, name: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({
      id: String(row._id),
      displayName: row.name,
      parentId: row.parentId,
    }));
  }

  /** Danh bạ cán bộ đang hoạt động, cho ô chọn người thực hiện */
  async staffOptions(): Promise<StaffRef[]> {
    const rows = await this.staffModel
      .find({ status: 'active', ...NOT_DELETED }, 'displayName departmentId roleKey')
      .sort({ displayName: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({
      id: String(row._id),
      displayName: row.displayName,
      title: findRole(row.roleKey)?.label ?? row.roleKey,
      departmentId: row.departmentId,
    }));
  }

  /**
   * Bộ tra cứu dùng cho một lượt trả dữ liệu: nạp sẵn hai bảng rồi trả về các
   * hàm quy đổi id → tham chiếu.
   *
   * Service nghiệp vụ gọi **một lần** cho cả danh sách, rồi dùng các hàm đồng bộ
   * cho từng dòng — nhờ đó không có chỗ nào lỡ `await` trong vòng lặp.
   */
  async lookup(): Promise<DirectoryLookup> {
    const [staff, departments] = await Promise.all([this.staffById(), this.departmentById()]);
    return new DirectoryLookup(staff, departments);
  }

  /** Xoá bộ đệm — gọi sau khi sửa danh bạ hoặc cây tổ chức */
  invalidate(): void {
    this.staffCache = undefined;
    this.deptCache = undefined;
  }
}

/**
 * Bộ tra cứu đồng bộ cho một lượt trả dữ liệu.
 *
 * Id không tra được **không** bị bỏ trống: nó trả về tham chiếu "tên cũ" nếu bản
 * ghi còn giữ tên di trú, hoặc một tham chiếu rỗng có cờ `legacy`. Để trống là
 * cán bộ đọc hồ sơ và tưởng hệ thống mất dữ liệu; nói rõ "đây là tên cũ trong
 * hồ sơ" thì họ hiểu đúng chuyện gì đã xảy ra.
 */
export class DirectoryLookup {
  constructor(
    private readonly staff: Map<string, StaffRef>,
    private readonly departments: Map<string, DepartmentRef>,
  ) {}

  /** Một cán bộ; `legacyName` là tên còn lại trên hồ sơ cũ nếu id tra không ra */
  staffRef(id?: string, legacyName?: string): RefOut | null {
    if (!id) return legacyName ? legacyRef(legacyName) : null;
    return this.staff.get(id) ?? legacyRef(legacyName ?? 'Không xác định');
  }

  /** Một bộ phận */
  departmentRef(id?: string, legacyName?: string): RefOut | null {
    if (!id) return legacyName ? legacyRef(legacyName) : null;
    return this.departments.get(id) ?? legacyRef(legacyName ?? 'Không xác định');
  }

  /** Danh sách cán bộ (cán bộ phối hợp) */
  staffRefs(ids?: string[]): RefOut[] {
    return (ids ?? []).map((id) => this.staffRef(id)).filter((ref): ref is RefOut => ref !== null);
  }
}
