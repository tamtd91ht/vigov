/** ===== Kiểu dữ liệu nghiệp vụ dùng chung — khớp schema backend P3 ===== */

/** Cán bộ, công chức */
export interface Staff {
  name: string;
  initials: string;
  color: string;
  department: string;
  title: string;
}

/** Mục timeline (nhật ký luân chuyển / xử lý) */
export interface TimelineItem {
  title: string;
  meta: string;
  state: "ok" | "cur";
}

/** Bình luận trao đổi */
export interface Comment {
  authorName: string;
  authorInitials: string;
  authorColor: string;
  time: string;
  content: string;
}

/** Việc con trong checklist nhiệm vụ */
export interface ChecklistItem {
  title: string;
  done: boolean;
}

/** Nhiệm vụ (Quản lý công việc) */
export interface Task {
  id: string;
  title: string;
  sourceLabel: string;
  sourceType: "vb" | "pa" | "hop";
  assignee: string;
  department: string;
  deadline: string;
  progress: number;
  status: "moi" | "dang" | "cho" | "qua" | "xong";
  priority: "cao" | "tb" | "thap";
  assigner: string;
  collaborators: string[];
  description: string;
  checklist: ChecklistItem[];
  /** Cờ xoá mềm — trường dùng để lọc; bản ghi cũ có thể chưa có trường này */
  isDeleted?: boolean;
  /** Mốc thời gian xoá, chỉ để hiển thị ở bộ lọc "Đã xoá" — không dùng để lọc */
  deletedAt?: string;
  /** Tên đăng nhập cán bộ đã xoá */
  deletedBy?: string;
  deleteReason?: string;
}

/** Văn bản đến / Đơn thư */
export interface IncomingDocument {
  arrivalNo: string;
  refNo: string;
  date: string;
  sender: string;
  summary: string;
  deadline: string;
  daysLeft: number;
  department: string;
  status: "moi" | "dangxl" | "choduyet" | "xong";
  docType: string;
  confidentiality: string;
  urgency: string;
  signer: string;
  pageCount: number;
  timeline: TimelineItem[];
  /** Cờ xoá mềm — trường dùng để lọc; bản ghi cũ có thể chưa có trường này */
  isDeleted?: boolean;
  /** Mốc thời gian xoá, chỉ để hiển thị ở bộ lọc "Đã xoá" — không dùng để lọc */
  deletedAt?: string;
  /** Tên đăng nhập cán bộ đã xoá */
  deletedBy?: string;
  deleteReason?: string;
}

/** Lần giải ngân của một hạng mục */
export type DisbursementEntryType = "chi" | "hoan-tra";

export interface DisbursementEntry {
  /** dd/MM/yyyy — ngày trên chứng từ */
  date: string;
  /** `hoan-tra` TRỪ khỏi luỹ kế; số tiền luôn dương, dấu do loại quyết định */
  type: DisbursementEntryType;
  /** Số tiền — ĐỒNG, số nguyên */
  amountDong: number;
  content: string;
  voucherNo: string;
  vendor: string;
  vendorTaxCode?: string;
  /** Tệp chứng từ trong kho tệp dùng chung */
  fileIds?: string[];
  by: string;
  /** Mã đề nghị sinh ra giao dịch này; rỗng nếu nhập trực tiếp */
  requestCode?: string;
}

/** Một lần điều chỉnh dự toán — đường duy nhất đổi kế hoạch vốn */
export interface BudgetAdjustment {
  /** Số quyết định điều chỉnh — căn cứ bắt buộc */
  decisionNo: string;
  /** dd/MM/yyyy */
  decidedAt: string;
  /** ĐỒNG, số nguyên. ÂM là giảm dự toán */
  deltaDong: number;
  reason: string;
  fileIds?: string[];
  by: string;
}

/** Một văn bản / hồ sơ gắn với hạng mục */
export interface BudgetDocumentRef {
  refNo: string;
  docType: string;
  issuedDate: string;
  issuer: string;
  summary: string;
  fileId: string;
  addedBy: string;
}

