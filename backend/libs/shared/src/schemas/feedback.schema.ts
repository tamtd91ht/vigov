import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SoftDeletable } from './soft-delete';
import { ActivityEntry, ActivityEntrySchema } from './activity-log';
import { applyEpochTimestamps } from './timestamped';

export type FeedbackDocument = HydratedDocument<Feedback>;

/**
 * Trạng thái yêu cầu THU HỒI phiếu do chính người dân gửi.
 *
 *   • `none`     — không có yêu cầu nào (mặc định, và là giá trị của mọi phiếu cũ)
 *   • `pending`  — người dân đã xin thu hồi, phiếu ĐÃ có người tiếp nhận nên chờ
 *                  cán bộ có quyền duyệt quyết định
 *   • `approved` — cán bộ đồng ý; phiếu được xoá mềm ngay trong cùng lượt ghi
 *   • `rejected` — cán bộ từ chối; phiếu quay lại xử lý bình thường
 *
 * Phiếu CHƯA ai tiếp nhận thì người dân gỡ được ngay, không đi qua `pending` —
 * xem `FeedbackService.requestWithdraw`.
 */
export const WITHDRAW_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type WithdrawStatus = (typeof WITHDRAW_STATUSES)[number];

/**
 * Phiếu phản ánh của người dân (WBS #6/#13) — nguồn gửi từ Zalo Mini App
 * hoặc Zalo Mini App; tên field khớp CitizenFeedback (admin-web)
 * và FeedbackTicket (mobile / zalo-miniapp).
 */
@Schema({ collection: 'feedbacks' })
export class Feedback extends SoftDeletable {
  /** Mã phiếu hiển thị: #PA-2026-0141 */
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true, index: true })
  categoryKey: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  location: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  /** Thời điểm người dân gửi phiếu — milli-giây UTC */
  @Prop({ required: true, index: true })
  sentAt: number;

  @Prop({ enum: ['received', 'processing', 'resolved'], default: 'received', index: true })
  status: string;

  /** Mốc hết hạn SLA phục vụ CronJob cảnh báo (P3-30) — milli-giây UTC */
  @Prop({ index: true })
  slaDueAt?: number;

  /** Id ảnh hiện trường trong file storage (P3-24) */
  @Prop({ type: [String], default: [] })
  imageFileIds: string[];

  /** Ảnh sau xử lý do cán bộ cập nhật */
  @Prop({ type: [String], default: [] })
  resultImageFileIds: string[];

  /**
   * Số điện thoại người phản ánh.
   *
   * KHÔNG còn `required`: phiếu do cán bộ lập hộ người dân đến trực tiếp
   * (`source: 'offline'`, WBS #6) có thể không có số điện thoại — người dân
   * trình bày tại trụ sở rồi về, không phải ai cũng để lại số. Mongoose coi
   * chuỗi rỗng là VI PHẠM `required`, nên để `required: true` thì cả luồng
   * tiếp nhận trực tiếp không tạo được phiếu.
   */
  @Prop({ default: '', index: true })
  citizenPhone: string;

  @Prop({ default: '' })
  citizenName: string;

  /** Thôn / tổ dân phố của người phản ánh (cán bộ ghi khi lập phiếu trực tiếp) */
  @Prop({ default: '' })
  area: string;

  /**
   * Kênh gửi phiếu. Giá trị `'app'` là DI SẢN của app Flutter (module `mobile/`
   * đã bỏ 09/09/2026) — giữ trong enum vì bản ghi cũ đang dùng; phiếu mới của
   * công dân vào bằng `'zalo'`, cán bộ lập hộ vào bằng `'web'`.
   */
  @Prop({ enum: ['app', 'zalo', 'web'], default: 'app' })
  channel: string;

  /**
   * Nguồn phiếu — phân biệt hai đường vào của WBS #6:
   *   • 'app'     — công dân TỰ gửi qua Zalo Mini App;
   *   • 'offline' — cán bộ lập hộ người dân đến trình bày trực tiếp tại xã.
   *
   * Mặc định 'app' để mọi phiếu tạo trước khi có trường này vẫn phân loại
   * đúng (chúng đều do công dân tự gửi).
   *
   * Tách riêng khỏi `channel`: `channel` nói phiếu tới qua thiết bị nào, còn
   * trường này nói AI đã lập phiếu — hai câu hỏi khác nhau, và báo cáo tiếp
   * nhận trực tiếp cần đúng câu thứ hai.
   */
  @Prop({ enum: ['app', 'offline'], default: 'app', index: true })
  source: string;

  /**
   * `staff_users._id` — khuôn tham chiếu v2 ("lưu id, hiển thị tên").
   * Tên hiển thị do `DirectoryService` tra khi trả dữ liệu.
   */
  @Prop({ default: '', index: true })
  assigneeId: string;

  /**
   * `org_nodes._id` — bộ phận chủ trì, trỏ vào danh mục bộ phận chuẩn.
   *
   * v1 lưu TÊN bộ phận dạng chuỗi tự do, nên sửa tên bộ phận trên trang Cấu
   * hình không đổi gì trong hồ sơ đã lưu và danh mục sinh ra hai lựa chọn cho
   * cùng một bộ phận — xem chú thích ở `org-node.schema.ts`.
   */
  @Prop({ default: '', index: true })
  departmentId: string;

  @Prop({ type: [ActivityEntrySchema], default: [] })
  timeline: ActivityEntry[];

  @Prop({ default: 0, min: 0, max: 5 })
  rating: number;

  @Prop()
  ratingComment?: string;

  /** Mã nhiệm vụ đã tạo từ phản ánh này (workflow P3-30) */
  @Prop()
  linkedTaskCode?: string;

  // ---- Thu hồi phiếu theo yêu cầu của người dân -----------------------------

  /**
   * Trạng thái yêu cầu thu hồi. Có index vì Web Quản trị lọc "chờ duyệt thu hồi"
   * để cán bộ không phải mở từng phiếu mới biết có ai xin gỡ.
   */
  @Prop({ enum: WITHDRAW_STATUSES, default: 'none', index: true })
  withdrawStatus: WithdrawStatus;

  /** Lúc người dân bấm xin thu hồi — milli-giây UTC */
  @Prop()
  withdrawRequestedAt?: number;

  /** Lý do người dân nêu khi xin thu hồi (không bắt buộc) */
  @Prop({ default: '' })
  withdrawReason: string;

  /** Lúc cán bộ duyệt hoặc từ chối — milli-giây UTC */
  @Prop()
  withdrawDecidedAt?: number;

  /**
   * `staff_users._id` của cán bộ đã quyết định thu hồi — khuôn tham chiếu v2,
   * thống nhất với `SoftDeletable.deletedById`.
   *
   * v1 lưu tên đăng nhập. Tên đăng nhập vẫn đổi được, mà hai cán bộ có thể
   * trùng họ tên, nên id là giá trị duy nhất tra được về đúng tài khoản.
   */
  @Prop({ default: '' })
  withdrawDecidedById: string;

  /**
   * Lý do cán bộ nêu khi TỪ CHỐI thu hồi.
   *
   * Bắt buộc ở tầng DTO cho đường từ chối: người dân phải biết vì sao đơn của
   * mình không được gỡ, nếu không họ chỉ thấy yêu cầu im lặng biến mất.
   */
  @Prop({ default: '' })
  withdrawDecisionNote: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
applyEpochTimestamps(FeedbackSchema);
FeedbackSchema.index({ title: 'text', description: 'text' });
