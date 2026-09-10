import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SecretDecryptError, decryptSecret, encryptSecret, maskSecret } from '@vigov/shared';
import { OCR_SUPPORTED_PROVIDERS } from '../integrations/ocr/ocr.provider';
import { UpdateOcrIntegrationDto } from './dto/settings.dto';
import {
  INTEGRATION_SETTINGS_KEY,
  IntegrationSettings,
} from './schemas/integration-settings.schema';

/** Cấu hình đã giải quyết xong, sẵn để tầng tích hợp dùng */
export interface ResolvedOcrConfig {
  provider: string;
  apiKey: string;
  endpoint: string;
  /** Cấu hình lấy từ đâu — dùng để hiện trên giao diện và để tìm lỗi */
  source: 'database' | 'env';
}

/** Trạng thái cấu hình trả ra giao diện — KHÔNG chứa khoá dạng rõ */
export interface OcrIntegrationStatus {
  provider: string;
  endpoint: string;
  /** Khoá đã che, ví dụ `••••••••ghij`. Rỗng nghĩa là chưa có khoá */
  apiKeyMasked: string;
  /** Có khoá lưu trong cơ sở dữ liệu hay không */
  hasStoredKey: boolean;
  /** Khoá đã lưu nhưng không giải mã được (thường do JWT_SECRET đã đổi) */
  storedKeyUnreadable: boolean;
  source: 'database' | 'env';
  updatedBy: string;
  updatedAt: Date | null;
  /**
   * Nhà cung cấp máy chủ hỗ trợ — giao diện đọc danh sách này thay vì tự khai
   * một bản sao, để không cho chọn nhà cung cấp máy chủ chưa tích hợp.
   */
  supportedProviders: string[];
}

/**
 * Cấu hình nhà cung cấp bên thứ 3 lưu trong cơ sở dữ liệu.
 *
 * Thứ tự ưu tiên MỘT CHIỀU: cơ sở dữ liệu thắng biến môi trường; biến môi
 * trường là giá trị mồi khi chưa ai cấu hình (máy mới clone về, CI, lần đầu
 * dựng máy chủ). Hai chiều là lệch cấu hình không truy được.
 *
 * "Chưa cấu hình" nghĩa là `provider` rỗng — không phải bản ghi không tồn tại.
 * Nhờ vậy đặt provider rỗng ở giao diện là cách chủ động quay về biến môi trường.
 */
@Injectable()
export class IntegrationSettingsService {
  private readonly logger = new Logger(IntegrationSettingsService.name);

  constructor(
    @InjectModel(IntegrationSettings.name)
    private readonly model: Model<IntegrationSettings>,
    private readonly config: ConfigService,
  ) {}

  /** Bí mật gốc để suy khoá mã hoá — xem `libs/shared/src/crypto/secret-box.ts` */
  private get masterSecret(): string {
    return this.config.get<string>('auth.jwtSecret') ?? '';
  }

  /**
   * Cấu hình OCR đang có hiệu lực.
   *
   * Khoá không giải mã được thì trả khoá rỗng và ghi cảnh báo, KHÔNG ném lỗi:
   * provider sẽ báo "chưa đặt khoá" kèm hướng dẫn, còn ném lỗi ở đây là cả
   * trang Cấu hình không mở được, cán bộ mất luôn đường vào để sửa.
   */
  async resolveOcr(): Promise<ResolvedOcrConfig> {
    const doc = await this.model
      .findOne({ settingsKey: INTEGRATION_SETTINGS_KEY })
      .select('+ocr.apiKeyEncrypted')
      .lean()
      .exec();

    const provider = (doc?.ocr?.provider ?? '').trim();
    if (!provider) {
      return {
        provider: (this.config.get<string>('ocr.provider') ?? '').trim(),
        apiKey: (this.config.get<string>('ocr.apiKey') ?? '').trim(),
        endpoint: (this.config.get<string>('ocr.endpoint') ?? '').trim(),
        source: 'env',
      };
    }

    return {
      provider,
      apiKey: this.readStoredKey(doc?.ocr?.apiKeyEncrypted),
      endpoint: (doc?.ocr?.endpoint ?? '').trim(),
      source: 'database',
    };
  }

