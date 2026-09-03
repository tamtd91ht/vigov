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

/** Một lớp dữ liệu bật/tắt trên bản đồ kinh tế (doanh nghiệp, chợ, y tế…) */
export interface MapLayer {
  /** Khoá tự nhiên, nối ghim với lớp — khớp MapLayer.key của backend */
  key: string;
  label: string;
  color: string;
  /** Lớp có bật sẵn khi mở màn bản đồ hay không */
  defaultOn: boolean;
  count: number;
}

/**
 * Một ghim cơ sở trên bản đồ kinh tế.
 *
 * KHÔNG có họ tên đại diện và số điện thoại chủ cơ sở: endpoint công khai
 * (/map/public/economy) đã lược bỏ vì đó là dữ liệu cá nhân theo NĐ 13/2023.
 */
export interface MapPin {
  id: string;
  layerKey: string;
  name: string;
  industry: string;
  address: string;
  /** Số lao động; 0 với công trình chưa vận hành */
  workers: number;
  /** Toạ độ % trong khung bản đồ mô phỏng — dùng cho adapter "mock" */
  x: number;
  y: number;
  /** Toạ độ địa lý thật, để dành cho adapter bản đồ provider thật */
  lat?: number;
  lng?: number;
}

/** Dữ liệu một lần gọi của màn Bản đồ kinh tế */
export interface EconomyMap {
  layers: MapLayer[];
  pins: MapPin[];
}
