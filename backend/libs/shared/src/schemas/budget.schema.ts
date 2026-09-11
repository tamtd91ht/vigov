import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Comment, CommentSchema } from './comment';
import { SoftDeletable } from './soft-delete';

export type BudgetItemDocument = HydratedDocument<BudgetItem>;

/**
 * Phân hệ Giải ngân — mô hình dữ liệu (WBS #5).
 *
 * ĐƠN VỊ TIỀN: ĐỒNG, SỐ NGUYÊN. Mọi trường tên `*Dong`. Xem
 * `libs/shared/src/money/vnd.ts` để biết vì sao không lưu "tỷ đồng" số thực.
 *
 * BA CHIỀU TRẠNG THÁI TÁCH RIÊNG, KHÔNG GỘP MỘT TRƯỜNG:
 *
 *   1. `approvalStatus`  — hồ sơ / phê duyệt. NGƯỜI quyết, có workflow + quyền.
 *   2. mức giải ngân     — SUY RA từ số tiền. Không lưu.
 *   3. tình trạng tiến độ — SUY RA từ thời gian. Không lưu.
 *
 * Gộp ba chiều vào một trường là mất thông tin ngay: một hạng mục có thể VỪA
 * "đã giải ngân một phần" VỪA "chậm tiến độ" — hai giá trị đó không loại trừ
 * nhau, nhốt chung một trường thì cán bộ phải chọn một và bỏ thông tin còn lại.
 *
 * KHÔNG LƯU CỜ CHẬM TIẾN ĐỘ. Cờ lưu sẵn là cờ cũ: hôm nay đúng tiến độ, sang
 * quý sau thành chậm mà không ai ghi gì thì cờ vẫn nói đúng tiến độ. Tình trạng
 * tiến độ được tính lại mỗi lần đọc từ kế hoạch quý và ngày hiện tại.
 */

/* ─────────────────────────── Danh mục trạng thái ─────────────────────────── */

/**
 * Trạng thái hồ sơ của hạng mục — do NGƯỜI quyết, không suy ra được.
 *
 * Vòng đời:
 *   nhap ──trình──> cho-duyet ──duyệt──> da-duyet ──chốt năm──> quyet-toan
 *                       └──từ chối──> nhap
 *   da-duyet ──> tam-dung ──> da-duyet
 *   mọi trạng thái chưa quyết toán ──> huy
 */
export const BUDGET_APPROVAL_STATUSES = [
  'nhap',
  'cho-duyet',
  'da-duyet',
  'tu-choi',
  'tam-dung',
  'huy',
  'quyet-toan',
] as const;
export type BudgetApprovalStatus = (typeof BUDGET_APPROVAL_STATUSES)[number];

/** Nhãn tiếng Việt — nguồn chuẩn, admin-web đọc qua API để không khai bản sao */
export const BUDGET_APPROVAL_LABELS: Record<BudgetApprovalStatus, string> = {
  nhap: 'Nháp',
  'cho-duyet': 'Chờ duyệt',
  'da-duyet': 'Đã phê duyệt',
  'tu-choi': 'Bị từ chối',
  'tam-dung': 'Tạm dừng',
  huy: 'Đã huỷ',
  'quyet-toan': 'Đã quyết toán',
};

/** Mức giải ngân — SUY RA từ số tiền, không lưu trong CSDL */
export const DISBURSEMENT_STATES = ['chua-chi', 'mot-phan', 'du'] as const;
export type DisbursementState = (typeof DISBURSEMENT_STATES)[number];

export const DISBURSEMENT_STATE_LABELS: Record<DisbursementState, string> = {
  'chua-chi': 'Chưa giải ngân',
  'mot-phan': 'Đã giải ngân một phần',
  du: 'Đã giải ngân đủ',
};

/** Tình trạng tiến độ — SUY RA từ kế hoạch quý và ngày hiện tại, không lưu */
export const SCHEDULE_STATES = [
  'chua-den-han',
  'dung-tien-do',
  'nguy-co-cham',
  'cham',
  'hoan-thanh',
] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export const SCHEDULE_STATE_LABELS: Record<ScheduleState, string> = {
  'chua-den-han': 'Chưa đến kỳ',
  'dung-tien-do': 'Đúng tiến độ',
  'nguy-co-cham': 'Có nguy cơ chậm',
  cham: 'Chậm tiến độ',
  'hoan-thanh': 'Hoàn thành',
};

