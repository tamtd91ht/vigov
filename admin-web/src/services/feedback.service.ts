import { appConfig } from "@/config/app.config";
import { findCategory } from "@/config/sla.config";
import { feedbackList, UNASSIGNED } from "@/mocks/feedback";
import type { CitizenFeedback, TimelineItem } from "@/types";
import { apiClient, buildQuery, type Paged } from "./api";

/**
 * Phân hệ Phản ánh người dân (WBS #6).
 *
 * Nơi duy nhất ánh xạ dữ liệu backend ↔ kiểu `CitizenFeedback` của giao diện:
 * backend lưu `categoryKey` + trạng thái tiếng Anh, giao diện dùng nhãn lĩnh vực
 * và nhãn trạng thái tiếng Việt theo `status.config.ts`.
 */

/** Trạng thái phiếu phía backend */
export type FeedbackApiStatus = "received" | "processing" | "resolved";

/** Trạng thái backend → nhãn tiếng Việt của giao diện */
const STATUS_TO_UI: Record<FeedbackApiStatus, CitizenFeedback["status"]> = {
  received: "Mới tiếp nhận",
  processing: "Đang xử lý",
  resolved: "Đã xử lý",
};

/** Nhãn tiếng Việt của giao diện → trạng thái backend */
const STATUS_TO_API: Record<CitizenFeedback["status"], FeedbackApiStatus> = {
  "Mới tiếp nhận": "received",
  "Đang xử lý": "processing",
  "Đã xử lý": "resolved",
};

/** Đổi nhãn trạng thái của giao diện sang mã trạng thái backend; "all" → không lọc */
export function toApiStatus(uiStatus: string | undefined): FeedbackApiStatus | undefined {
  if (!uiStatus || uiStatus === "all") return undefined;
  return STATUS_TO_API[uiStatus as CitizenFeedback["status"]];
}

/** Bản ghi phản ánh do backend trả về cho cán bộ */
interface FeedbackApiItem {
  code: string;
  categoryKey?: string;
  title?: string;
  description?: string;
  location?: string;
  /** Toạ độ GPS kèm theo phản ánh — Mini App lấy từ điện thoại người gửi */
  lat?: number;
  lng?: number;
  /** Số giờ còn lại tới hạn SLA; âm = quá hạn; null khi chưa có hạn */
  slaHoursLeft?: number | null;
  status?: string;
  rating?: number;
  ratingComment?: string;
  citizenName?: string;
  /** Backend đã che bớt số ("098•••432") */
  citizenPhone?: string;
  sentAt?: string;
  assignee?: string;
  department?: string;
  timeline?: TimelineItem[];
  imageFileIds?: string[];
  resultImageFileIds?: string[];
}

/** Bộ lọc danh sách gửi lên server */
export interface FeedbackListFilter {
  /** key lĩnh vực (sla.config); bỏ trống hoặc "all" = mọi lĩnh vực */
  categoryKey?: string;
  /** nhãn trạng thái tiếng Việt; bỏ trống hoặc "all" = mọi trạng thái */
  status?: string;
  department?: string;
  assignee?: string;
  /** Từ khoá tìm trong mã phiếu / tiêu đề / nội dung */
  q?: string;
  page?: number;
  limit?: number;
}

/** Danh sách phản ánh đã ánh xạ sang kiểu của giao diện */
export interface FeedbackListResult {
  items: CitizenFeedback[];
  total: number;
  page: number;
  limit: number;
}

/** 4 thẻ thống kê đầu trang Phản ánh */
export interface FeedbackStatsData {
  /** Kỳ thống kê dạng "MM/yyyy" */
  month: string;
  receivedThisMonth: number;
  resolvedThisMonth: number;
  /** Tỷ lệ xử lý đúng hạn (%) */
  onTimeRate: number;
  /** Điểm hài lòng trung bình, thang 5 */
  avgRating: number;
  ratedCount: number;
}

/** Dữ liệu phân công cán bộ xử lý */
export interface AssignFeedbackInput {
  assignee: string;
  department: string;
  note?: string;
}

/** Dữ liệu chuyển phiếu sang bộ phận khác — backend bắt buộc có lý do */
export interface TransferFeedbackInput {
  department: string;
  assignee?: string;
  reason: string;
}

/** Dữ liệu xác nhận đã xử lý xong — backend bắt buộc có kết quả xử lý */
export interface ResolveFeedbackInput {
  note: string;
  resultImageFileIds?: string[];
}

/** Mã phiếu có ký tự "#" nên phải mã hoá trước khi ghép vào đường dẫn */
function codePath(code: string): string {
  return encodeURIComponent(code);
}

/** Ánh xạ bản ghi backend sang kiểu dùng cho giao diện */
function toCitizenFeedback(raw: FeedbackApiItem): CitizenFeedback {
  return {
    code: raw.code,
    categoryLabel: findCategory(raw.categoryKey ?? "").label,
    title: raw.title ?? "",
    excerpt: raw.description ?? "",
    location: raw.location ?? "",
    lat: raw.lat,
    lng: raw.lng,
    // Giao diện hiển thị số giờ nguyên; backend trả số thực (ví dụ -24.3)
    slaHoursLeft: Math.round(raw.slaHoursLeft ?? 0),
    status: STATUS_TO_UI[(raw.status ?? "received") as FeedbackApiStatus] ?? "Mới tiếp nhận",
    rating: raw.rating ?? 0,
    ratingComment: raw.ratingComment || undefined,
    senderName: raw.citizenName || "Người dân",
    senderPhone: raw.citizenPhone ?? "",
    sentAt: raw.sentAt ?? "",
    assignee: raw.assignee || UNASSIGNED,
    department: raw.department || UNASSIGNED,
    timeline: raw.timeline ?? [],
    imageFileIds: raw.imageFileIds ?? [],
    resultImageFileIds: raw.resultImageFileIds ?? [],
  };
}

