import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Public, RequirePermission, type AuthedRequest } from '@vigov/shared';
import { FilesService, DEFAULT_SIGNED_URL_TTL_SECONDS, type FileRequester } from './files.service';
import type { ByteRange } from './drivers/storage.driver';
import { FileAccessQueryDto, SignedUrlQueryDto, UploadFileDto } from './dto/file.dto';

/** Tên field multipart chứa tệp */
const FILE_FIELD = 'file';
/** Thời gian cache tệp công khai ở trình duyệt (giây) */
const PUBLIC_CACHE_SECONDS = 3600;

/**
 * MIME được phép hiển thị NỘI TUYẾN trong trình duyệt.
 * Mọi định dạng khác buộc tải về (attachment) để trình duyệt không bao giờ
 * dựng tệp lạ thành trang web trên tên miền API.
 */
const INLINE_SAFE_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
const INLINE_SAFE_MIME_TYPES = ['application/pdf', 'text/plain'];
/** SVG tuy là image/* nhưng chạy được script — luôn bắt tải về (tệp cũ trước khi chặn upload) */
const NEVER_INLINE_MIME_TYPES = ['image/svg+xml', 'image/svg'];

/** Người gọi hiện tại dưới dạng FilesService cần để kiểm tra quyền */
function requesterOf(req: AuthedRequest): FileRequester | undefined {
  if (!req.user) return undefined;
  return { username: req.user.username, roleKey: req.user.roleKey };
}

/**
 * API lưu trữ tệp (WBS #24 — task P3-24).
 *
 * Tải lên: mọi tài khoản đã đăng nhập, kể cả công dân (roleKey 'citizen') vì
 * app công dân cần đính kèm ảnh/video khi gửi phản ánh — do đó KHÔNG gắn
 * @RequirePermission, chỉ dựa vào JwtAuthGuard toàn cục.
 */
@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly files: FilesService) {}

  /** Tải tệp lên (multipart/form-data: file + purpose + isPrivate) */
  @Post('upload')
  @UseInterceptors(FileInterceptor(FILE_FIELD))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Req() req: AuthedRequest,
  ) {
    const uploadedBy = req.user?.username ?? '';
    return this.files.upload(file, dto.purpose ?? 'other', uploadedBy, dto.isPrivate === true);
  }

  /**
   * Cấp link ký sẵn để đọc tệp riêng tư.
   * Cán bộ ký được mọi tệp phục vụ tác nghiệp; công dân chỉ ký được tệp do
   * chính mình tải lên (xem FilesService.assertCanSign).
   */
  @Get(':id/signed-url')
  signedUrl(@Param('id') id: string, @Query() query: SignedUrlQueryDto, @Req() req: AuthedRequest) {
    return this.files.signedUrl(id, query.ttl ?? DEFAULT_SIGNED_URL_TTL_SECONDS, requesterOf(req));
  }

  /**
   * Đọc nội dung tệp.
   * Route để @Public() vì link ký sẵn được nhúng thẳng vào app/CMS (thẻ <img>,
   * player không gửi được header Authorization); tệp riêng tư tự kiểm tra chữ ký
   * ngay tại đây, tệp công khai trả thẳng nội dung.
   */
  @Public()
  @Get(':id')
  async download(
    @Param('id') id: string,
    @Query() query: FileAccessQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Chữ ký được kiểm tra bên trong openForStream, TRƯỚC khi chạm ổ lưu trữ
    const { file, size } = await this.files.openForStream(id, query.exp, query.sig);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    // Không cho trình duyệt tự đoán kiểu nội dung của tệp do người dùng tải lên
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDisposition(file.originalName, file.mimeType));
    res.setHeader(
      'Cache-Control',
      file.isPrivate ? 'private, no-store' : `public, max-age=${PUBLIC_CACHE_SECONDS}`,
    );
    /*
     * Ghi đè Cross-Origin-Resource-Policy mà securityHeaders đặt mặc định là
     * 'same-site' cho toàn bộ API.
     *
     * Zalo Mini App chạy trong webview ở h5.zdn.vn, khác site với tên miền API,
     * nên với 'same-site' trình duyệt CHẶN mọi thẻ <video>/<img> trỏ về đây —
     * ảnh và video im lặng không hiện, không báo lỗi gì trong ứng dụng.
     *
     * Chỉ nới cho tệp CÔNG KHAI; tệp riêng tư giữ 'same-site' để không bị trang
     * ngoài nhúng vào ngay cả khi lộ link ký sẵn.
     */
    if (!file.isPrivate) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    /*
     * Báo cho trình phát biết có thể tua. Thiếu header này thì thẻ <video> của
     * trình duyệt vô hiệu hoá thanh tua, dù máy chủ có phục vụ Range đi nữa.
     */
    res.setHeader('Accept-Ranges', 'bytes');

    const range = parseRange(req.headers.range, size);

    if (range === 'invalid') {
      /*
       * Khoảng nằm ngoài tệp. RFC 9110 bắt trả 416, kèm Content-Range chỉ mang
       * tổng kích thước tệp (không có khoảng cụ thể) để phía kia biết độ dài
       * thật mà xin lại cho đúng.
       */
      res.status(416);
      res.setHeader('Content-Range', `bytes */${size}`);
      res.end();
      return;
    }

    if (range) {
      const length = range.end - range.start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader('Content-Length', length);
    } else {
      res.setHeader('Content-Length', size);
    }

    const stream = this.files.readStream(file, range ?? undefined);

    /*
     * Tệp biến mất giữa chừng (bị xoá song song) phát lỗi qua sự kiện này. Header
     * đã gửi rồi nên không đổi được mã trạng thái — chỉ còn cách ngắt kết nối để
     * phía kia biết dữ liệu dở dang, thay vì treo chờ hết Content-Length.
     */
    stream.on('error', (err) => {
      this.logger.error(`Lỗi đọc luồng tệp ${id}: ${err.message}`);
      res.destroy(err);
    });

    /*
     * Người xem tua hoặc thoát giữa chừng thì Express đóng kết nối; phải huỷ
     * luồng đọc, không thì mỗi lần tua để lại một handle tệp mở.
     */
    res.on('close', () => stream.destroy());

    stream.pipe(res);
  }

  /** Xoá tệp (bản ghi + tệp vật lý) — chỉ quản trị hệ thống */
  @Delete(':id')
  @RequirePermission('settings', 'admin')
  remove(@Param('id') id: string) {
    return this.files.remove(id);
  }
}