/**
 * Loại giao dịch. Số tiền LUÔN DƯƠNG, dấu do loại quyết định.
 *
 * `hoan-tra` là nghiệp vụ có thật: chi sai phải thu hồi, nhà thầu trả lại phần
 * chưa dùng. Không có loại này thì luỹ kế đã chi không sửa được, và cách duy
 * nhất để chữa là xoá cứng chứng từ — đúng thứ `bao-toan-du-lieu.md` cấm.
 */
export const DISBURSEMENT_ENTRY_TYPES = ['chi', 'hoan-tra'] as const;
export type DisbursementEntryType = (typeof DISBURSEMENT_ENTRY_TYPES)[number];

export const DISBURSEMENT_ENTRY_TYPE_LABELS: Record<DisbursementEntryType, string> = {
  chi: 'Chi trả',
  'hoan-tra': 'Hoàn trả / thu hồi',
};

/**
 * Trạng thái một đề nghị giải ngân. Vòng đời một cấp duyệt:
 *
 *   pending ──duyệt──> approved ──ghi nhận đã chi──> disbursed
 *      └────từ chối (bắt buộc nêu lý do)────> rejected
 *
 * `approved` và `disbursed` tách nhau vì duyệt và chi là hai thời điểm khác
 * nhau ngoài đời: lãnh đạo ký duyệt hôm nay, kho bạc chuyển tiền vài ngày sau.
 * Chỉ khi chuyển sang `disbursed` mới sinh một giao dịch cộng vào luỹ kế đã chi
 * — cộng ngay lúc duyệt sẽ khiến báo cáo nói đã chi trong khi tiền chưa ra.
 */
export const DISBURSEMENT_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'disbursed',
] as const;
export type DisbursementRequestStatus = (typeof DISBURSEMENT_REQUEST_STATUSES)[number];

/** Loại đối tượng thụ hưởng — quyết định cách xử lý dữ liệu cá nhân */
export const BENEFICIARY_TYPES = ['to-chuc', 'ca-nhan', 'khong-xac-dinh'] as const;
export type BeneficiaryType = (typeof BENEFICIARY_TYPES)[number];

export const BENEFICIARY_TYPE_LABELS: Record<BeneficiaryType, string> = {
  'to-chuc': 'Tổ chức / doanh nghiệp',
  'ca-nhan': 'Cá nhân',
  'khong-xac-dinh': 'Chưa xác định',
};

/* ─────────────────────────── Thành phần lồng nhau ─────────────────────────── */

/**
 * Kế hoạch giải ngân một quý.
 *
 * VÌ SAO THEO QUÝ, KHÔNG THEO THÁNG: cấp xã lập và báo cáo ngân sách theo quý;
 * bắt nhập 12 ô mỗi hạng mục là công việc thật mà không ai dùng tới. Cần theo
 * tháng thì thêm mảng tương tự, không phải đổi mô hình.
 */
@Schema({ _id: false })
export class QuarterPlan {
  /** 1..4 */
  @Prop({ required: true, min: 1, max: 4 }) quarter: number;

  /** Kế hoạch giải ngân của quý — đồng, số nguyên */
  @Prop({ required: true, default: 0 }) amountDong: number;
}
export const QuarterPlanSchema = SchemaFactory.createForClass(QuarterPlan);

/** Một giao dịch chi trả hoặc hoàn trả đã phát sinh */
@Schema({ _id: false })
export class DisbursementEntry {
  /** dd/MM/yyyy — ngày trên chứng từ */
  @Prop({ required: true }) date: string;

  @Prop({ required: true, enum: DISBURSEMENT_ENTRY_TYPES, default: 'chi' })
  type: DisbursementEntryType;

  /** Số tiền — đồng, số nguyên, LUÔN DƯƠNG. Dấu do `type` quyết định */
  @Prop({ required: true }) amountDong: number;

  @Prop({ required: true }) content: string;

  /** Số chứng từ kế toán — chỗ đối chiếu với sổ kế toán */
  @Prop({ default: '' }) voucherNo: string;

  /** Đơn vị thụ hưởng / nhà thầu nhận tiền */
  @Prop({ default: '' }) vendor: string;

