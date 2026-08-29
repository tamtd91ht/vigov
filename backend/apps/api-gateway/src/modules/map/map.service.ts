import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { MapLayer, type MapLayerDocument, MapPin, type MapPinDocument } from './map.schema';
import { CreateLayerDto, CreatePinDto, ListPinQueryDto, UpdateLayerDto, UpdatePinDto } from './dto/map.dto';

/** Lớp dữ liệu được coi là cơ sở KINH TẾ khi tính cơ cấu ngành và chỉ số tổng hợp.
 *  Trường học, y tế, di tích, hạ tầng công cộng, công trình đầu tư công là hạ tầng
 *  công — đưa vào pie cơ cấu kinh tế sẽ làm sai lệch số liệu. */
const ECONOMIC_LAYER_KEYS = ['dn', 'hkd', 'cho'];

/** Một nhóm ngành trong pie cơ cấu kinh tế + từ khoá nhận diện từ trường `industry` */
interface IndustrySector {
  label: string;
  color: string;
  keywords: string[];
}

/**
 * Bảng phân nhóm ngành — xét THEO THỨ TỰ, ghim rơi vào nhóm khớp đầu tiên.
 * Đây là quy ước tạm của Phase 1 (câu hỏi mở #10: khách chưa chốt danh mục
 * ngành nghề chuẩn — VSIC cấp mấy). Khi có mã ngành thật thì thay bảng này
 * bằng trường `industryCode` trên ghim.
 */
const INDUSTRY_SECTORS: IndustrySector[] = [
  {
    label: 'Chế biến nông sản',
    color: '#27AE60',
    keywords: ['chế biến', 'nông sản', 'thực phẩm', 'bún', 'bánh'],
  },
  {
    label: 'Vận tải – kho bãi',
    color: '#E67E22',
    keywords: ['vận tải', 'kho bãi', 'kho vận', 'logistics', 'bến bãi'],
  },
  {
    label: 'Thương mại – dịch vụ',
    color: '#3B82C4',
    keywords: [
      'thương mại',
      'bán buôn',
      'bán lẻ',
      'tạp hoá',
      'tạp hóa',
      'chợ',
      'ăn uống',
      'giải khát',
      'dịch vụ',
      'sửa chữa',
    ],
  },
  {
    label: 'Công nghiệp – xây dựng',
    color: '#E91E8C',
    keywords: ['may mặc', 'cơ khí', 'gia công', 'xây dựng', 'sản xuất', 'vật liệu'],
  },
];

/** Nhóm hứng phần còn lại */
const OTHER_SECTOR = { label: 'Lĩnh vực khác', color: '#8E44AD' };

/** Ghi chú cho chỉ số chưa có nguồn dữ liệu — KHÔNG bịa số */
const NO_SOURCE_NOTE =
  'Chưa có nguồn dữ liệu — chờ kết nối CSDL thuế / thống kê cấp huyện (câu hỏi mở #10).';

/** Một chỉ số tổng hợp trên panel phân tích kinh tế */
interface SummaryItem {
  /** null = chưa có nguồn dữ liệu; giao diện hiển thị dấu gạch thay vì số */
  value: number | null;
  label: string;
  note?: string;
}

@Injectable()
export class MapService {
  constructor(
    @InjectModel(MapLayer.name) private readonly layerModel: Model<MapLayerDocument>,
    @InjectModel(MapPin.name) private readonly pinModel: Model<MapPinDocument>,
  ) {}

  // ------------------------------------------------------------ Lớp dữ liệu