/** Một mốc trong lịch sử tiến độ — chỉ thêm, không sửa, không xoá */
export interface BudgetProgressLog {
  at: string;
  by: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  /** Kế hoạch vốn và luỹ kế TẠI THỜI ĐIỂM ghi — đồng */
  plannedDong: number;
  actualDong: number;
  note: string;
  lateReason: string;
}

/** Kế hoạch giải ngân một quý */
export interface QuarterPlan {
  /** 1..4 */
  quarter: number;
  /** ĐỒNG, số nguyên */
  amountDong: number;
}

/** Vướng mắc cần tháo gỡ */
export interface Obstacle {
  content: string;
  owner: string;
  deadline: string;
}

/**
 * Trạng thái một đề nghị giải ngân — luồng một cấp duyệt:
 * `pending` → `approved` → `disbursed`, hoặc `pending` → `rejected`.
 * Chỉ khi sang `disbursed` tiền mới cộng vào luỹ kế của hạng mục.
 */
export type DisbursementRequestStatus = "pending" | "approved" | "rejected" | "disbursed";

/** Đề nghị giải ngân một đợt của hạng mục */
export interface DisbursementRequest {
  /** Mã đề nghị trong phạm vi hạng mục: DN-01, DN-02… */
  code: string;
  /** Số tiền đề nghị — ĐỒNG, số nguyên */
  amountDong: number;
  content: string;
  vendor: string;
  vendorTaxCode?: string;
  status: DisbursementRequestStatus;
  requestedBy: string;
  requestedAt: string;
  /** Người duyệt/từ chối; rỗng khi còn chờ duyệt */
  decidedBy: string;
  decidedAt: string;
  /** Lý do từ chối — chỉ có khi status = rejected */
  rejectReason: string;
  /** Số chứng từ lúc ghi nhận đã chi */
  voucherNo: string;
  disbursedAt: string;
  fileIds?: string[];
}

/** Hạng mục ngân sách / giải ngân */
/** Trạng thái hồ sơ hạng mục — do NGƯỜI quyết, có workflow và quyền */
export type BudgetApprovalStatus =
  | "nhap"
  | "cho-duyet"
  | "da-duyet"
  | "tu-choi"
  | "tam-dung"
  | "huy"
  | "quyet-toan";

/** Mức giải ngân — máy chủ SUY RA từ số tiền, giao diện không tự tính */
export type DisbursementState = "chua-chi" | "mot-phan" | "du";

/** Tình trạng tiến độ — máy chủ SUY RA từ kế hoạch quý và ngày hiện tại */
export type ScheduleState =
  | "chua-den-han"
  | "dung-tien-do"
  | "nguy-co-cham"
  | "cham"
  | "hoan-thanh";

export type BeneficiaryType = "to-chuc" | "ca-nhan" | "khong-xac-dinh";

/**
 * Hạng mục ngân sách / giải ngân.
 *
 * MỌI TRƯỜNG TIỀN LÀ SỐ NGUYÊN ĐƠN VỊ ĐỒNG (`*Dong`). Xem `lib/money.ts`.
 *
 * Phần TÍNH TOÁN (`remainingDong`, `percent`, `disbursementState`,
 * `scheduleState`, `daysLeft`, các nhãn) do MÁY CHỦ trả về, giao diện chỉ hiển
 * thị lại — tính ở hai nơi là sớm muộn lệch nhau.
 */
export interface BudgetItem {
  id: string;
  code?: string;
  name: string;
  purpose?: string;
  expenseType?: string;
  budgetLevel?: string;
  fundingSource: string;
  fundingColor: string;
  program?: string;
  owner: string;
  beneficiary?: string;
  beneficiaryType?: BeneficiaryType;
  beneficiaryTaxCode?: string;
  year?: number;
  carryOverFromYear?: number;
  /** dd/MM/yyyy */
  startDate?: string;
  endDate?: string;

