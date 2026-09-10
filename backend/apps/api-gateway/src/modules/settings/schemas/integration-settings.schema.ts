import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IntegrationSettingsDocument = HydratedDocument<IntegrationSettings>;

/**
 * Khoá của bản ghi cấu hình duy nhất.
 *
 * Cấu hình tích hợp là MỘT bản ghi cho cả hệ thống, không phải danh sách: mỗi
 * xã/phường chỉ ký hợp đồng với một nhà cung cấp cho mỗi loại dịch vụ. Dùng một
 * khoá cố định + chỉ mục duy nhất để không bao giờ có hai bản ghi tranh nhau —
 * hai bản ghi thì không ai biết bản nào đang có hiệu lực.
 */
export const INTEGRATION_SETTINGS_KEY = 'default';

/** Cấu hình một nhà cung cấp OCR */
@Schema({ _id: false })
export class OcrIntegrationConfig {
  /**
   * Tên nhà cung cấp, khớp danh sách `SUPPORTED_PROVIDERS` của `OcrService`.
   * Rỗng nghĩa là chưa cấu hình ở đây — hệ thống rơi về biến môi trường.
   */
  @Prop({ default: '' })
  provider: string;

  /**
   * Khoá API ĐÃ MÃ HOÁ bằng `encryptSecret` (`libs/shared/src/crypto`).
   *
   * `select: false` — mọi truy vấn phải xin trường này tường minh. Đây là cùng
   * một chốt đang dùng cho `passwordHash`: quên `select` một lần là khoá của
   * khách đi ra ngoài theo một phản hồi API không ai để ý.
   *
   * KHÔNG BAO GIỜ trả trường này ra API, kể cả dạng đã mã hoá. Giao diện chỉ
   * nhận giá trị đã che từ `maskSecret`.
   */
  @Prop({ default: '', select: false })
  apiKeyEncrypted: string;

  /** Điểm cuối riêng — để trống thì provider tự dùng mặc định của mình */
  @Prop({ default: '' })
  endpoint: string;
}

export const OcrIntegrationConfigSchema = SchemaFactory.createForClass(OcrIntegrationConfig);

/**
 * Cấu hình nhà cung cấp bên thứ 3, sửa được từ trang Cấu hình — WBS #9.
 *
 * VÌ SAO NẰM Ở CƠ SỞ DỮ LIỆU CHỨ KHÔNG CHỈ Ở BIẾN MÔI TRƯỜNG: một mã nguồn chạy
 * cho nhiều xã, mỗi xã một hợp đồng và một khoá riêng. Để ở biến môi trường thì
 * mỗi khách mới là một lần vào máy chủ sửa tệp rồi khởi động lại dịch vụ.
 *
 * THỨ TỰ ƯU TIÊN: cấu hình ở đây THẮNG biến môi trường; biến môi trường là giá
 * trị mồi khi chưa ai cấu hình gì (máy mới clone về, CI). Quy tắc này phải giữ
 * đúng một chiều — hai chiều là lệch cấu hình không truy được.
 *
 * Mở rộng dần: thêm nhà cung cấp loại khác (đọc thẻ căn cước, GIS, ZNS) thì
 * thêm một trường lồng theo đúng khuôn `ocr`, KHÔNG tạo collection mới.
 */
@Schema({ collection: 'integration_settings', timestamps: true })
export class IntegrationSettings {
  /** Luôn là `INTEGRATION_SETTINGS_KEY` — chỉ mục duy nhất chặn bản ghi thứ hai */
  @Prop({ required: true, unique: true, index: true, default: INTEGRATION_SETTINGS_KEY })
  settingsKey: string;

  @Prop({ type: OcrIntegrationConfigSchema, default: () => ({}) })
  ocr: OcrIntegrationConfig;

  /**
   * Ai sửa lần gần nhất — tên đăng nhập của cán bộ.
   *
   * Nhật ký thao tác đã ghi vết đầy đủ ở `audit_logs`, nhưng trang Cấu hình cần
   * hiện ngay "ai đổi, lúc nào" mà không phải mở nhật ký. Đổi nhà cung cấp là
   * đổi nơi dữ liệu công dân được gửi tới — người sau phải thấy được ai quyết.
   */
  @Prop({ default: '' })
  updatedBy: string;
}

export const IntegrationSettingsSchema = SchemaFactory.createForClass(IntegrationSettings);
