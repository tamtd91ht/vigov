import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type FilterQuery } from 'mongoose';
import {
  IncomingDocument,
  type IncomingDocumentDocument,
  type JwtPayload,
} from '@vigov/shared';
import { OcrService } from '../integrations/ocr/ocr.service';
import type {
  ConfirmOcrFieldDto,
  CreateDocumentDto,
  QueryDocumentsDto,
  UpdateDocumentDto,
} from './dto/document.dto';

/** Phân trang mặc định danh sách văn bản */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

/** Tiền tố mã số đến cho đơn thư công dân; văn bản đến dùng số thứ tự trần */
export const PETITION_PREFIX = 'ĐT-';

/** Số đến đầu tiên khi sổ văn bản còn trống */
const FIRST_ARRIVAL_NO = 1;

/** Loại văn bản mặc định khi cán bộ chưa chọn */
const DEFAULT_DOC_TYPE_BY_KIND: Record<string, string> = {
  incoming: 'Công văn',
  petition: 'Đơn thư',
};

/** Bộ phận mặc định khi mới vào sổ, chưa phân công chủ trì */
const DEFAULT_DEPARTMENT = 'Văn phòng';

/** Nhãn timeline khi tiếp nhận văn bản */
const TIMELINE_RECEIVED_TITLE = 'Văn phòng tiếp nhận, vào sổ văn bản đến';

