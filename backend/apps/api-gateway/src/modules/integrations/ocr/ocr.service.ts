import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { IntegrationSettingsService } from '../../settings/integration-settings.service';
import {
  MockOcrProvider,
  OCR_DEFAULT_PROVIDER,
  OCR_FIELD_DEFS,
  OCR_SUPPORTED_PROVIDERS,
  type OcrExtractResult,
  type OcrProvider,
  type OcrRuntimeConfig,
} from './ocr.provider';
import { OcrSpaceProvider } from './ocrspace.provider';

/**
 * Chọn và gọi provider OCR đang cấu hình (WBS #25).
 *
 * Nguồn cấu hình: trang Cấu hình (cơ sở dữ liệu) THẮNG biến môi trường; biến
 * môi trường là giá trị mồi khi chưa ai cấu hình. Luật đó nằm ở
 * `IntegrationSettingsService.resolveOcr()` — chỗ duy nhất, để không provider
 * nào tự suy luận lại.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly settings: IntegrationSettingsService,
    private readonly mockProvider: MockOcrProvider,
    private readonly ocrSpaceProvider: OcrSpaceProvider,
  ) {}

  /** Danh sách khoá 7 trường chuẩn — module Documents dùng để dựng khung ocrFields */
  get fieldDefs() {
    return OCR_FIELD_DEFS;
  }

  /** Trích xuất thông tin từ bản scan; fileRef là scanFileId trong file storage */
  async extract(fileRef: string): Promise<OcrExtractResult> {
    const resolved = await this.settings.resolveOcr();
    const name = (resolved.provider || OCR_DEFAULT_PROVIDER).trim().toLowerCase();
    const provider = this.resolveProvider(name);

    this.logger.log(
      `Chạy OCR bản scan ${fileRef} bằng provider "${name}" (nguồn cấu hình: ${resolved.source})`,
    );

    const config: OcrRuntimeConfig = { apiKey: resolved.apiKey, endpoint: resolved.endpoint };
    return provider.extract(fileRef, config);
  }

  /**
   * Ánh xạ tên cấu hình sang lớp provider.
   * Thêm nhà cung cấp mới: viết một lớp implements OcrProvider, thêm tên vào
   * OCR_SUPPORTED_PROVIDERS và một nhánh tại đây.
   */
  private resolveProvider(name: string): OcrProvider {
    if (name === 'mock') return this.mockProvider;
    if (name === 'ocrspace') return this.ocrSpaceProvider;

    throw new ServiceUnavailableException(
      `Chưa tích hợp provider OCR: ${name}. Hiện chỉ hỗ trợ: ${OCR_SUPPORTED_PROVIDERS.join(', ')}.`,
    );
  }
}
