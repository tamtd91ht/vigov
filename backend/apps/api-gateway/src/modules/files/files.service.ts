import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import * as path from 'node:path';
import type { Readable } from 'node:stream';
import { Model, isValidObjectId } from 'mongoose';
import { StoredFile, type StoredFileDocument } from '@vigov/shared';
import { LocalStorageDriver } from './drivers/local.driver';
import { S3StorageDriver } from './drivers/s3.driver';
import { DEFAULT_LOCAL_DIR, type ByteRange, type StorageDriver } from './drivers/storage.driver';
import {
  assertContentMatchesExtension,
  assertExtensionAllowed,
  assertExtensionNotBlocked,
} from './file-type.guard';

/** Mục đích sử dụng tệp — khớp enum StoredFile.purpose trong misc.schema */
export const FILE_PURPOSES = ['scan', 'feedback', 'audio', 'video', 'cover', 'other'] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** Nhóm MIME ảnh dùng lại cho phản ánh và ảnh bìa bài viết */
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;

/**
 * Bảng MIME được phép theo mục đích. Mọi mục đích đều có danh sách trắng —
 * không còn mục đích nào nhận mọi loại tệp.
 */
const ALLOWED_MIME_BY_PURPOSE: Record<FilePurpose, readonly string[]> = {
  scan: ['application/pdf', ...IMAGE_MIME_TYPES],
  feedback: [...IMAGE_MIME_TYPES],
  cover: [...IMAGE_MIME_TYPES],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/x-m4a'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/3gpp'],
  /**
   * Tài liệu hành chính đính kèm (nhiệm vụ, văn bản). Trước đây để mảng rỗng
   * nghĩa là KHÔNG giới hạn — chỉ dựa vào danh sách đen BLOCKED_MIME_TYPES.
   * Nay chuyển sang DANH SÁCH TRẮNG theo nguyên tắc mặc định đóng: danh sách
   * đen luôn thiếu, mỗi định dạng thực thi mới xuất hiện là một lỗ hổng mà
   * không ai nhớ cập nhật.
   *
   * Đuôi tệp tương ứng khai ở ALLOWED_EXTENSIONS_BY_PURPOSE (file-type.guard.ts).
   * Sửa một bên phải sửa bên kia — hai tầng cùng chặn một loại tệp.
   */
  other: [
    // Tài liệu
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Office CÓ MACRO — khách yêu cầu mở 10/09/2026, xem file-type.guard.ts
    'application/vnd.ms-word.document.macroenabled.12',
    'application/vnd.ms-word.template.macroenabled.12',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.ms-excel.template.macroenabled.12',
    'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    'application/vnd.ms-powerpoint.presentation.macroenabled.12',
    'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
    'application/vnd.ms-powerpoint.template.macroenabled.12',
    // Bản mẫu không macro
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'application/vnd.openxmlformats-officedocument.presentationml.template',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/rtf',
    'text/rtf',
    'text/plain',
    'text/csv',
    // Ảnh
    ...IMAGE_MIME_TYPES,
    'image/bmp',
    'image/tiff',
    // Nén — khách đã chốt cho phép (cán bộ hay gửi nhiều văn bản một lượt).
    // Hệ thống KHÔNG quét được nội dung bên trong, nên tệp thực thi giấu trong
    // .zip vẫn vào kho được; rủi ro này đã được chấp nhận có ý thức.
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // Trình duyệt không nhận ra định dạng thì gửi octet-stream. Cho qua ở tầng
    // MIME vì đuôi tệp và magic bytes vẫn chặn — từ chối ở đây sẽ loại nhầm
    // nhiều tệp .docx/.zip hợp lệ trên một số trình duyệt.
    'application/octet-stream',
  ],
};

/** Phần mở rộng suy ra từ MIME khi tên tệp gốc không có đuôi hợp lệ */
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.weba',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/3gpp': '.3gp',
};

/**
 * MIME bị CHẶN với mọi mục đích, kể cả 'other'.
 * Đây là các định dạng trình duyệt sẽ thực thi mã khi mở trực tiếp — nếu để lọt,
 * kẻ xấu có thể tải lên một tệp HTML/SVG chứa script rồi phát tán link đọc tệp
 * ngay trên tên miền API (stored XSS).
 */
const BLOCKED_MIME_TYPES: readonly string[] = [
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'text/xml',
  'application/xml',
  'application/x-msdownload',
  'application/x-sh',
  'application/x-httpd-php',
];

/** Vai trò của tài khoản công dân — không phải cán bộ */
const CITIZEN_ROLE_KEY = 'citizen';

