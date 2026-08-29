import { appConfig } from "@/config/app.config";
import type { FeedbackCategory } from "@/config/categories";
import { apiClient, buildQuery, mockDelay, type Paged } from "@/services/api";
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

/** Màu placeholder cho ảnh hiện trường — xoay vòng theo số ảnh đính kèm */
const IMAGE_COLORS = ["var(--blue)", "var(--green)", "var(--purple)", "var(--orange)", "var(--teal)"];

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
  /** Ô màu placeholder người dùng đã thêm ở bước 2 */
  imageColors: string[];
}

function toStatus(value: string): TicketStatus {
  return STATUSES.includes(value as TicketStatus) ? (value as TicketStatus) : "received";
}

function toTimeline(steps: ApiFeedback["timeline"]): TimelineStep[] {
  return (steps ?? []).map((s) => ({ title: s.title, meta: s.meta ?? "", current: s.state === "cur" }));
}

/**
 * Ảnh hiện trường: backend chỉ trả mã tệp (imageFileIds). Đường dẫn tải ảnh
 * cho công dân thuộc module Files (WBS #24) và chưa mở cho Mini App, nên
 * Phase 1 vẫn hiển thị bằng ô màu — đúng số ảnh đã đính kèm.
 */
function toImageColors(fileIds: string[] | undefined): string[] {
  return (fileIds ?? []).map((_, i) => IMAGE_COLORS[i % IMAGE_COLORS.length]);
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
    imageColors: toImageColors(raw.imageFileIds),
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
    imageColors: input.imageColors,
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

  /** Gửi phản ánh mới; mã phiếu do backend sinh (#PA-<năm>-<4 chữ số>) */
  async create(input: CreateFeedbackInput): Promise<FeedbackTicket> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return createMockTicket(input);
    }
    const created = await apiClient.post<ApiFeedback>("/feedback/citizen", {
      categoryKey: input.category.key,
      title: input.title,
      description: input.description,
      location: input.location,
      lat: input.lat,
      lng: input.lng,
      // Upload ảnh lên module Files chưa mở cho Mini App (WBS #24) nên chưa gửi
      // imageFileIds; ô màu người dùng chọn chỉ là placeholder phía giao diện.
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