  /** Mã số thuế đơn vị thụ hưởng; để trống với cá nhân — xem chú thích BudgetItem */
  @Prop({ default: '' }) vendorTaxCode: string;

  /** Tệp chứng từ trong kho tệp dùng chung (luôn là tệp riêng tư) */
  @Prop({ type: [String], default: [] }) fileIds: string[];

  /** Cán bộ nhập — tên hiển thị */
  @Prop({ default: '' }) by: string;

  /** Mã đề nghị sinh ra giao dịch này, rỗng nếu nhập trực tiếp */
  @Prop({ default: '' }) requestCode: string;

  @Prop({ default: () => new Date() }) recordedAt: Date;
}
export const DisbursementEntrySchema = SchemaFactory.createForClass(DisbursementEntry);

/**
 * Một lần điều chỉnh dự toán.
 *
 * VÌ SAO KHÔNG SỬA ĐÈ `plannedAmount`: điều chỉnh dự toán luôn có căn cứ là một
 * quyết định hành chính. Sửa đè con số là mất căn cứ, và cuối năm không giải
 * trình được vì sao kế hoạch vốn khác quyết định giao đầu năm. Kế hoạch vốn
 * hiện hành = dự toán đầu năm + tổng các lần điều chỉnh.
 */
@Schema({ _id: false })
export class BudgetAdjustment {
  /** Số quyết định điều chỉnh — căn cứ bắt buộc */
  @Prop({ required: true }) decisionNo: string;

  /** dd/MM/yyyy — ngày quyết định */
  @Prop({ required: true }) decidedAt: string;

  /**
   * Mức điều chỉnh — đồng, số nguyên. ÂM là giảm dự toán.
   * Đây là trường duy nhất trong phân hệ được phép mang giá trị âm.
   */
  @Prop({ required: true }) deltaDong: number;

  @Prop({ required: true }) reason: string;

  @Prop({ type: [String], default: [] }) fileIds: string[];

  @Prop({ default: '' }) by: string;
  @Prop({ default: () => new Date() }) recordedAt: Date;
}
export const BudgetAdjustmentSchema = SchemaFactory.createForClass(BudgetAdjustment);

/** Một văn bản / hồ sơ gắn với hạng mục */
@Schema({ _id: false })
export class BudgetDocument {
  /** Số, ký hiệu văn bản */
  @Prop({ default: '' }) refNo: string;

  /** Loại văn bản — danh mục cấu hình được */
  @Prop({ default: '' }) docType: string;

  /** dd/MM/yyyy */
  @Prop({ default: '' }) issuedDate: string;

  /** Cơ quan ban hành — dùng chung danh mục với phân hệ Văn bản */
  @Prop({ default: '' }) issuer: string;

  @Prop({ default: '' }) summary: string;

  /** Tệp trong kho tệp dùng chung; bắt buộc là tệp riêng tư */
  @Prop({ required: true }) fileId: string;

  @Prop({ default: '' }) addedBy: string;
  @Prop({ default: () => new Date() }) addedAt: Date;
}
export const BudgetDocumentSchema = SchemaFactory.createForClass(BudgetDocument);

/**
 * Một mốc trong lịch sử tiến độ — CHỈ THÊM, không sửa, không xoá.
 *
 * Khác với `audit_logs` (hạ tầng, ghi mọi request ghi): đây là lịch sử NGHIỆP VỤ
 * hiển thị cho cán bộ ngay trên hồ sơ hạng mục, có kèm số liệu tại thời điểm đó
 * để giải trình được "lúc ấy báo cáo là bao nhiêu".
 */
@Schema({ _id: false })
export class BudgetProgressLog {
  @Prop({ default: () => new Date() }) at: Date;
  @Prop({ default: '' }) by: string;

  /** Hành động: đổi trạng thái, ghi nhận chi, điều chỉnh dự toán… */
  @Prop({ required: true }) action: string;

  @Prop({ default: '' }) fromStatus: string;
  @Prop({ default: '' }) toStatus: string;

  /** Kế hoạch vốn và luỹ kế đã chi TẠI THỜI ĐIỂM ghi — đồng */
  @Prop({ default: 0 }) plannedDong: number;
  @Prop({ default: 0 }) actualDong: number;