  /** Danh sách lớp kèm số ghim thực tế thuộc lớp đó */
  async listLayers() {
    const [layers, counts] = await Promise.all([
      this.layerModel.find().sort({ order: 1, key: 1 }).lean().exec(),
      this.pinModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$layerKey', count: { $sum: 1 } } },
      ]),
    ]);

    const countByKey = new Map(counts.map((row) => [row._id, row.count]));
    const items = layers.map((layer) => ({ ...layer, count: countByKey.get(layer.key) ?? 0 }));
    return { items, total: items.length };
  }

  /** Thêm lớp dữ liệu mới */
  async createLayer(dto: CreateLayerDto) {
    const existing = await this.layerModel.findOne({ key: dto.key }).lean().exec();
    if (existing) throw new ConflictException(`Lớp dữ liệu "${dto.key}" đã tồn tại`);

    const created = await this.layerModel.create({ ...dto });
    return { ...created.toObject(), count: 0 };
  }

  /** Cập nhật lớp dữ liệu (không cho đổi khoá `key` vì ghim tham chiếu theo khoá) */
  async updateLayer(id: string, dto: UpdateLayerDto) {
    const updated = await this.layerModel
      .findByIdAndUpdate(this.objectId(id), { $set: { ...dto } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy lớp dữ liệu');

    const count = await this.pinModel.countDocuments({ layerKey: updated.key }).exec();
    return { ...updated, count };
  }

  // ------------------------------------------------------------------ Ghim

  /** Danh sách ghim, lọc theo lớp và từ khoá */
  async listPins(query: ListPinQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.layerKey) filter.layerKey = query.layerKey;
    if (query.q) {
      const keyword = this.keywordRegex(query.q);
      filter.$or = [{ name: keyword }, { industry: keyword }, { address: keyword }];
    }

    const items = await this.pinModel.find(filter).sort({ layerKey: 1, name: 1 }).lean().exec();
    return { items, total: items.length };
  }

  /** Thêm ghim mới — lớp dữ liệu phải tồn tại */
  async createPin(dto: CreatePinDto) {
    await this.assertLayerExists(dto.layerKey);
    const created = await this.pinModel.create({ ...dto });
    return created.toObject();
  }

  /** Cập nhật ghim */
  async updatePin(id: string, dto: UpdatePinDto) {
    if (dto.layerKey) await this.assertLayerExists(dto.layerKey);

    const updated = await this.pinModel
      .findByIdAndUpdate(this.objectId(id), { $set: { ...dto } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy ghim trên bản đồ');
    return updated;
  }

  /** Xoá ghim — chỉ quản trị hệ thống */
  async removePin(id: string) {
    const removed = await this.pinModel.findByIdAndDelete(this.objectId(id)).lean().exec();
    if (!removed) throw new NotFoundException('Không tìm thấy ghim trên bản đồ');
    return { deleted: true, id };
  }

  // -------------------------------------------------------------- Tổng hợp

  /**
   * Số liệu cho panel phân tích kinh tế: lớp dữ liệu kèm số ghim, cơ cấu ngành
   * và 4 chỉ số tổng hợp. Mọi con số đều tính từ dữ liệu ghim thật trong
   * database; chỉ số chưa có nguồn dữ liệu trả `null` kèm ghi chú.
   */
  async overview() {
    const [{ items: layers }, pins] = await Promise.all([this.listLayers(), this.pinModel.find().lean().exec()]);

    const economicPins = pins.filter((pin) => ECONOMIC_LAYER_KEYS.includes(pin.layerKey));

    const industryStructure = this.buildIndustryStructure(economicPins);

    const workers = economicPins.reduce((sum, pin) => sum + (pin.workers ?? 0), 0);
    const summary: SummaryItem[] = [
      { value: economicPins.length, label: 'Cơ sở kinh tế' },
      { value: workers, label: 'Lao động' },
      { value: null, label: 'Doanh thu ước năm', note: NO_SOURCE_NOTE },
      { value: null, label: 'Nộp ngân sách', note: NO_SOURCE_NOTE },
    ];

    return {
      layers,
      industryStructure,
      summary,
      notes: {
        scope: `Cơ cấu ngành và chỉ số tổng hợp tính trên ${economicPins.length} cơ sở kinh tế thuộc các lớp ${ECONOMIC_LAYER_KEYS.join(', ')}.`,
        missingSources: NO_SOURCE_NOTE,
      },
    };
  }

  // ------------------------------------------------------------------ Tiện ích

  /** Đếm ghim theo nhóm ngành rồi quy ra phần trăm (tổng luôn bằng 100) */
  private buildIndustryStructure(pins: { industry?: string }[]) {
    if (pins.length === 0) return [];

    const countByLabel = new Map<string, number>();
    for (const pin of pins) {
      const label = this.classifyIndustry(pin.industry ?? '');
      countByLabel.set(label, (countByLabel.get(label) ?? 0) + 1);
    }

    const palette = [...INDUSTRY_SECTORS, OTHER_SECTOR];
    const rows = palette
      .filter((sector) => (countByLabel.get(sector.label) ?? 0) > 0)
      .map((sector) => ({
        label: sector.label,
        count: countByLabel.get(sector.label) ?? 0,
        percent: Math.round(((countByLabel.get(sector.label) ?? 0) / pins.length) * 100),
        color: sector.color,
      }));

    // Làm tròn từng dòng có thể lệch tổng — bù phần dư vào nhóm lớn nhất
    const drift = 100 - rows.reduce((sum, row) => sum + row.percent, 0);
    if (drift !== 0 && rows.length > 0) {
      const biggest = rows.reduce((max, row) => (row.count > max.count ? row : max), rows[0]);
      biggest.percent += drift;
    }
    return rows;
  }

  /** Xếp một ghim vào nhóm ngành theo từ khoá trong trường `industry` */
  private classifyIndustry(industry: string): string {
    const text = industry.toLowerCase();
    const sector = INDUSTRY_SECTORS.find((s) => s.keywords.some((keyword) => text.includes(keyword)));
    return sector?.label ?? OTHER_SECTOR.label;
  }

  /** Ghim luôn phải thuộc một lớp có thật để panel lớp dữ liệu không bỏ sót ghim */
  private async assertLayerExists(layerKey: string) {
    const layer = await this.layerModel.findOne({ key: layerKey }).lean().exec();
    if (!layer) throw new BadRequestException(`Lớp dữ liệu "${layerKey}" không tồn tại`);
  }

  /** Tìm gần đúng theo từ khoá, không phân biệt hoa thường */
  private keywordRegex(keyword: string): RegExp {
    return new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  /** Kiểm tra id hợp lệ trước khi truy vấn để trả lỗi tiếng Việt thay vì CastError */
  private objectId(id: string): string {
    if (!isValidObjectId(id)) throw new BadRequestException('Mã bản ghi không hợp lệ');
    return id;
  }
}
