import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type FilterQuery } from 'mongoose';
import {
  IncomingDocument,
  type IncomingDocumentDocument,
  type JwtPayload,
} from '@vigov/shared';
import { FilesService } from '../files/files.service';
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
    private readonly files: FilesService,
  ) {}

  /**
   * Bản scan văn bản PHẢI là tệp riêng tư (TB-09).
   *
   * Văn bản đến và đơn thư công dân là tài liệu nội bộ, có thể mang độ mật.
   * `GET /files/:id` để công khai nên tệp không đánh dấu riêng tư là ai có mã
   * tệp cũng đọc được mà không cần đăng nhập.
   */
  private async assertScanPrivate(scanFileId?: string): Promise<void> {
    if (!scanFileId) return;
    await this.files.findPrivateById(scanFileId, 'Bản scan văn bản');
  }

  /**
   * Gắn tệp đính kèm (phụ lục, biên bản) vào một văn bản.
   *
   * Cùng khuôn với `TasksService.addAttachments`: đòi tệp riêng tư, bỏ qua mã
   * đã gắn rồi, và ghi một mốc vào dòng thời gian luân chuyển.
   */
  async addAttachments(arrivalNo: string, fileIds: string[], actor?: JwtPayload) {
    // `findOne` trả bản lean (chỉ đọc) — ở đây cần bản ghi được để save()
    const doc = await this.findWritable(arrivalNo);

    const names: string[] = [];
    const added: string[] = [];
    for (const fileId of fileIds) {
      const file = await this.files.findPrivateById(fileId, 'Tệp đính kèm văn bản');
      if (doc.attachmentFileIds.includes(fileId)) continue;
      doc.attachmentFileIds.push(fileId);
      added.push(fileId);
      names.push(file.originalName);
    }

    if (added.length > 0) {
      doc.markModified('attachmentFileIds');
      /*
       * `state` chỉ nhận 'ok' | 'cur' (enum của TimelineStep). Giá trị 'done'
       * dùng trước đây làm Mongoose ném ValidationError ngay ở `save()` dưới
       * đây; đó không phải HttpException nên cả lời gọi đổ thành 500 — tệp
       * không bao giờ được gắn, giao diện chỉ thấy "Internal server error".
       */
      doc.timeline.push({
        title: `Đính kèm ${added.length} tệp: ${names.join(', ')}`,
        meta: timelineMeta(actor),
        state: 'ok',
      });
      await doc.save();
    }
    return this.withAttachmentFiles(doc);
  }

  /** Gỡ một tệp đính kèm khỏi văn bản — tệp vẫn còn trong kho tệp */
  async removeAttachment(arrivalNo: string, fileId: string, actor?: JwtPayload) {
    const doc = await this.findWritable(arrivalNo);
    const index = doc.attachmentFileIds.indexOf(fileId);
    if (index < 0) {
      throw new NotFoundException(`Văn bản ${arrivalNo} không có tệp đính kèm ${fileId}`);
    }

    doc.attachmentFileIds.splice(index, 1);
    doc.markModified('attachmentFileIds');
    doc.timeline.push({
      title: 'Gỡ một tệp đính kèm',
      meta: timelineMeta(actor),
      state: 'ok',
    });
    await doc.save();
    return this.withAttachmentFiles(doc);
  }

  /**
   * Bổ sung `attachmentFiles` (tên, dung lượng, kiểu) vào phản hồi chi tiết.
   * Mã tệp không tra được thì BỎ QUA — văn bản vẫn phải mở xem được khi một
   * tệp cũ đã bị dọn khỏi kho.
   *
   * MỌI phản hồi chi tiết đều phải đi qua đây. Web Quản trị lấy nguyên bản ghi
   * trả về để thay thế bản đang mở trong ngăn chi tiết, nên một phản hồi thiếu
   * `attachmentFiles` làm cột tệp đính kèm trắng xoá cho tới lần tải lại trang.
   */
  private async withAttachmentFiles(doc: IncomingDocumentDocument): Promise<Record<string, unknown>> {
    return {
      ...this.withFreshDaysLeft(doc.toObject()),
      attachmentFiles: await this.attachmentFilesOf(doc.attachmentFileIds ?? []),
    };
  }

  /** Tên, dung lượng, kiểu của từng mã tệp; mã chết bị bỏ qua kèm một dòng log */
  private async attachmentFilesOf(fileIds: string[]) {
    const files: { fileId: string; name: string; size: number; contentType: string }[] = [];
    for (const fileId of fileIds) {
      try {
        const file = await this.files.findById(fileId);
        files.push({
          fileId: String(file._id),
          name: file.originalName,
          size: file.size,
          contentType: file.mimeType,
        });
      } catch {
        this.logger.warn(`Văn bản tham chiếu tệp ${fileId} không còn trong kho`);
      }
    }
    return files;
  }

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

  /** Bản ghi ghi được (không lean) — dùng cho các thao tác cần save() */
  private async findWritable(arrivalNo: string): Promise<IncomingDocumentDocument> {
    const doc = await this.docModel.findOne({ arrivalNo }).exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);
    return doc;
  }

  /**
   * Chi tiết một văn bản theo số đến, kèm siêu dữ liệu tệp đính kèm.
   *
   * Danh sách (`list`) KHÔNG kèm `attachmentFiles`: mỗi tệp là một lượt tra kho
   * tệp, gắn vào danh sách là N+1 truy vấn cho một thông tin không hiện ở bảng.
   */
  /* Kiểu trả về khai TƯỜNG MINH: kiểu suy ra từ bản lean của Mongoose cộng
     thêm trường mới vượt giới hạn TS7056 mà compiler chịu tuần tự hoá được. */
  async findOne(arrivalNo: string): Promise<Record<string, unknown>> {
    const doc = await this.docModel.findOne({ arrivalNo }).lean().exec();
    if (!doc) throw new NotFoundException(`Không tìm thấy văn bản có số đến ${arrivalNo}`);
    const fresh = this.withFreshDaysLeft(doc);
    return { ...fresh, attachmentFiles: await this.attachmentFilesOf(doc.attachmentFileIds ?? []) };
  }

  /** Tiếp nhận văn bản: tự cấp số đến và khởi tạo timeline vào sổ */
  async create(dto: CreateDocumentDto, actor?: JwtPayload) {
    await this.assertScanPrivate(dto.scanFileId);
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
    return this.withAttachmentFiles(created);
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
    if (dto.scanFileId !== undefined) {
      await this.assertScanPrivate(dto.scanFileId);
      doc.scanFileId = dto.scanFileId;
    }
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
    return this.withAttachmentFiles(doc);
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