  @Prop({ default: '' }) note: string;

  /** Lý do chậm — bắt buộc khi cán bộ ghi nhận hạng mục chậm tiến độ */
  @Prop({ default: '' }) lateReason: string;
}
export const BudgetProgressLogSchema = SchemaFactory.createForClass(BudgetProgressLog);

/** Vướng mắc cần tháo gỡ */
@Schema({ _id: false })
export class Obstacle {
  @Prop({ required: true }) content: string;
  @Prop({ default: '' }) owner: string;
  @Prop({ default: '' }) deadline: string;
}
export const ObstacleSchema = SchemaFactory.createForClass(Obstacle);

/** Đề nghị giải ngân một đợt của hạng mục */
@Schema({ _id: false })
export class DisbursementRequest {
  /** Mã đề nghị trong phạm vi hạng mục: DN-01, DN-02… */
  @Prop({ required: true }) code: string;

  /** Số tiền đề nghị — đồng, số nguyên */
  @Prop({ required: true }) amountDong: number;

  @Prop({ required: true }) content: string;
  @Prop({ default: '' }) vendor: string;
  @Prop({ default: '' }) vendorTaxCode: string;

  @Prop({ enum: DISBURSEMENT_REQUEST_STATUSES, default: 'pending', index: true })
  status: DisbursementRequestStatus;

  @Prop({ default: '' }) requestedBy: string;
  @Prop({ default: '' }) requestedAt: string;

  /** Người duyệt hoặc từ chối; rỗng khi còn chờ duyệt */
  @Prop({ default: '' }) decidedBy: string;
  @Prop({ default: '' }) decidedAt: string;

  /** Lý do từ chối — bắt buộc khi status = rejected */
  @Prop({ default: '' }) rejectReason: string;

  /** Số chứng từ lúc ghi nhận đã chi thật */
  @Prop({ default: '' }) voucherNo: string;
  @Prop({ default: '' }) disbursedAt: string;

  /** Hồ sơ kèm đề nghị */
  @Prop({ type: [String], default: [] }) fileIds: string[];
}
export const DisbursementRequestSchema = SchemaFactory.createForClass(DisbursementRequest);

/**
 * Mục lục ngân sách nhà nước — Chương / Loại / Khoản / Mục / Tiểu mục.
 *
 * TẤT CẢ ĐỀU TUỲ CHỌN. Cấp xã trong thực tế chủ yếu dùng Mục và Tiểu mục; bắt
 * nhập đủ 5 cấp bằng tay là rất nhiều công và dễ sai. Bắt buộc tới cấp nào là
 * quyết định của từng địa phương → để cấu hình quyết, không chặn ở schema.
 */
@Schema({ _id: false })
export class BudgetLine {
  @Prop({ default: '' }) chapter: string;
  @Prop({ default: '' }) category: string;
  @Prop({ default: '' }) subCategory: string;
  @Prop({ default: '' }) item: string;
  @Prop({ default: '' }) subItem: string;
}
export const BudgetLineSchema = SchemaFactory.createForClass(BudgetLine);

/* ───────────────────────────── Hạng mục ngân sách ───────────────────────────── */

/**
 * Hạng mục ngân sách / giải ngân.
 *
 * Kế thừa `SoftDeletable`: hạng mục đã phát sinh chứng từ là số liệu quyết toán
 * ngân sách — xoá cứng là mất dấu tiền đã giải ngân. Bản ghi đã xoá bị loại
 * khỏi danh sách VÀ khỏi mọi số liệu tổng hợp, nhưng vẫn nguyên trong CSDL.
 *
 * DỮ LIỆU CÁ NHÂN: phân hệ này KHÔNG lưu số căn cước và số tài khoản của đối
 * tượng thụ hưởng. Với cá nhân (chi hỗ trợ, trợ cấp) hai thứ đó là dữ liệu cá
 * nhân theo NĐ 13/2023, cần cơ sở pháp lý và cơ chế che riêng; đồng thời việc
 * chuyển tiền thuộc kế toán — họ đã có thông tin đó trong hệ thống của mình.
 * Ở đây chỉ lưu TÊN đối tượng và mã số thuế (dành cho tổ chức).
 * → Câu hỏi mở: khách có yêu cầu lưu thêm thì phải chốt mục đích và ai được xem.
 */
