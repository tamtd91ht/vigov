import { appConfig } from "@/config/app.config";
import type { FeedbackCategory } from "@/config/categories";
import { apiClient, buildQuery, mockDelay, resolveApiUrl, type Paged } from "@/services/api";
import { filesService } from "@/services/files.service";
import { initialTickets } from "@/mocks/feedback.mock";
import type { FeedbackTicket, TicketStatus, TimelineStep } from "@/types";

/**
 * Phản ánh của công dân — nhóm endpoint /feedback/citizen/** (cần JWT công dân).
 *
 * Mã phiếu backend sinh có dạng "#PA-2026-0001": ký tự '#' phải được
 * encodeURIComponent trước khi ghép vào đường dẫn, nếu không trình duyệt cắt
 * phần sau '#' thành fragment và máy chủ nhận đường dẫn cụt.
 */

/** Số phiếu lấy về màn "Phản ánh của tôi" */
const LIST_LIMIT = 50;

const STATUSES: TicketStatus[] = ["received", "processing", "resolved"];

/** Bản ghi phiếu như backend trả cho công dân (CITIZEN_PROJECTION + slaHoursLeft) */
interface ApiFeedback {
  code: string;
  categoryKey: string;
  title: string;
  description: string;
  location?: string;
  sentAt?: string;
  status: string;
  slaHoursLeft?: number | null;
  imageFileIds?: string[];
  /** Link đọc ảnh đã ký sẵn — chỉ có ở nhóm endpoint /feedback/citizen/** */
  imageUrls?: string[];
  resultImageUrls?: string[];
  timeline?: { title: string; meta?: string; state?: string }[];
  rating?: number;
  ratingComment?: string;
}

export interface CreateFeedbackInput {
  category: FeedbackCategory;
  title: string;
  description: string;
  location: string;
  lat?: number;
  lng?: number;
  /**
   * Đường dẫn tệp tạm của ảnh người dân đã chọn ở bước 2 (`filePaths` do
   * zmp-sdk trả về). Ảnh được tải lên module Files TRƯỚC khi tạo phiếu, nên
   * phiếu mang `imageFileIds` thật — Web Quản trị xem được ảnh hiện trường.
   */
  imagePaths: string[];
  /**
   * Gọi khi tải ảnh xong, ngay trước khi tạo phiếu — để giao diện đổi nhãn nút
   * từ "Đang tải ảnh…" sang "Đang gửi…". Không có ảnh thì gọi luôn.
   */
  onImagesUploaded?: () => void;
}

function toStatus(value: string): TicketStatus {
  return STATUSES.includes(value as TicketStatus) ? (value as TicketStatus) : "received";
}

function toTimeline(steps: ApiFeedback["timeline"]): TimelineStep[] {
  return (steps ?? []).map((s) => ({ title: s.title, meta: s.meta ?? "", current: s.state === "cur" }));
}

function toTicket(raw: ApiFeedback): FeedbackTicket {
  return {
    code: raw.code,
    categoryKey: raw.categoryKey,
    title: raw.title,
    description: raw.description,
    location: raw.location ?? "",
    sentAt: raw.sentAt ?? "",
    status: toStatus(raw.status),
    slaHoursLeft: Math.round(raw.slaHoursLeft ?? 0),
    /*
     * Link đọc ảnh do CHÍNH endpoint của công dân cấp (`imageUrls` /
     * `resultImageUrls`), không phải mã tệp trần.
     *
     * Ảnh phản ánh là tệp riêng tư nên `/files/<id>` trơn bị từ chối. Trước đây
     * Mini App vẽ ô màu giữ chỗ — người dân gửi ảnh xong không bao giờ xem lại
     * được ảnh mình gửi. Nay `GET /feedback/citizen/mine/**` (đã lọc theo
     * citizenPhone ngay trong truy vấn) trả kèm link đã ký, hiệu lực 1 giờ.
     *
     * Link máy chủ trả về là đường dẫn TƯƠNG ĐỐI, phải đổi sang tuyệt đối theo
     * origin của API — xem `resolveApiUrl`. Thiếu bước này thì `<img>` phân giải
     * về tên miền của Zalo và ô ảnh thành ô trống.
     */
    imageUrls: (raw.imageUrls ?? []).map(resolveApiUrl),
    resultImageUrls: (raw.resultImageUrls ?? []).map(resolveApiUrl),
    timeline: toTimeline(raw.timeline),
    rating: raw.rating ?? 0,
    ratingComment: raw.ratingComment || undefined,
  };
}