  /** Dự toán giao đầu năm — đồng. Đổi phải qua điều chỉnh dự toán */
  initialPlannedDong: number;
  /** Kế hoạch vốn hiện hành = dự toán đầu năm + tổng điều chỉnh — đồng */
  plannedDong: number;
  /** Luỹ kế đã giải ngân = tổng chi − tổng hoàn trả — đồng */
  actualDong: number;
  quarterPlans?: QuarterPlan[];

  approvalStatus: BudgetApprovalStatus;
  statusNote?: string;

  /* ── Phần máy chủ tính, chỉ để hiển thị ── */
  remainingDong?: number;
  /** `null` = chưa có kế hoạch vốn, KHÁC "giải ngân 0%" */
  percent?: number | null;
  planCumulativeDong?: number;
  planExpectedDong?: number;
  /** Số ngày tới hạn; âm là quá hạn; `null` là chưa đặt hạn */
  daysLeft?: number | null;
  disbursementState?: DisbursementState;
  scheduleState?: ScheduleState;
  approvalLabel?: string;
  disbursementLabel?: string;
  scheduleLabel?: string;

  entries: DisbursementEntry[];
  adjustments?: BudgetAdjustment[];
  documents?: BudgetDocumentRef[];
  progressLogs?: BudgetProgressLog[];
  comments: Comment[];
  obstacles: Obstacle[];
  requests: DisbursementRequest[];
  /** Cờ xoá mềm — trường dùng để lọc; bản ghi cũ có thể chưa có trường này */
  isDeleted?: boolean;
  /** Mốc thời gian xoá, chỉ để hiển thị ở bộ lọc "Đã xoá" — không dùng để lọc */
  deletedAt?: string;
  /** Tên đăng nhập cán bộ đã xoá */
  deletedBy?: string;
  deleteReason?: string;
}

/** Phiếu phản ánh của người dân */
export interface CitizenFeedback {
  /**
   * `_id` của bản ghi trong CSDL — BẮT BUỘC khi gọi /workflow/feedback-to-task
   * (backend nhận mã Mongo, không nhận mã phiếu PA-xxxx). Chỉ có ở dữ liệu thật;
   * dữ liệu mẫu không có nên khai tuỳ chọn.
   */
  id?: string;
  code: string;
  categoryLabel: string;
  title: string;
  excerpt: string;
  location: string;
  /**
   * Toạ độ GPS người dân gửi kèm khi tạo phản ánh.
   * Bản đồ mô phỏng chiếu cặp này ra phần trăm bằng `latLngToPin`
   * (`config/map.config.ts`); vắng toạ độ thì ghim về vị trí mặc định.
   */
  lat?: number;
  lng?: number;
  /** Giờ còn lại theo SLA; âm = quá hạn; 0 khi đã xử lý */
  slaHoursLeft: number;
  status: "Mới tiếp nhận" | "Đang xử lý" | "Đã xử lý";
  rating: number;
  ratingComment?: string;
  senderName: string;
  senderPhone: string;
  sentAt: string;
  assignee: string;
  department: string;
  timeline: TimelineItem[];
  /** Ảnh hiện trường người dân gửi kèm (mã tệp trong kho tệp dùng chung) */
  imageFileIds?: string[];
  /** Ảnh nghiệm thu cán bộ tải lên khi xác nhận đã xử lý */
  resultImageFileIds?: string[];
  /** Mã nhiệm vụ đã sinh ra từ phiếu này (nếu đã bấm "Chuyển thành công việc") */
  linkedTaskCode?: string;

  /**
   * Trạng thái yêu cầu THU HỒI do người dân gửi từ Zalo Mini App.
   * `pending` = đang chờ cán bộ xác nhận; xem `FeedbackDrawer`.
   */
  withdrawStatus?: WithdrawStatus;
  /** Lý do người dân nêu khi xin thu hồi */
  withdrawReason?: string;
  /** Lúc người dân gửi yêu cầu (chuỗi ISO) */
  withdrawRequestedAt?: string;
  /** Lý do cán bộ nêu khi từ chối — người dân đọc được trên Mini App */
  withdrawDecisionNote?: string;
}

