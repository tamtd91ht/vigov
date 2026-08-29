import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DEFAULT_LOCAL_DIR,
  SAFE_STORAGE_KEY_PATTERN,
  type StorageDriver,
} from './storage.driver';

/** Mã lỗi hệ thống tệp: không tìm thấy đường dẫn */
const ENOENT = 'ENOENT';

/**
 * Driver lưu trữ trên đĩa cục bộ — mặc định cho Phase 1 (một máy chủ).
 *
 * Tệp nằm dưới `storage.localDir`, chia thư mục con theo mục đích và theo
 * năm/tháng (`<purpose>/<yyyy>/<mm>/<uuid>.<ext>`) do FilesService sinh khoá.
 * Mọi khoá đều được kiểm tra bằng regex an toàn rồi đối chiếu lại đường dẫn
 * tuyệt đối với thư mục gốc để chặn path traversal.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger(LocalStorageDriver.name);

  constructor(private readonly config: ConfigService) {}

  /** Thư mục gốc đã chuẩn hoá về đường dẫn tuyệt đối */
  private get rootDir(): string {
    const dir = this.config.get<string>('storage.localDir') ?? DEFAULT_LOCAL_DIR;
    return path.resolve(dir);
  }

  /** Chuẩn hoá khoá thành đường dẫn tuyệt đối, ném lỗi nếu thoát khỏi thư mục gốc */
  private resolveKey(key: string): string {
    if (!SAFE_STORAGE_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Khoá tệp không hợp lệ');
    }
    const root = this.rootDir;
    const fullPath = path.resolve(root, key);
    const relative = path.relative(root, fullPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Đường dẫn tệp không hợp lệ');
    }
    return fullPath;
  }

  async save(buffer: Buffer, key: string, mimeType: string): Promise<void> {
    // mimeType không cần dùng khi ghi đĩa — driver S3 mới cần đặt Content-Type
    void mimeType;
    const fullPath = this.resolveKey(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  async read(key: string): Promise<Buffer> {
    const fullPath = this.resolveKey(key);
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException('Không tìm thấy tệp trên ổ lưu trữ');
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveKey(key);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if (isNotFound(error)) {
        // Tệp đã bị xoá trước đó — chỉ ghi log, không chặn việc xoá bản ghi
        this.logger.warn(`Tệp ${key} không còn trên ổ lưu trữ khi xoá`);
        return;
      }
      throw error;
    }
  }
}

/** Nhận diện lỗi "không tìm thấy tệp" của node:fs */
function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === ENOENT;
}
