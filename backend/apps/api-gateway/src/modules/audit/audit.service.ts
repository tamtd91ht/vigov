import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { AuditLog, type AuditLogDocument } from '@vigov/shared';
import { ListAuditQueryDto } from './dto/audit.dto';

/** Phân trang mặc định của nhật ký thao tác */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

/** Một mục cần ghi vết */
export interface AuditEntry {
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>) {}

  /**
   * Ghi một vết thao tác. Lỗi ghi nhật ký KHÔNG được làm hỏng nghiệp vụ chính
   * nên chỉ log cảnh báo thay vì ném ngoại lệ.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create({
        actor: entry.actor,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        before: entry.before,
        after: entry.after,
        ip: entry.ip ?? '',
      });
    } catch (error) {
      this.logger.warn(`Không ghi được nhật ký thao tác: ${(error as Error).message}`);
    }
  }

  /** Tra cứu nhật ký thao tác có lọc + phân trang */
  async list(query: ListAuditQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const filter: FilterQuery<AuditLogDocument> = {};
    if (query.actor) filter.actor = query.actor;
    if (query.action) filter.action = query.action;
    if (query.resource) filter.resource = query.resource;

    // from/to lọc theo thời điểm tạo bản ghi (timestamps của schema)
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) range.$lte = new Date(query.to);
      filter.createdAt = range;
    }

    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }
}