/** Trạng thái yêu cầu thu hồi phiếu — khớp WITHDRAW_STATUSES của backend */
export type WithdrawStatus = "none" | "pending" | "approved" | "rejected";

/** Lớp bản đồ kinh tế số */
export interface MapLayer {
  id: string;
  label: string;
  count: number;
  color: string;
  defaultOn: boolean;
}

/** Ghim trên bản đồ */
export interface MapPin {
  layerId: string;
  /** Toạ độ chuẩn hoá % trong khung (provider thật sẽ dùng lat/lng) */
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  name: string;
  industry: string;
  address: string;
  workers: number;
  representative: string;
  phone: string;
}

/** Bài viết CMS (tin tức / sự kiện / thông báo) */
export interface CmsArticle {
  id: string;
  type: "news" | "event" | "notice";
  title: string;
  category: string;
  excerpt: string;
  content: string;
  coverColor: string;
  /** Mã tệp ảnh bìa trong kho tệp dùng chung; rỗng thì hiển thị nền màu */
  coverFileId?: string;
  status: "draft" | "published";
  publishedAt: string;
  author: string;
  views: number;
}

/** Video tuyên truyền */
export interface CmsVideo {
  id: string;
  title: string;
  topic: string;
  duration: string;
  views: number;
  source: "youtube" | "hosted";
  /** Mã tệp video khi source = "hosted" */
  videoFileId?: string;
  /** Đường dẫn nhúng khi source = "youtube" */
  youtubeUrl?: string;
  publishedAt: string;
  status: "draft" | "published";
}

/** Bản tin truyền thanh */
export interface RadioBulletin {
  id: string;
  title: string;
  category: string;
  date: string;
  duration: string;
  plays: number;
  /** Mã tệp âm thanh trong kho tệp dùng chung */
  audioFileId?: string;
  status: "draft" | "published";
}

/** Lượt gửi broadcast */
export interface BroadcastLog {
  id: string;
  channel: "zns" | "push";
  audience: "citizen" | "internal";
  title: string;
  sentAt: string;
  sentBy: string;
  total: number;
  delivered: number;
  status: "sent" | "sending" | "failed";
}

/** Công dân dùng Mini App */
export interface CitizenUser {
  id: string;
  zaloName: string;
  phoneMasked: string;
  area: string;
  feedbackCount: number;
  registeredAt: string;
  status: "active" | "locked";
  lockReason?: string;
  /** Cờ xoá mềm — trường dùng để lọc; bản ghi cũ có thể chưa có trường này */
  isDeleted?: boolean;
  /** Mốc thời gian xoá, chỉ để hiển thị ở bộ lọc "Đã xoá" — không dùng để lọc */
  deletedAt?: string;
  /** Tên đăng nhập cán bộ đã xoá */
  deletedBy?: string;
  deleteReason?: string;
}

/** Phiên đăng nhập */
export interface LoginSession {
  id: string;
  userName: string;
  kind: "web" | "miniapp";
  device: string;
  ip: string;
  startedAt: string;
  lastActiveAt: string;
  current?: boolean;
}

/** Bản ghi blacklist */
export interface BlacklistRecord {
  id: string;
  subject: string;
  kind: "citizen" | "device" | "ip";
  reason: string;
  by: string;
  at: string;
  active: boolean;
}

/** Người dùng nội bộ (trang Cấu hình) */
export interface InternalUser {
  name: string;
  initials: string;
  color: string;
  department: string;
  roleLabel: string;
  username: string;
  status: string;
  lastLogin: string;
}

/** Node sơ đồ tổ chức */
export interface OrgNode {
  name: string;
  subtitle: string;
  color: string;
  children?: OrgNode[];
}