/** Độ trễ giả lập cho nhánh mock để giao diện vẫn thể hiện trạng thái tải */
function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

/** Lọc + phân trang trên dữ liệu mock, mô phỏng đúng hành vi của server */
function mockList(filter: FeedbackListFilter): FeedbackListResult {
  const keyword = filter.q?.trim().toLowerCase() ?? "";
  const matched = feedbackList.filter((item) => {
    if (filter.categoryKey && filter.categoryKey !== "all" && findCategory(item.categoryLabel).key !== filter.categoryKey) {
      return false;
    }
    const status = toApiStatus(filter.status);
    if (status && STATUS_TO_API[item.status] !== status) return false;
    if (filter.department && item.department !== filter.department) return false;
    if (filter.assignee && item.assignee !== filter.assignee) return false;
    if (keyword && !`${item.code} ${item.title} ${item.excerpt} ${item.location}`.toLowerCase().includes(keyword)) {
      return false;
    }
    return true;
  });

  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.max(1, filter.limit ?? (matched.length || 1));
  return { items: matched.slice((page - 1) * limit, page * limit), total: matched.length, page, limit };
}

/** Số liệu thống kê tương ứng dữ liệu mock */
function mockStats(): FeedbackStatsData {
  const now = new Date();
  return {
    month: `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
    receivedThisMonth: 312,
    resolvedThisMonth: 271,
    onTimeRate: 87,
    avgRating: 4.6,
    ratedCount: 1204,
  };
}

/** Tìm phiếu trong dữ liệu mock, báo lỗi giống backend khi không có */
function mockDetail(code: string): CitizenFeedback {
  const found = feedbackList.find((item) => item.code === code);
  if (!found) throw new Error(`Không tìm thấy phiếu phản ánh ${code}`);
  return found;
}

export const feedbackService = {
  /** Danh sách phản ánh có lọc + phân trang; bộ lọc gửi thẳng lên server */
  async list(filter: FeedbackListFilter = {}): Promise<FeedbackListResult> {
    if (appConfig.api.useMocks) return mockDelay(mockList(filter));

    const qs = buildQuery({
      categoryKey: filter.categoryKey === "all" ? undefined : filter.categoryKey,
      status: toApiStatus(filter.status),
      department: filter.department,
      assignee: filter.assignee,
      q: filter.q,
      page: filter.page,
      limit: filter.limit,
    });
    const res = await apiClient.get<Paged<FeedbackApiItem>>(`/feedback${qs}`);
    return {
      items: (res.items ?? []).map(toCitizenFeedback),
      total: res.total ?? 0,
      page: res.page ?? 1,
      limit: res.limit ?? 0,
    };
  },

  /** Số liệu 4 thẻ thống kê đầu trang */
  async stats(): Promise<FeedbackStatsData> {
    if (appConfig.api.useMocks) return mockDelay(mockStats());
    return apiClient.get<FeedbackStatsData>("/feedback/stats");
  },

  /** Chi tiết một phiếu phản ánh theo mã */
  async detail(code: string): Promise<CitizenFeedback> {
    if (appConfig.api.useMocks) return mockDelay(mockDetail(code));
    return toCitizenFeedback(await apiClient.get<FeedbackApiItem>(`/feedback/${codePath(code)}`));
  },

  /** Phân công cán bộ + bộ phận; phiếu mới tiếp nhận chuyển sang đang xử lý */
  async assign(code: string, input: AssignFeedbackInput): Promise<CitizenFeedback> {
    if (appConfig.api.useMocks) {
      return mockDelay({ ...mockDetail(code), assignee: input.assignee, department: input.department, status: "Đang xử lý" });
    }
    return toCitizenFeedback(await apiClient.patch<FeedbackApiItem>(`/feedback/${codePath(code)}/assign`, input));
  },

  /** Chuyển phiếu sang bộ phận khác kèm lý do */
  async transfer(code: string, input: TransferFeedbackInput): Promise<CitizenFeedback> {
    if (appConfig.api.useMocks) {
      return mockDelay({ ...mockDetail(code), department: input.department, assignee: input.assignee || UNASSIGNED });
    }
    return toCitizenFeedback(await apiClient.patch<FeedbackApiItem>(`/feedback/${codePath(code)}/transfer`, input));
  },

  /** Xác nhận đã xử lý xong; backend tự gửi kết quả cho công dân */
  async resolve(code: string, input: ResolveFeedbackInput): Promise<CitizenFeedback> {
    if (appConfig.api.useMocks) {
      return mockDelay({
        ...mockDetail(code),
        status: "Đã xử lý",
        slaHoursLeft: 0,
        resultImageFileIds: input.resultImageFileIds ?? [],
      });
    }
    return toCitizenFeedback(await apiClient.patch<FeedbackApiItem>(`/feedback/${codePath(code)}/resolve`, input));
  },
};
