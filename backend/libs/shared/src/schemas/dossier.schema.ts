import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ActivityEntry, ActivityEntrySchema } from './activity-log';
import { applyEpochTimestamps } from './timestamped';

export type DossierDocument = HydratedDocument<Dossier>;

/**
 * Bốn bước cố định của quy trình một cửa cấp xã (WBS #15).
 *
 * Khai ở đây — cạnh schema — chứ không ở service, vì cả `status` (bước hiện
 * tại) lẫn `stepTimes` (mốc vào từng bước) đều dùng chung tập khoá này; để hai
 * chỗ tự khai là sớm muộn lệch nhau.
 */
export const DOSSIER_STEP_KEYS = ['received', 'appraising', 'awaiting_signature', 'returned'] as const;
export type DossierStepKey = (typeof DOSSIER_STEP_KEYS)[number];

/** Nhãn tiếng Việt của từng bước — hợp đồng API trả đúng các nhãn này */
export const DOSSIER_STEP_LABELS: Record<DossierStepKey, string> = {
  received: 'Tiếp nhận',
  appraising: 'Thẩm định',
  awaiting_signature: 'Chờ ký duyệt',
  returned: 'Trả kết quả',
};

/**
 * Mốc thời gian hồ sơ ĐI VÀO một bước.
 *
 * VÌ SAO KHÔNG DÙNG `timeline` cho việc này: `ActivityEntry` (dùng chung với
 * Nhiệm vụ và Phản ánh) chỉ có {title, meta, state} — `meta` là chuỗi hiển thị
 * đã định dạng sẵn, không phải Date, nên không tra ngược ra mốc ISO mà API phải
 * trả trong `steps[].at`. Hai trường tồn tại song song có chủ ý: `stepTimes` là
 * dữ liệu máy đọc, `timeline` là nhật ký cho người đọc.
 */
@Schema({ _id: false })
export class DossierStepTime {
  @Prop({ required: true, enum: DOSSIER_STEP_KEYS })
  key: string;

  @Prop({ required: true })
  at: number;
}
export const DossierStepTimeSchema = SchemaFactory.createForClass(DossierStepTime);

/**
 * Hồ sơ thủ tục hành chính một cửa (WBS #15).
 *
 * Phase 1 CHỈ có tra cứu công khai theo mã — không có CRUD quản trị. Nguồn dữ
 * liệu thật phải đến từ hệ thống một cửa của tỉnh/thành qua liên thông; hạng
 * mục liên thông đó khách đã xác nhận nằm NGOÀI phạm vi WBS. Dữ liệu hiện tại
 * trong collection này là seed demo (xem docs/01-BACKEND.md mục Hồ sơ một cửa).
 */
@Schema({ collection: 'dossiers' })
export class Dossier {
  /** Mã tra cứu in trên giấy tiếp nhận: HS-2026-04182 */
  @Prop({ required: true, unique: true, index: true })
  code: string;

  /** Tên thủ tục hành chính */
  @Prop({ required: true })
  procedure: string;

  @Prop({ required: true })
  applicantName: string;

  /**
   * Số điện thoại THẬT của người nộp hồ sơ.
   *
   * API tra cứu là endpoint CÔNG KHAI (ai có mã hồ sơ cũng gọi được) nên giá
   * trị này luôn được che trước khi trả ra, theo đúng chính sách của
   * UsersService.maskPhone: giữ 3 số đầu + 3 số cuối.
   */
  @Prop({ default: '' })
  applicantPhone: string;

  /** Bộ phận chủ trì xử lý hồ sơ */
  @Prop({ default: '', index: true })
  department: string;

  /** Cán bộ phụ trách hồ sơ */
  @Prop({ default: '' })
  assignee: string;

  @Prop({ enum: DOSSIER_STEP_KEYS, default: 'received', index: true })
  status: string;

  /** Thời điểm tiếp nhận hồ sơ — milli-giây UTC */
  @Prop({ required: true, index: true })
  submittedAt: number;

  /** Hạn trả kết quả theo giấy hẹn — milli-giây UTC, hết ngày giờ Việt Nam */
  @Prop({ index: true })
  dueAt?: number;

  /** Ghi chú hiển thị cho công dân (ví dụ hướng dẫn đến nhận kết quả) */
  @Prop({ default: '' })
  note: string;

  /** Mốc vào từng bước — nguồn của `steps[].at` trong phản hồi API */
  @Prop({ type: [DossierStepTimeSchema], default: [] })
  stepTimes: DossierStepTime[];

  /** Nhật ký cho người đọc, cùng kiểu với Nhiệm vụ và Phản ánh */
  @Prop({ type: [ActivityEntrySchema], default: [] })
  timeline: ActivityEntry[];
}

export const DossierSchema = SchemaFactory.createForClass(Dossier);
applyEpochTimestamps(DossierSchema);
