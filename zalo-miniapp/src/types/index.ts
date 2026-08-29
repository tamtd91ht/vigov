/** ===== Model nghiệp vụ — đồng bộ tên field với app Flutter và schema backend P3 ===== */

/** Bước trong timeline xử lý / luân chuyển */
export interface TimelineStep {
  title: string;
  meta: string;
  current?: boolean;
}

export type TicketStatus = "received" | "processing" | "resolved";

/** Phiếu phản ánh của công dân */
export interface FeedbackTicket {
  code: string;
  categoryKey: string;
  title: string;
  description: string;
  location: string;
  sentAt: string;
  status: TicketStatus;
  /** Giờ còn lại theo SLA; âm = quá hạn; bỏ qua khi đã xử lý */
  slaHoursLeft: number;
  /** Ảnh hiện trường — Phase 1 mock bằng màu placeholder */
  imageColors: string[];
  timeline: TimelineStep[];
  rating: number;
  ratingComment?: string;
}

export type ArticleType = "news" | "event" | "notice";

/** Bài viết từ CMS (đồng bộ CmsArticle của admin-web) */
export interface Article {
  id: string;
  type: ArticleType;
  title: string;
  category: string;
  excerpt: string;
  /** Nội dung thuần — các đoạn cách nhau bằng \n\n */
  content: string;
  coverColor: string;
  publishedAt: string;
  views: number;
}

/** Video tuyên truyền */
export interface VideoItem {
  id: string;
  title: string;
  topic: string;
  duration: string;
  views: number;
  publishedAt: string;
  coverColor: string;
  description: string;
}

/** Bản tin truyền thanh */
export interface RadioBulletin {
  id: string;
  title: string;
  category: string;
  /** dd/MM/yyyy — dùng nhóm danh sách theo ngày */
  date: string;
  durationSeconds: number;
  plays: number;
}

/** Kết quả tra cứu hồ sơ một cửa */
export interface DossierResult {
  code: string;
  procedure: string;
  applicant: string;
  statusLabel: string;
  officer: string;
  /** 1-based, 1..steps.length */
  currentStep: number;
  steps: string[];
  submittedAt: string;
  expectedAt: string;
}

export type ContactGroup = "leader" | "department";

/** Liên hệ danh bạ chính quyền */
export interface GovContact {
  name: string;
  title: string;
  department: string;
  phone: string;
  group: ContactGroup;
}

/** Phiên định danh công dân */
export interface CitizenSession {
  phone: string;
  displayName: string;
  identifiedAt: string;
  /** Địa bàn cư trú backend trả về; trống khi hồ sơ chưa khai báo */
  area?: string;
  /** JWT gọi API — nhánh demo offline (useMocks) không có token */
  accessToken?: string;
}