@Schema({ collection: 'budget_items', timestamps: true })
export class BudgetItem extends SoftDeletable {
  @Prop({ required: true, unique: true, index: true }) code: string;
  @Prop({ required: true }) name: string;

  /** Nội dung / mục đích chi */
  @Prop({ default: '' }) purpose: string;

  /** Loại chi — danh mục cấu hình được (chi thường xuyên, đầu tư công…) */
  @Prop({ default: '', index: true }) expenseType: string;

  /** Cấp ngân sách — danh mục cấu hình được (xã, huyện, tỉnh, trung ương) */
  @Prop({ default: '' }) budgetLevel: string;

  @Prop({ required: true }) fundingSource: string;
  @Prop({ default: 'var(--blue)' }) fundingColor: string;

  /** Dự án / chương trình / nhiệm vụ, nếu hạng mục thuộc một cái nào */
  @Prop({ default: '', index: true }) program: string;

  @Prop({ type: BudgetLineSchema, default: () => ({}) }) budgetLine: BudgetLine;

  /** Đơn vị / bộ phận thực hiện */
  @Prop({ required: true, index: true }) owner: string;

  /** Đối tượng thụ hưởng chính — tên; xem chú thích dữ liệu cá nhân ở trên */
  @Prop({ default: '' }) beneficiary: string;
  @Prop({ default: 'khong-xac-dinh', enum: BENEFICIARY_TYPES }) beneficiaryType: string;
  @Prop({ default: '' }) beneficiaryTaxCode: string;

  /** Năm ngân sách */
  @Prop({ required: true, index: true }) year: number;

  /** Năm được chuyển nguồn sang, nếu hạng mục là vốn chuyển nguồn */
  @Prop({ default: 0 }) carryOverFromYear: number;

  /** dd/MM/yyyy — mốc kế hoạch */
  @Prop({ default: '' }) startDate: string;
  @Prop({ default: '' }) endDate: string;

  /**
   * Dự toán giao ĐẦU NĂM — đồng, số nguyên. Không đổi sau khi giao.
   * Muốn đổi thì thêm một bản ghi vào `adjustments`.
   */
  @Prop({ default: 0 }) initialPlannedDong: number;

  /**
   * Kế hoạch vốn HIỆN HÀNH = `initialPlannedDong` + tổng `adjustments`.
   *
   * Lưu lại (thay vì luôn tính) để truy vấn và sắp xếp theo số tiền được; service
   * tính lại giá trị này ở MỌI đường ghi nên nó không bao giờ lệch khỏi lịch sử.
   */
  @Prop({ default: 0, index: true }) plannedDong: number;

  /**
   * Luỹ kế đã giải ngân = tổng giao dịch `chi` − tổng giao dịch `hoan-tra`.
   * Cũng được tính lại ở mọi đường ghi từ `entries`.
   */
  @Prop({ default: 0 }) actualDong: number;

  /** Kế hoạch giải ngân theo quý — tối đa 4 phần tử */
  @Prop({ type: [QuarterPlanSchema], default: [] }) quarterPlans: QuarterPlan[];

  @Prop({ enum: BUDGET_APPROVAL_STATUSES, default: 'nhap', index: true })
  approvalStatus: BudgetApprovalStatus;

  /** Lý do từ chối / tạm dừng / huỷ gần nhất — hiển thị ngay trên hồ sơ */
  @Prop({ default: '' }) statusNote: string;

  @Prop({ type: [DisbursementEntrySchema], default: [] }) entries: DisbursementEntry[];
  @Prop({ type: [BudgetAdjustmentSchema], default: [] }) adjustments: BudgetAdjustment[];
  @Prop({ type: [BudgetDocumentSchema], default: [] }) documents: BudgetDocument[];
  @Prop({ type: [BudgetProgressLogSchema], default: [] }) progressLogs: BudgetProgressLog[];
  @Prop({ type: [CommentSchema], default: [] }) comments: Comment[];
  @Prop({ type: [ObstacleSchema], default: [] }) obstacles: Obstacle[];
  @Prop({ type: [DisbursementRequestSchema], default: [] }) requests: DisbursementRequest[];
}
export const BudgetItemSchema = SchemaFactory.createForClass(BudgetItem);
