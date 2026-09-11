import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CreateIssuingAgencyDto, UpdateIssuingAgencyDto } from './dto/settings.dto';
import {
  AGENCY_LEVELS,
  AGENCY_LEVEL_LABELS,
  IssuingAgency,
  type IssuingAgencyDocument,
} from './schemas/issuing-agency.schema';

/** Thứ tự cấp hành chính khi xếp danh sách — trên xuống dưới */
const LEVEL_ORDER: Record<string, number> = Object.fromEntries(
  AGENCY_LEVELS.map((level, index) => [level, index]),
);

/** Bản ghi trả ra API — không lộ `_id` thô của Mongo dưới tên `_id` */
function toView(doc: {
  _id: unknown;
  name: string;
  shortName?: string;
  level?: string;
  order?: number;
  active?: boolean;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    shortName: doc.shortName ?? '',
    level: doc.level ?? 'khac',
    levelLabel: AGENCY_LEVEL_LABELS[doc.level ?? 'khac'] ?? '',
    order: doc.order ?? 0,
    active: doc.active !== false,
  };
}

/**
 * Danh mục cơ quan ban hành văn bản (trang Cấu hình → Cơ quan ban hành).
 *
 * Xem `schemas/issuing-agency.schema.ts` để biết vì sao cần danh mục này thay
 * vì để cán bộ nhập tay tên cơ quan.
 */
@Injectable()
export class IssuingAgenciesService {
  constructor(
    @InjectModel(IssuingAgency.name)
    private readonly model: Model<IssuingAgencyDocument>,
  ) {}

  /**
   * Toàn bộ danh mục, kể cả cơ quan đã ẩn — trang Cấu hình cần thấy cả để bật lại.
   * Xếp theo cấp hành chính rồi tới thứ tự tự đặt, cuối cùng theo tên.
   */
  async list() {
    const items = await this.model.find().lean().exec();
    const sorted = items
      .map(toView)
      .sort(
        (a, b) =>
          (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99) ||
          a.order - b.order ||
          a.name.localeCompare(b.name, 'vi'),
      );
    return { items: sorted, total: sorted.length };
  }

  /** Tên các cơ quan ĐANG dùng — nguồn cho ô chọn ở form Tiếp nhận văn bản */
  async activeNames(): Promise<string[]> {
    const items = await this.model.find({ active: { $ne: false } }).lean().exec();
    return items
      .map(toView)
      .sort(
        (a, b) =>
          (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99) ||
          a.order - b.order ||
          a.name.localeCompare(b.name, 'vi'),
      )
      .map((a) => a.name);
  }

  async create(dto: CreateIssuingAgencyDto) {
    const name = dto.name.trim();
    // Trùng tên là nguồn gốc của chính vấn đề danh mục này sinh ra để giải quyết
    const existing = await this.model.findOne({ name }).lean().exec();
    if (existing) {
      throw new ConflictException(`Cơ quan "${name}" đã có trong danh mục`);
    }

    const created = await this.model.create({
      name,
      shortName: dto.shortName?.trim() ?? '',
      level: dto.level ?? 'khac',
      order: dto.order ?? 0,
    });
    return toView(created.toObject());
  }

  async update(id: string, dto: UpdateIssuingAgencyDto) {
    this.assertId(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.model.findOne({ name, _id: { $ne: id } }).lean().exec();
      if (clash) throw new ConflictException(`Cơ quan "${name}" đã có trong danh mục`);
    }

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.shortName !== undefined) patch.shortName = dto.shortName.trim();
    if (dto.level !== undefined) patch.level = dto.level;
    if (dto.order !== undefined) patch.order = dto.order;
    if (dto.active !== undefined) patch.active = dto.active;

    const updated = await this.model
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy cơ quan ban hành cần sửa');
    return toView(updated);
  }

  /**
   * "Xoá" một cơ quan = ẩn khỏi ô chọn (`active = false`), KHÔNG xoá bản ghi.
   *
   * Văn bản đã vào sổ lưu TÊN cơ quan tại thời điểm ban hành. Xoá cứng bản ghi
   * danh mục không làm mất tên đó, nhưng làm mất khả năng bật lại và mất lịch
   * sử danh mục — cơ quan sáp nhập rồi tách lại là chuyện có thật trong hành
   * chính. Bảo toàn dữ liệu: `rules/critical/bao-toan-du-lieu.md`.
   */
  async deactivate(id: string) {
    this.assertId(id);
    const updated = await this.model
      .findByIdAndUpdate(id, { $set: { active: false } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy cơ quan ban hành cần ẩn');
    return toView(updated);
  }

  private assertId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Mã cơ quan ban hành không hợp lệ');
    }
  }
}
