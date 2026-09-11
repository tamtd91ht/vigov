import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { applyEpochTimestamps } from '@vigov/shared';

export type OtpCodeDocument = HydratedDocument<OtpCode>;

/**
 * Mã OTP định danh công dân đang còn hiệu lực (SECURITY.md TB-08).
 *
 * Schema CỤC BỘ của module Auth, cố tình không đưa vào `libs/shared` vì không
 * module nào khác được đọc bảng này.
 *
 * VÌ SAO LƯU DƯỚI CSDL CHỨ KHÔNG PHẢI BỘ NHỚ TIẾN TRÌNH: chạy hai instance sau
 * bộ cân bằng tải thì mã sinh ở instance A không xác thực được ở instance B, và
 * bộ đếm số lần nhập sai cũng không dùng chung — người dò mật khẩu chỉ cần thử
 * lần lượt vào các instance là nhân số lần thử lên.
 *
 * VÌ SAO MONGO CHỨ KHÔNG PHẢI REDIS: Redis là lựa chọn kinh điển cho loại dữ
 * liệu sống ngắn này, nhưng nó thêm một dịch vụ phải dựng, đặt mật khẩu, giám
 * sát và sao lưu cho toàn bộ vòng đời hệ thống — chi phí vận hành thật cho một
 * xã. MongoDB đã có sẵn, và TTL index dưới đây tự dọn bản ghi hết hạn nên cũng
 * không phát sinh việc quét dọn định kỳ.
 */
@Schema({ collection: 'otp_codes' })
export class OtpCode {
  /** Số điện thoại xin mã — mỗi số chỉ có tối đa một mã còn hiệu lực */
  @Prop({ required: true, unique: true, index: true })
  phone: string;

  /**
   * HMAC-SHA256 của mã, KHÔNG lưu mã dạng rõ.
   *
   * Giới hạn đã biết: mã chỉ 6 chữ số nên ai có cả bản sao CSDL lẫn khoá bí mật
   * đều dò ra được trong tức khắc. Băm ở đây chỉ để một bản sao lưu CSDL rơi ra
   * ngoài không đồng nghĩa với việc lộ luôn các mã đang sống.
   */
  @Prop({ required: true })
  codeHash: string;

  /**
   * Thời điểm hết hiệu lực. Có **TTL index** bên dưới nên MongoDB tự xoá bản
   * ghi sau thời điểm này (chậm nhất khoảng 60 giây — chu kỳ quét của Mongo).
   * Mã hết hạn vẫn bị từ chối bằng cách so mốc thời gian, không phụ thuộc việc
   * Mongo đã dọn hay chưa.
   *
   * ## NGOẠI LỆ DUY NHẤT của quy ước "mọi mốc thời gian lưu dạng số" (v2)
   *
   * Chỉ mục TTL của MongoDB **chỉ hoạt động trên trường BSON `Date`**. Đổi
   * trường này sang số thì TTL im lặng ngừng dọn — không báo lỗi, không ai
   * biết, và bảng `otp_codes` phình vô hạn với dữ liệu xác thực lẽ ra phải hết
   * hạn. Nên trường này giữ `Date`, và đây là chỗ duy nhất được phép.
   */
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  /** Số lần đã nhập sai cho chính mã này */
  @Prop({ default: 0 })
  attempts: number;
}

export const OtpCodeSchema = SchemaFactory.createForClass(OtpCode);
applyEpochTimestamps(OtpCodeSchema);

/** MongoDB tự xoá bản ghi khi quá `expiresAt` — không cần cron dọn rác */
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
