import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockOcrProvider,
  OCR_FIELD_DEFS,
  type OcrExtractResult,
  type OcrProvider,
} from './ocr.provider';

/** Nhà cung cấp OCR đã tích hợp — Phase 1 mới chỉ có bản giả lập */
const SUPPORTED_PROVIDERS = ['mock'] as const;
const DEFAULT_PROVIDER = 'mock';

/**
 * Dịch vụ OCR dùng chung (WBS #25 — task P3-25).
 * Chọn provider theo cấu hình `ocr.provider`, module Documents chỉ gọi extract().
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mockProvider: MockOcrProvider,
  ) {}

  /** Danh sách khoá 7 trường chuẩn — module Documents dùng để dựng khung ocrFields */
  get fieldDefs() {
    return OCR_FIELD_DEFS;
  }

  /** Trích xuất thông tin từ bản scan; fileRef là scanFileId trong file storage */
  async extract(fileRef: string): Promise<OcrExtractResult> {
    const provider = this.resolveProvider();
    this.logger.log(`Chạy OCR bản scan ${fileRef} bằng provider "${this.providerName}"`);
    return provider.extract(fileRef);
  }

  private get providerName(): string {
    return (this.config.get<string>('ocr.provider') ?? DEFAULT_PROVIDER).trim().toLowerCase();
  }

  /**
   * Ánh xạ tên cấu hình sang lớp provider.
   * Provider thật chờ khách chốt (câu hỏi mở #1) — khách tự đăng ký tài khoản
   * và cung cấp OCR_API_KEY, khi đó bổ sung nhánh tương ứng tại đây.
   */
  private resolveProvider(): OcrProvider {
    const name = this.providerName;
    if (name === 'mock') return this.mockProvider;

    throw new ServiceUnavailableException(
      `Chưa tích hợp provider OCR: ${name}. Hiện chỉ hỗ trợ: ${SUPPORTED_PROVIDERS.join(', ')}.`,
    );
  }
}