  /** Trạng thái cấu hình cho trang Cấu hình — khoá luôn ở dạng đã che */
  async getOcrStatus(): Promise<OcrIntegrationStatus> {
    const doc = await this.model
      .findOne({ settingsKey: INTEGRATION_SETTINGS_KEY })
      .select('+ocr.apiKeyEncrypted')
      .lean()
      .exec();

    const stored = (doc?.ocr?.apiKeyEncrypted ?? '').trim();
    const resolved = await this.resolveOcr();

    let apiKeyMasked = '';
    let storedKeyUnreadable = false;
    if (stored) {
      try {
        apiKeyMasked = maskSecret(decryptSecret(stored, this.masterSecret));
      } catch {
        storedKeyUnreadable = true;
      }
    }

    return {
      provider: resolved.provider,
      endpoint: resolved.endpoint,
      apiKeyMasked,
      hasStoredKey: Boolean(stored),
      storedKeyUnreadable,
      source: resolved.source,
      updatedBy: doc?.updatedBy ?? '',
      updatedAt: (doc as { updatedAt?: Date } | null)?.updatedAt ?? null,
      supportedProviders: [...OCR_SUPPORTED_PROVIDERS],
    };
  }

  /**
   * Lưu cấu hình OCR. Trường không gửi thì giữ nguyên giá trị đang lưu.
   *
   * `apiKey` là chuỗi rỗng = xoá khoá (chủ động), khác hẳn với KHÔNG gửi trường
   * đó = giữ khoá cũ. Phân biệt hai việc này là bắt buộc: giao diện không bao
   * giờ nhận lại khoá dạng rõ nên không thể gửi lại khoá cũ để "giữ nguyên".
   */
  async updateOcr(dto: UpdateOcrIntegrationDto, actor: string): Promise<OcrIntegrationStatus> {
    const set: Record<string, unknown> = { updatedBy: actor };

    if (dto.provider !== undefined) set['ocr.provider'] = dto.provider.trim();
    if (dto.endpoint !== undefined) set['ocr.endpoint'] = dto.endpoint.trim();
    if (dto.apiKey !== undefined) {
      const plain = dto.apiKey.trim();
      set['ocr.apiKeyEncrypted'] = plain ? encryptSecret(plain, this.masterSecret) : '';
    }

    await this.model
      .updateOne(
        { settingsKey: INTEGRATION_SETTINGS_KEY },
        { $set: set, $setOnInsert: { settingsKey: INTEGRATION_SETTINGS_KEY } },
        { upsert: true },
      )
      .exec();

    // Đổi nhà cung cấp là đổi nơi dữ liệu công dân được gửi tới. Nhật ký thao
    // tác đã ghi vết qua HTTP, thêm một dòng ở log tiến trình để tìm nhanh.
    this.logger.warn(
      `Cán bộ ${actor} đã cập nhật cấu hình nhà cung cấp OCR` +
        (dto.provider !== undefined ? ` (provider = "${dto.provider.trim() || 'theo biến môi trường'}")` : ''),
    );

    return this.getOcrStatus();
  }

  /** Giải mã khoá đã lưu; không đọc được thì coi như chưa có khoá */
  private readStoredKey(encrypted: string | undefined): string {
    const stored = (encrypted ?? '').trim();
    if (!stored) return '';
    try {
      return decryptSecret(stored, this.masterSecret);
    } catch (err) {
      if (err instanceof SecretDecryptError) {
        this.logger.error(
          'Không giải mã được khoá API của nhà cung cấp OCR đã lưu. ' +
            'Thường do JWT_SECRET đã đổi kể từ lần lưu khoá — cần nhập lại khoá ở trang Cấu hình.',
        );
        return '';
      }
      throw err;
    }
  }
}