/** Mã phiếu chứa '#' nên luôn phải mã hoá trước khi ghép vào URL */
function codePath(code: string): string {
  return encodeURIComponent(code);
}

/** ===== Nhánh mock: giữ phiếu trong bộ nhớ để demo offline vẫn gửi được ===== */
const mockStore: FeedbackTicket[] = [...initialTickets];
let mockSeq = 142;

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function createMockTicket(input: CreateFeedbackInput): FeedbackTicket {
  const now = new Date();
  const ticket: FeedbackTicket = {
    code: `#PA-${now.getFullYear()}-${String(mockSeq).padStart(4, "0")}`,
    categoryKey: input.category.key,
    title: input.title,
    description: input.description,
    location: input.location,
    sentAt: stamp(now),
    status: "received",
    slaHoursLeft: input.category.resolveDays * 24,
    /* Chế độ mock không có máy chủ để tải ảnh: dùng thẳng đường dẫn tạm của
       Zalo làm link xem. Ảnh vẫn hiện đúng trong phiên đang chạy, đủ để trình
       diễn luồng gửi phiếu khi không có backend. */
    imageUrls: [...input.imagePaths],
    resultImageUrls: [],
    timeline: [
      { title: "Công dân gửi phản ánh", meta: `${stamp(now)} · Zalo Mini App` },
      { title: "Chờ tiếp nhận & phân công", meta: "Trong giờ hành chính", current: true },
    ],
    rating: 0,
  };
  mockSeq += 1;
  mockStore.unshift(ticket);
  return ticket;
}

export const feedbackService = {
  /** Danh sách phiếu của chính công dân đang đăng nhập */
  async listMine(): Promise<FeedbackTicket[]> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return [...mockStore];
    }
    const res = await apiClient.get<Paged<ApiFeedback>>(
      `/feedback/citizen/mine${buildQuery({ page: 1, limit: LIST_LIMIT })}`,
    );
    return res.items.map(toTicket);
  },

  /** Chi tiết một phiếu — phiếu của người khác backend trả 404 */
  async detailMine(code: string): Promise<FeedbackTicket> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      const found = mockStore.find((t) => t.code === code);
      if (!found) throw new Error("Không tìm thấy phiếu phản ánh");
      return found;
    }
    return toTicket(await apiClient.get<ApiFeedback>(`/feedback/citizen/mine/${codePath(code)}`));
  },

  /**
   * Gửi phản ánh mới; mã phiếu do backend sinh (#PA-<năm>-<4 chữ số>).
   *
   * Tải ảnh lên TRƯỚC rồi mới tạo phiếu: đường dẫn ảnh của Zalo là tệp tạm
   * trong webview, hết hiệu lực khi đóng app, nên không thể tạo phiếu trước
   * rồi gắn ảnh sau. Ảnh lỗi thì cả lượt gửi dừng lại (xem
   * `filesService.uploadFeedbackImages`) — thà báo lỗi để người dân thử lại
   * còn hơn tạo phiếu thiếu ảnh minh chứng trong im lặng.
   */
  async create(input: CreateFeedbackInput): Promise<FeedbackTicket> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      // Mock không tải ảnh, nhưng vẫn báo để nhãn nút không mắc ở "Đang tải ảnh…"
      input.onImagesUploaded?.();
      return createMockTicket(input);
    }

    const imageFileIds = input.imagePaths.length
      ? await filesService.uploadFeedbackImages(input.imagePaths)
      : [];
    input.onImagesUploaded?.();

    const created = await apiClient.post<ApiFeedback>("/feedback/citizen", {
      categoryKey: input.category.key,
      title: input.title,
      description: input.description,
      location: input.location,
      lat: input.lat,
      lng: input.lng,
      imageFileIds,
      channel: "zalo",
    });
    return toTicket(created);
  },

  /** Đánh giá 1–5 sao; backend chỉ nhận khi phiếu đã ở trạng thái resolved */
  async rate(code: string, rating: number, ratingComment: string): Promise<void> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      const found = mockStore.find((t) => t.code === code);
      if (found) {
        found.rating = rating;
        found.ratingComment = ratingComment.trim() || undefined;
      }
      return;
    }
    await apiClient.post(`/feedback/citizen/mine/${codePath(code)}/rating`, {
      rating,
      ratingComment: ratingComment.trim() || undefined,
    });
  },
};