/** Nhãn trạng thái hiển thị trong timeline */
const STATUS_LABELS: Record<string, string> = {
  moi: 'Mới tiếp nhận',
  dangxl: 'Đang xử lý',
  choduyet: 'Chờ duyệt',
  xong: 'Đã hoàn thành',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectModel(IncomingDocument.name)
    private readonly docModel: Model<IncomingDocumentDocument>,
    private readonly ocr: OcrService,
  ) {}

  /** Danh sách văn bản đến / đơn thư có lọc + phân trang */
  async list(query: QueryDocumentsDto) {
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const filter: FilterQuery<IncomingDocumentDocument> = {};
    if (query.kind) filter.kind = query.kind;
    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.docType) filter.docType = query.docType;
    // Tìm toàn văn dựa trên text index (summary / refNo / sender) khai báo trong schema
    if (query.q?.trim()) filter.$text = { $search: query.q.trim() };

    const [items, total] = await Promise.all([
      this.docModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.docModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((item) => this.withFreshDaysLeft(item)),
      total,
      page,
      limit,
    };
  }

  /** Chi tiết một văn bản theo số đến */
  async findOne(arrivalNo: string) {
    const doc = await this.docModel.findOne({ arrivalNo }).lean().exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);
    return this.withFreshDaysLeft(doc);
  }

  /** Tiếp nhận văn bản: tự cấp số đến và khởi tạo timeline vào sổ */
  async create(dto: CreateDocumentDto, actor?: JwtPayload) {
    const kind = dto.kind ?? 'incoming';
    const arrivalNo = await this.nextArrivalNo(kind);
    const deadline = dto.deadline ?? '';
    const deadlineAt = parseVnDate(deadline);

    const created = await this.docModel.create({
      arrivalNo,
      refNo: dto.refNo,
      date: dto.date,
      sender: dto.sender,
      summary: dto.summary,
      deadline,
      deadlineAt,
      daysLeft: daysLeftFrom(deadlineAt),
      department: dto.department ?? DEFAULT_DEPARTMENT,
      status: 'moi',
      docType: dto.docType ?? DEFAULT_DOC_TYPE_BY_KIND[kind] ?? DEFAULT_DOC_TYPE_BY_KIND.incoming,
      kind,
      confidentiality: dto.confidentiality ?? 'Thường',
      urgency: dto.urgency ?? 'Thường',
      signer: dto.signer ?? '',
      pageCount: dto.pageCount ?? 1,
      scanFileId: dto.scanFileId,
      ocrFields: [],
      timeline: [
        {
          title: TIMELINE_RECEIVED_TITLE,
          meta: timelineMeta(actor),
          state: 'cur',
        },
      ],
    });

    this.logger.log(`Đã vào sổ văn bản số đến ${arrivalNo} (${kind})`);
    return this.withFreshDaysLeft(created.toObject());
  }

  /** Cập nhật văn bản; đổi bộ phận chủ trì hoặc trạng thái sẽ ghi thêm timeline */
  async update(arrivalNo: string, dto: UpdateDocumentDto, actor?: JwtPayload) {
    const doc = await this.docModel.findOne({ arrivalNo }).exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);

    const steps: string[] = [];
    if (dto.department && dto.department !== doc.department) {
      steps.push(`Chuyển xử lý: ${doc.department} → ${dto.department}`);
    }
    if (dto.status && dto.status !== doc.status) {
      const from = STATUS_LABELS[doc.status] ?? doc.status;
      const to = STATUS_LABELS[dto.status] ?? dto.status;
      steps.push(`Cập nhật trạng thái: ${from} → ${to}`);
    }

    if (dto.refNo !== undefined) doc.refNo = dto.refNo;
    if (dto.date !== undefined) doc.date = dto.date;
    if (dto.sender !== undefined) doc.sender = dto.sender;
    if (dto.summary !== undefined) doc.summary = dto.summary;
    if (dto.docType !== undefined) doc.docType = dto.docType;
    if (dto.department !== undefined) doc.department = dto.department;
    if (dto.status !== undefined) doc.status = dto.status;
    if (dto.confidentiality !== undefined) doc.confidentiality = dto.confidentiality;
    if (dto.urgency !== undefined) doc.urgency = dto.urgency;
    if (dto.signer !== undefined) doc.signer = dto.signer;
    if (dto.pageCount !== undefined) doc.pageCount = dto.pageCount;
    if (dto.scanFileId !== undefined) doc.scanFileId = dto.scanFileId;
    if (dto.linkedTaskCode !== undefined) doc.linkedTaskCode = dto.linkedTaskCode;
    if (dto.deadline !== undefined) {
      doc.deadline = dto.deadline;
      doc.deadlineAt = parseVnDate(dto.deadline);
    }
    doc.daysLeft = daysLeftFrom(doc.deadlineAt);

    if (steps.length) {
      // Mốc trước đó chuyển thành đã qua, mốc mới nhất là mốc hiện tại
      doc.timeline.forEach((step) => {
        step.state = 'ok';
      });
      const meta = timelineMeta(actor);
      steps.forEach((title, index) => {
        doc.timeline.push({ title, meta, state: index === steps.length - 1 ? 'cur' : 'ok' });
      });
    }

    await doc.save();
    return this.withFreshDaysLeft(doc.toObject());
  }

  /** Chạy OCR trên bản scan và lưu 7 trường trích xuất vào văn bản */
  async runOcr(arrivalNo: string) {
    const doc = await this.docModel.findOne({ arrivalNo }).exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);
    if (!doc.scanFileId) {
      throw new BadRequestException('Văn bản chưa đính kèm bản scan để chạy OCR');
    }

    const result = await this.ocr.extract(doc.scanFileId);
    // Giữ lại xác nhận cũ của cán bộ nếu chạy OCR lại trên cùng một trường
    const confirmedKeys = new Set(doc.ocrFields.filter((f) => f.confirmed).map((f) => f.key));
    doc.ocrFields = result.fields.map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
      confidence: field.confidence,
      confirmed: confirmedKeys.has(field.key),
    }));

    await doc.save();
    return { arrivalNo: doc.arrivalNo, ocrFields: doc.ocrFields };
  }

  /** Cán bộ xác nhận một trường OCR, có thể sửa lại giá trị máy đọc sai */
  async confirmOcrField(arrivalNo: string, key: string, dto: ConfirmOcrFieldDto) {
    const doc = await this.docModel.findOne({ arrivalNo }).exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);

    const field = doc.ocrFields.find((f) => f.key === key);
    if (!field) throw new NotFoundException(`Văn bản không có trường OCR "${key}"`);

    if (dto.value !== undefined) field.value = dto.value;
    field.confirmed = true;

    doc.markModified('ocrFields');
    await doc.save();
    return { arrivalNo: doc.arrivalNo, field };
  }

  /** Xác nhận toàn bộ trường OCR của văn bản */
  async confirmAllOcr(arrivalNo: string) {
    const doc = await this.docModel.findOne({ arrivalNo }).exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);
    if (!doc.ocrFields.length) {
      throw new BadRequestException('Văn bản chưa có kết quả OCR để xác nhận');
    }

    doc.ocrFields.forEach((field) => {
      field.confirmed = true;
    });
    doc.markModified('ocrFields');
    await doc.save();
    return { arrivalNo: doc.arrivalNo, ocrFields: doc.ocrFields };
  }

  /** Xoá văn bản khỏi sổ (chỉ quản trị) */
  async remove(arrivalNo: string) {
    const deleted = await this.docModel.findOneAndDelete({ arrivalNo }).lean().exec();
    if (!deleted) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);
    this.logger.warn(`Đã xoá văn bản số đến ${arrivalNo}`);
    return { deleted: true, arrivalNo };
  }

  /**
   * Cấp số đến kế tiếp: lấy số lớn nhất đang có của cùng phân loại rồi cộng 1.
   * Phase 1 chạy 1 tiến trình nên đủ an toàn; khi chạy nhiều instance cần
   * chuyển sang bộ đếm nguyên tử (findOneAndUpdate $inc trên collection counters).
   */
  private async nextArrivalNo(kind: string): Promise<string> {
    const rows = await this.docModel.find({ kind }).select('arrivalNo').lean().exec();
    const max = rows.reduce((acc, row) => {
      const num = parseInt(String(row.arrivalNo).replace(/\D/g, ''), 10);
      return Number.isNaN(num) ? acc : Math.max(acc, num);
    }, FIRST_ARRIVAL_NO - 1);

    const next = max + 1;
    return kind === 'petition' ? `${PETITION_PREFIX}${next}` : String(next);
  }

  /** Luôn tính lại số ngày còn lại từ deadlineAt, không tin giá trị đã lưu */
  private withFreshDaysLeft<T extends { deadlineAt?: Date | null }>(doc: T) {
    return { ...doc, daysLeft: daysLeftFrom(doc.deadlineAt ?? undefined) };
  }
}

/** Chuyển chuỗi dd/MM/yyyy thành Date (UTC 00:00); chuỗi rỗng / sai định dạng → undefined */
function parseVnDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Số ngày còn lại tới hạn xử lý; âm là đã quá hạn, 0 khi không có hạn */
function daysLeftFrom(deadlineAt?: Date): number {
  if (!deadlineAt) return 0;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(deadlineAt).getTime() - today) / MS_PER_DAY);
}

/** Dòng mô tả người thao tác + thời điểm cho timeline */
function timelineMeta(actor?: JwtPayload): string {
  const now = new Date();
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const day = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
  const who = actor?.displayName ?? 'Hệ thống';
  return `${time} • ${day} • ${who}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
