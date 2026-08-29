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
}

/** Lần giải ngân của một hạng mục */
export interface DisbursementEntry {
  date: string;
  content: string;
  amount: string;
  vendor: string;
  by: string;
  voucherNo: string;
}

/** Vướng mắc cần tháo gỡ */
export interface Obstacle {
  content: string;
  owner: string;
  deadline: string;
}

/** Hạng mục ngân sách / giải ngân */
export interface BudgetItem {
  id: string;
  name: string;
  fundingSource: string;
  fundingColor: string;
  owner: string;
  planned: number; // tỷ đồng
  actual: number; // tỷ đồng
  delayed: boolean;
  entries: DisbursementEntry[];
  comments: Comment[];
  obstacles: Obstacle[];
}

/** Phiếu phản ánh của người dân */
export interface CitizenFeedback {
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
}

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