/**
 * Đọc header `Range` thành khoảng byte cụ thể.
 *
 * Trả về:
 *   · `null`      — không có Range, hoặc dạng ta không phục vụ ⇒ trả nguyên tệp
 *   · `'invalid'` — có Range nhưng nằm ngoài tệp ⇒ phải trả 416
 *   · ByteRange   — khoảng hợp lệ, tính cả hai đầu
 *
 * Chỉ nhận đơn vị `bytes` và MỘT khoảng. Nhiều khoảng (`bytes=0-9,20-29`) phải
 * trả multipart/byteranges — trình phát video không dùng tới, nên bỏ qua và trả
 * nguyên tệp; đó là hành vi hợp lệ theo RFC 9110 (máy chủ được phép làm ngơ Range).
 */
export function parseRange(header: string | undefined, size: number): ByteRange | null | 'invalid' {
  if (!header || size <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;

  if (rawStart === '') {
    /*
     * Dạng hậu tố `bytes=-500`: xin 500 byte CUỐI tệp. Trình phát dùng dạng này
     * để đọc chỉ mục moov nằm cuối tệp MP4 trước khi phát.
     */
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    // `bytes=1000-` nghĩa là từ 1000 tới hết tệp
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid';
    // Xin quá đuôi tệp thì cắt về byte cuối, không phải lỗi
    if (end > size - 1) end = size - 1;
  }

  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

/**
 * Header Content-Disposition, giữ nguyên tên tệp tiếng Việt.
 * Phần `filename` thuần ASCII để trình duyệt cũ không lỗi, `filename*` mang tên đầy đủ.
 *
 * Chỉ ảnh / âm thanh / video / PDF được hiển thị nội tuyến (app và CMS cần nhúng
 * trực tiếp). Các định dạng còn lại buộc tải về để trình duyệt không dựng nội dung
 * do người dùng tải lên thành trang web trên tên miền API.
 */
function contentDisposition(originalName: string, mimeType: string): string {
  const safeName = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const type = isInlineSafe(mimeType) ? 'inline' : 'attachment';
  return `${type}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
}

/** MIME có được phép hiển thị nội tuyến không */
function isInlineSafe(mimeType: string): boolean {
  const value = (mimeType ?? '').toLowerCase();
  if (NEVER_INLINE_MIME_TYPES.includes(value)) return false;
  if (INLINE_SAFE_MIME_TYPES.includes(value)) return true;
  return INLINE_SAFE_MIME_PREFIXES.some((prefix) => value.startsWith(prefix));
}
