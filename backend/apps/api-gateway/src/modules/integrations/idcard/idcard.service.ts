import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IDCARD_FIELD_DEFS,
  type IdCardExtractResult,
  type IdCardProvider,
  MockIdCardProvider,
} from './idcard.provider';

/** Nhà cung cấp đã tích hợp — mới chỉ có bản giả lập */
const SUPPORTED_PROVIDERS = ['mock'] as const;
const DEFAULT_PROVIDER = 'mock';

/**
 * Dịch vụ đọc thẻ căn cước (P5-11 — tầng 3).
 * Chọn provider theo cấu hình `idcard.provider`; tầng nghiệp vụ chỉ gọi extract().
 *
 * Cùng khuôn với OcrService để hai đầu nối bên thứ 3 vận hành giống nhau —
 * đổi nhà cung cấp chỉ sửa một tệp adapter, theo nguyên tắc ở CLAUDE.md.
 */
@Injectable()
export class IdCardService {
  private readonly logger = new Logger(IdCardService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mockProvider: MockIdCardProvider,
  ) {}

  /** Bộ trường chuẩn của thẻ căn cước — dùng chung với mini app */
  get fieldDefs() {
    return IDCARD_FIELD_DEFS;
  }

  /** Trích thông tin từ ảnh thẻ; fileRef là fileId trong file storage */
  async extract(fileRef: string): Promise<IdCardExtractResult> {
    const provider = this.resolveProvider();
    // Chỉ ghi fileRef, KHÔNG ghi trường nào của thẻ vào log
    this.logger.log(`Đọc thẻ căn cước ${fileRef} bằng provider "${this.providerName}"`);
    return provider.extract(fileRef);
  }

  private get providerName(): string {
    return (this.config.get<string>('idcard.provider') ?? DEFAULT_PROVIDER).trim().toLowerCase();
  }

  /**
   * Ánh xạ tên cấu hình sang lớp provider.
   * Provider thật chờ khách chốt nhà cung cấp VÀ chốt ràng buộc dữ liệu cá nhân
   * theo NĐ 13/2023 (câu hỏi mở #1) — bổ sung nhánh tương ứng tại đây.
   */
  private resolveProvider(): IdCardProvider {
    const name = this.providerName;
    if (name === 'mock') return this.mockProvider;

    throw new ServiceUnavailableException(
      `Chưa tích hợp provider đọc thẻ căn cước: ${name}. Hiện chỉ hỗ trợ: ${SUPPORTED_PROVIDERS.join(', ')}.`,
    );
  }
}
