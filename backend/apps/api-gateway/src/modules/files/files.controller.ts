import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Public, RequirePermission, type AuthedRequest } from '@vigov/shared';
import { FilesService, DEFAULT_SIGNED_URL_TTL_SECONDS, type FileRequester } from './files.service';
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
    @Res() res: Response,
  ): Promise<void> {
    // Chữ ký được kiểm tra bên trong openForDownload, TRƯỚC khi đọc ổ lưu trữ
    const { file, buffer } = await this.files.openForDownload(id, query.exp, query.sig);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    // Không cho trình duyệt tự đoán kiểu nội dung của tệp do người dùng tải lên
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDisposition(file.originalName, file.mimeType));
    res.setHeader(
      'Cache-Control',
      file.isPrivate ? 'private, no-store' : `public, max-age=${PUBLIC_CACHE_SECONDS}`,
    );
    res.end(buffer);
  }

  /** Xoá tệp (bản ghi + tệp vật lý) — chỉ quản trị hệ thống */
  @Delete(':id')
  @RequirePermission('settings', 'admin')
  remove(@Param('id') id: string) {
    return this.files.remove(id);
  }
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