/** Thông tin người gọi cần cho việc kiểm tra quyền truy cập tệp */
export interface FileRequester {
  username: string;
  roleKey: string;
}

/** Đuôi tệp mặc định khi không nhận diện được */
const DEFAULT_EXTENSION = '.bin';
/** Đuôi tệp chỉ chấp nhận chữ và số, tối đa 10 ký tự (đồng bộ SAFE_STORAGE_KEY_PATTERN) */
const SAFE_EXTENSION_PATTERN = /^\.[A-Za-z0-9]{1,10}$/;

/** Hiệu lực mặc định và tối đa của link ký sẵn (giây) */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
export const MAX_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

/** Thuật toán và độ dài chữ ký HMAC */
const SIGNATURE_ALGORITHM = 'sha256';
const SIGNATURE_ENCODING = 'hex';

/** Dung lượng tối đa mặc định khi chưa cấu hình (20MB) */
const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;
/** Tiền tố API mặc định — dùng để dựng URL trả cho FE */
const DEFAULT_API_PREFIX = 'api/v1';

/** Kết quả trả về sau khi tải tệp lên */
export interface UploadedFileResult {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  purpose: FilePurpose;
  isPrivate: boolean;
}

/**
 * Dịch vụ lưu trữ tệp dùng chung (WBS #24 — task P3-24).
 *
 * Các module khác (Documents, Feedback, Content) chỉ gọi upload()/getContent()
 * và lưu lại id tệp; không đụng tới đĩa hay S3.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectModel(StoredFile.name) private readonly fileModel: Model<StoredFileDocument>,
    private readonly config: ConfigService,
    private readonly localDriver: LocalStorageDriver,
    private readonly s3Driver: S3StorageDriver,
  ) {}

  /** Driver đang dùng theo cấu hình `storage.driver` */
  private get driver(): StorageDriver {
    const name = (this.config.get<string>('storage.driver') ?? 'local').trim().toLowerCase();
    if (name === 's3') return this.s3Driver;
    if (name === 'local') return this.localDriver;

    this.logger.warn(`Driver lưu trữ "${name}" không hợp lệ — tạm dùng local (${DEFAULT_LOCAL_DIR})`);
    return this.localDriver;
  }

  /** Dung lượng tối đa cho phép mỗi tệp (byte) */
  private get maxFileSize(): number {
    return this.config.get<number>('storage.maxFileSize') ?? DEFAULT_MAX_FILE_SIZE;
  }

  /**
   * Tải tệp lên: kiểm dung lượng, rồi kiểm loại tệp qua BA TẦNG (MIME · đuôi
   * tệp · magic bytes), sinh khoá duy nhất, ghi xuống driver và lưu StoredFile.
   */
  async upload(
    file: Express.Multer.File | undefined,
    purpose: string,
    uploadedBy: string,
    isPrivate: boolean,
  ): Promise<UploadedFileResult> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Vui lòng chọn tệp cần tải lên');
    }

    const filePurpose = this.normalizePurpose(purpose);
    const size = file.size ?? file.buffer.length;
    if (size > this.maxFileSize) {
      throw new PayloadTooLargeException(
        `Tệp vượt quá dung lượng cho phép (${formatSize(this.maxFileSize)})`,
      );
    }

    const mimeType = (file.mimetype ?? '').toLowerCase();
    const originalName = decodeMultipartFilename(file.originalname) || 'tệp-không-tên';

    /* BA TẦNG kiểm tra loại tệp, phải cùng đồng ý mới nhận. MIME và đuôi tệp
       đều do client khai nên đổi được; magic bytes đọc nội dung thật là tầng
       duy nhất không nói dối được. Chi tiết vì sao: file-type.guard.ts */
    this.assertMimeAllowed(filePurpose, mimeType);
    assertExtensionNotBlocked(originalName);
    assertExtensionAllowed(filePurpose, originalName);
    assertContentMatchesExtension(file.buffer, originalName);

    const storageKey = this.buildStorageKey(filePurpose, originalName, mimeType);
    await this.driver.save(file.buffer, storageKey, mimeType);

    const created = await this.fileModel.create({
      originalName,
      mimeType: mimeType || 'application/octet-stream',
      size,
      storageKey,
      purpose: filePurpose,
      uploadedBy,
      isPrivate,
    });

    const id = String(created._id);
    this.logger.log(`Đã lưu tệp ${id} (${filePurpose}, ${formatSize(size)}) bởi ${uploadedBy || 'ẩn danh'}`);

    return {
      id,
      url: this.publicUrl(id),
      originalName,
      mimeType: created.mimeType,
      size,
      purpose: filePurpose,
      isPrivate,
    };
  }

  /** Lấy bản ghi tệp theo id */
  async findById(id: string): Promise<StoredFileDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Mã tệp không hợp lệ');
    }
    const found = await this.fileModel.findById(id).exec();
    if (!found) {
      throw new NotFoundException('Không tìm thấy tệp');
    }
    return found;
  }

  /**
   * Tra tệp và ĐÒI tệp đó phải là tệp riêng tư.
   *
   * VÌ SAO CẦN: `GET /files/:id` để `@Public()`, nên tệp `isPrivate = false`
   * chỉ được che bằng độ khó đoán của ObjectId — mà ObjectId chứa dấu thời gian
   * và bộ đếm nên đoán được một phần (phát hiện **TB-09** trong SECURITY.md).
   * Bản scan văn bản, ảnh phản ánh, tệp minh chứng nhiệm vụ đều là tài liệu
   * nghiệp vụ, không được đọc mà không qua kiểm tra chữ ký.
   *
   * Trước đây đây chỉ là QUY ƯỚC ghi trong tài liệu, nên chỉ cần một chỗ trong
   * giao diện quên đặt `isPrivate` là tệp lọt ra ngoài mà không ai biết. Nay
   * mọi đường gắn tệp vào bản ghi nghiệp vụ đều đi qua hàm này.
   *
   * @param label Tên loại tệp trong thông báo lỗi, ví dụ "Bản scan văn bản"
   */
  async findPrivateById(id: string, label: string): Promise<StoredFileDocument> {
    const file = await this.findById(id);
    if (!file.isPrivate) {
      throw new BadRequestException(
        `${label} "${file.originalName}" đang ở chế độ công khai. ` +
          'Tài liệu nghiệp vụ phải được tải lên với isPrivate = true.',
      );
    }
    return file;
  }

  /** Đọc nội dung tệp kèm siêu dữ liệu — controller dùng để trả về cho client */
  async getContent(id: string): Promise<{ file: StoredFileDocument; buffer: Buffer }> {
    const file = await this.findById(id);
    const buffer = await this.driver.read(file.storageKey);
    return { file, buffer };
  }

  /**
   * Đọc tệp phục vụ route tải xuống công khai.
   * Với tệp riêng tư, chữ ký được kiểm tra TRƯỚC khi chạm vào ổ lưu trữ —
   * yêu cầu không có chữ ký hợp lệ không được phép làm máy chủ đọc đĩa/S3.
   */
  async openForDownload(
    id: string,
    exp: string | number | undefined,
    sig: string | undefined,
  ): Promise<{ file: StoredFileDocument; buffer: Buffer }> {
    const file = await this.findById(id);
    if (file.isPrivate) {
      this.verifySignature(String(file._id), exp, sig);
    }
    const buffer = await this.driver.read(file.storageKey);
    return { file, buffer };
  }

  /**
   * Mở tệp để phát theo luồng — dùng cho video và mọi tệp lớn.
   *
   * Trả kích thước THẬT trên ổ lưu trữ (không lấy `file.size` trong Mongo) vì
   * mọi con số trong header Content-Range phải khớp đúng tệp đang phục vụ.
   *
   * Chữ ký của tệp riêng tư được kiểm ở đây, TRƯỚC khi chạm ổ lưu trữ — giống
   * openForDownload, để không mở luồng cho yêu cầu không hợp lệ.
   */
  async openForStream(
    id: string,
    exp: string | number | undefined,
    sig: string | undefined,
  ): Promise<{ file: StoredFileDocument; size: number }> {
    const file = await this.findById(id);
    if (file.isPrivate) {
      this.verifySignature(String(file._id), exp, sig);
    }
    const size = await this.driver.size(file.storageKey);
    return { file, size };
  }

  /** Luồng đọc nội dung tệp; có `range` thì chỉ đọc đúng khoảng byte đó */
  readStream(file: StoredFileDocument, range?: ByteRange): Readable {
    return this.driver.createReadStream(file.storageKey, range);
  }

  /** Xoá cả bản ghi lẫn tệp vật lý */
  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const file = await this.findById(id);
    await this.driver.delete(file.storageKey);
    await this.fileModel.deleteOne({ _id: file._id }).exec();
    this.logger.log(`Đã xoá tệp ${id} (${file.storageKey})`);
    return { deleted: true, id };
  }

  /** URL đọc tệp công khai — dạng `/<apiPrefix>/files/<id>` */
  publicUrl(id: string): string {
    const prefix = (this.config.get<string>('apiPrefix') ?? DEFAULT_API_PREFIX)
      .split('/')
      .filter(Boolean)
      .join('/');
    return `/${prefix}/files/${id}`;
  }

  /**
   * Cấp link ký sẵn cho tệp riêng tư.
   * Chữ ký HMAC-SHA256 trên chuỗi `<id>.<exp>` bằng khoá `auth.jwtSecret` —
   * không cần lưu thêm bảng nào, hết hạn là link tự vô hiệu.
   */
  async signedUrl(
    id: string,
    ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
    requester?: FileRequester,
  ): Promise<{ url: string; expiresAt: number; ttlSeconds: number }> {
    const file = await this.findById(id);
    this.assertCanSign(file, requester);
    const ttl = clampTtl(ttlSeconds);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = this.sign(String(file._id), exp);
    return {
      url: `${this.publicUrl(String(file._id))}?exp=${exp}&sig=${sig}`,
      expiresAt: exp,
      ttlSeconds: ttl,
    };
  }

  /**
   * Cấp link ký sẵn cho nơi gọi ĐÃ TỰ kiểm tra quyền trên bản ghi nghiệp vụ.
   *
   * Khác `signedUrl()` ở hai điểm, và cả hai đều có lý do:
   *
   *   · Không gọi `assertCanSign` — hàm đó phân quyền theo NGƯỜI TẢI LÊN, nên
   *     công dân ký được ảnh mình gửi mà KHÔNG ký được ảnh nghiệm thu do cán bộ
   *     chụp, dù cả hai đều thuộc đúng phiếu của họ. Quyền đúng ở đây là quyền
   *     trên PHIẾU, mà chỉ FeedbackService biết (`findOne({ code, citizenPhone })`).
   *     Nhờ vậy không tệp nào phải để công khai để công dân xem được kết quả.
   *
   *   · Không tra bản ghi tệp — `listMine` trả tới 50 phiếu × 3 ảnh, tra từng
   *     mã là 150 lượt truy vấn cho một việc chỉ cần một phép HMAC. Mã tệp không
   *     tồn tại chỉ dẫn tới link trả 404 khi mở, còn `isPrivate` vẫn được kiểm
   *     ở `openForStream` lúc đọc tệp thật.
   *
   * CHỈ dùng khi nơi gọi đã xác định người dùng có quyền trên bản ghi chứa mã
   * tệp này. Endpoint nhận mã tệp thẳng từ client thì phải dùng `signedUrl()`.
   */
  mintSignedUrl(id: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): string {
    const ttl = clampTtl(ttlSeconds);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return `${this.publicUrl(id)}?exp=${exp}&sig=${this.sign(id, exp)}`;
  }

  /** Kiểm tra chữ ký của link ký sẵn; sai hoặc hết hạn thì ném ForbiddenException */
  verifySignature(id: string, exp: string | number | undefined, sig: string | undefined): void {
    const expNumber = typeof exp === 'number' ? exp : parseInt(String(exp ?? ''), 10);
    if (!sig || !Number.isFinite(expNumber)) {
      throw new ForbiddenException('Tệp riêng tư — cần link truy cập có chữ ký');
    }
    if (expNumber < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('Link truy cập tệp đã hết hạn');
    }

    const expected = Buffer.from(this.sign(id, expNumber), SIGNATURE_ENCODING);
    const actual = Buffer.from(sig, SIGNATURE_ENCODING);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException('Chữ ký truy cập tệp không hợp lệ');
    }
  }

  /**
   * Ai được cấp link đọc tệp RIÊNG TƯ.
   *
   * Trước đây mọi tài khoản đã đăng nhập — kể cả công dân — đều xin được link ký
   * sẵn cho bất kỳ mã tệp nào, nên chỉ cần dò mã ObjectId là đọc được bản scan
   * văn bản nội bộ. Nay: công dân chỉ ký được tệp do CHÍNH mình tải lên;
   * cán bộ (mọi vai trò trong bảng RBAC) vẫn ký được để phục vụ tác nghiệp.
   */
  private assertCanSign(file: StoredFileDocument, requester?: FileRequester): void {
    if (!file.isPrivate) return;
    if (!requester) {
      throw new ForbiddenException('Cần đăng nhập để lấy link đọc tệp riêng tư');
    }
    if (requester.roleKey !== CITIZEN_ROLE_KEY) return;
    if (file.uploadedBy && file.uploadedBy === requester.username) return;

    throw new ForbiddenException('Tài khoản không có quyền truy cập tệp này');
  }

  /** Sinh chữ ký HMAC cho cặp (id, exp) */
  private sign(id: string, exp: number): string {
    const secret = this.config.get<string>('auth.jwtSecret') ?? '';
    return createHmac(SIGNATURE_ALGORITHM, secret).update(`${id}.${exp}`).digest(SIGNATURE_ENCODING);
  }

  /** Chuẩn hoá mục đích, giá trị lạ quy về 'other' */
  private normalizePurpose(purpose: string): FilePurpose {
    const value = (purpose ?? '').trim().toLowerCase();
    return (FILE_PURPOSES as readonly string[]).includes(value) ? (value as FilePurpose) : 'other';
  }

  /** Kiểm tra MIME có nằm trong danh sách cho phép của mục đích không */
  private assertMimeAllowed(purpose: FilePurpose, mimeType: string): void {
    // Chặn trước các định dạng thực thi được trong trình duyệt, áp dụng cho MỌI mục đích
    if (BLOCKED_MIME_TYPES.includes(mimeType)) {
      throw new UnsupportedMediaTypeException(
        `Định dạng tệp "${mimeType}" không được phép tải lên vì có thể thực thi mã trong trình duyệt.`,
      );
    }

    const allowed = ALLOWED_MIME_BY_PURPOSE[purpose];
    if (allowed.length === 0) return;
    if (!allowed.includes(mimeType)) {
      throw new UnsupportedMediaTypeException(
        `Định dạng tệp "${mimeType || 'không xác định'}" không được chấp nhận cho mục đích "${purpose}". ` +
          `Chỉ nhận: ${allowed.join(', ')}.`,
      );
    }
  }

  /** Sinh khoá duy nhất `<purpose>/<yyyy>/<mm>/<uuid><ext>` */
  private buildStorageKey(purpose: FilePurpose, originalName: string, mimeType: string): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${purpose}/${year}/${month}/${randomUUID()}${pickExtension(originalName, mimeType)}`;
  }
}

/**
 * Giải mã tên tệp lấy từ phần multipart về UTF-8.
 *
 * Busboy (thư viện Multer dùng bên dưới) đọc `filename` của multipart theo
 * Latin-1, nên "Phụ lục biên bản.docx" về tới đây thành "PhÃ¡Â»Â¥ lÃ¡Â»Â¥c...":
 * mỗi byte UTF-8 bị hiểu thành một ký tự riêng. Tên đó vào Mongo là hỏng vĩnh
 * viễn — danh sách tệp đính kèm hiện chữ rác, và header Content-Disposition lúc
 * tải về bị mã hoá hai lần nên tệp lưu ra cũng sai tên.
 *
 * Cách sửa: đọc lại chuỗi thành byte Latin-1 rồi giải mã UTF-8. Hai lớp bảo vệ
 * để hàm này an toàn cả khi Busboy đổi mặc định sang UTF-8 ở bản sau:
 *   · có ký tự ngoài Latin-1 ⇒ tên đã đúng, giữ nguyên;
 *   · giải mã ra ký tự thay thế U+FFFD ⇒ chuỗi byte không phải UTF-8, giữ nguyên.
 */
export function decodeMultipartFilename(raw: string | undefined): string {
  const name = (raw ?? '').trim();
  if (!name) return '';
  // Ký tự ngoài dải Latin-1 ⇒ tên đã được giải mã đúng, không đụng vào nữa
  if (/[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  // U+FFFD nghĩa là chuỗi byte không phải UTF-8 ⇒ giữ nguyên tên gốc
  return decoded.includes('\ufffd') ? name : decoded;
}

/** Ưu tiên đuôi tệp gốc nếu an toàn, ngược lại suy từ MIME */
function pickExtension(originalName: string, mimeType: string): string {
  const fromName = path.extname(originalName).toLowerCase();
  if (SAFE_EXTENSION_PATTERN.test(fromName)) return fromName;
  return EXTENSION_BY_MIME[mimeType] ?? DEFAULT_EXTENSION;
}

/** Giới hạn TTL link ký trong khoảng hợp lệ */
function clampTtl(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Math.min(Math.floor(ttlSeconds), MAX_SIGNED_URL_TTL_SECONDS);
}

/** Định dạng dung lượng cho thông báo lỗi tiếng Việt */
function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb * 10) / 10}MB` : `${Math.round(bytes / 1024)}KB`;
}
