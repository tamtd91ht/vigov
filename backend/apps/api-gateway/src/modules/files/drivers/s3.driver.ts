import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import type { ByteRange, StorageDriver } from './storage.driver';

/** Thông báo khi cụm S3/MinIO chưa được khai báo trong biến môi trường */
const MSG_NOT_CONFIGURED = 'Chưa cấu hình S3 storage';
/** Thông báo khi đã khai báo bucket nhưng SDK chưa được gắn (giai đoạn P4) */
const MSG_NOT_IMPLEMENTED =
  'Driver S3 chưa được gắn SDK. Giai đoạn hiện tại vui lòng đặt STORAGE_DRIVER=local.';

/**
 * Khung driver S3/MinIO (WBS #24 — task P3-24).
 *
 * LƯU Ý: SDK S3 (@aws-sdk/client-s3 hoặc minio) sẽ được gắn ở GIAI ĐOẠN TRIỂN
 * KHAI HẠ TẦNG (P4), khi khách chốt dùng S3 hay MinIO on-premise và cấp
 * endpoint/bucket/access key. Hiện tại hệ thống chạy bằng LocalStorageDriver;
 * lớp này chỉ giữ đúng hợp đồng StorageDriver để việc chuyển đổi sau này chỉ là
 * đổi biến môi trường STORAGE_DRIVER=s3, không phải sửa mã nghiệp vụ.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly logger = new Logger(S3StorageDriver.name);

  constructor(private readonly config: ConfigService) {}

  async save(buffer: Buffer, key: string, mimeType: string): Promise<void> {
    void buffer;
    void mimeType;
    this.ensureReady(key);
  }

  async read(key: string): Promise<Buffer> {
    this.ensureReady(key);
    // Không bao giờ tới đây — ensureReady luôn ném lỗi ở giai đoạn hiện tại
    return Buffer.alloc(0);
  }

  async size(key: string): Promise<number> {
    this.ensureReady(key);
  }

  createReadStream(key: string, range?: ByteRange): Readable {
    void range;
    this.ensureReady(key);
  }

  async delete(key: string): Promise<void> {
    this.ensureReady(key);
  }

  /**
   * Kiểm tra cấu hình trước mỗi thao tác.
   * Chưa có bucket → báo chưa cấu hình; có bucket → báo chưa gắn SDK.
   */
  private ensureReady(key: string): never {
    const bucket = (this.config.get<string>('storage.s3.bucket') ?? '').trim();
    if (!bucket) {
      throw new ServiceUnavailableException(MSG_NOT_CONFIGURED);
    }
    this.logger.warn(`Bỏ qua thao tác S3 với khoá ${key} — SDK sẽ gắn ở giai đoạn P4`);
    throw new ServiceUnavailableException(MSG_NOT_IMPLEMENTED);
  }
}
