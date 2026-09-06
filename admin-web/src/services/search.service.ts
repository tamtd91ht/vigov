import { apiClient, buildQuery } from "@/services/api";
import { appConfig } from "@/config/app.config";
import { feedbackList } from "@/mocks/feedback";
import { incomingDocuments } from "@/mocks/documents";
import { tasks as mockTasks } from "@/mocks/tasks";
import { findCategory } from "@/config/sla.config";

/**
 * Tìm kiếm toàn cục (WBS #1, #28) — bọc endpoint GET /search của backend.
 *
 * Backend tìm bằng chỉ mục toàn văn của MongoDB trên ba loại dữ liệu và trả về
 * đúng những trường cần cho một dòng kết quả — KHÔNG trả bản ghi đầy đủ. Vì thế
 * bấm vào kết quả chỉ điều hướng kèm mã bản ghi, còn phân hệ đích tự tải chi
 * tiết bằng service của nó.
 *
 * Phạm vi tìm (có thêm công dân, hạng mục giải ngân, tin bài hay không) là câu
 * hỏi mở #28, chưa chốt với khách — nên danh sách loại dưới đây cố định ba loại
 * đúng như backend đang phục vụ.
 */

/** Các loại dữ liệu tìm được ở Phase 1 — khớp SEARCHABLE_TYPES của backend */
export const SEARCH_TYPES = ["tasks", "documents", "feedback"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** Số kết quả tối đa mỗi nhóm cho bảng thả xuống của thanh tìm kiếm */
export const SEARCH_PREVIEW_LIMIT = 5;

/**
 * Số ký tự tối thiểu mới gửi truy vấn.
 * Một ký tự khớp gần như mọi bản ghi nên vừa vô ích vừa nặng máy chủ.
 */
export const SEARCH_MIN_LENGTH = 2;

export interface TaskHit {
  code: string;
  title: string;
  status: string;
  department: string;
}

export interface DocumentHit {
  arrivalNo: string;
  refNo: string;
  summary: string;
  department: string;
}

export interface FeedbackHit {
  code: string;
  title: string;
  status: string;
  categoryKey: string;
}

export interface SearchResults {
  tasks: TaskHit[];
  documents: DocumentHit[];
  feedback: FeedbackHit[];
}

/** Phản hồi của GET /search */
export interface SearchResponse {
  q: string;
  types: SearchType[];
  results: SearchResults;
  total: number;
}

/** Phản hồi rỗng dùng cho từ khoá quá ngắn — khỏi phải kiểm tra null ở giao diện */
export function emptySearchResponse(q = ""): SearchResponse {
  return { q, types: [...SEARCH_TYPES], results: { tasks: [], documents: [], feedback: [] }, total: 0 };
}

/** Tìm trên dữ liệu mock để demo được giao diện khi chưa dựng backend */
function mockSearch(keyword: string, limit: number): SearchResponse {
  const needle = keyword.toLowerCase();
  const results: SearchResults = {
    tasks: mockTasks
      .filter((t) => `${t.id} ${t.title} ${t.description}`.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((t) => ({ code: t.id, title: t.title, status: t.status, department: t.department })),
    documents: incomingDocuments
      .filter((d) => `${d.refNo} ${d.summary} ${d.sender}`.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((d) => ({
        arrivalNo: d.arrivalNo,
        refNo: d.refNo,
        summary: d.summary,
        department: d.department,
      })),
    feedback: feedbackList
      .filter((f) => `${f.code} ${f.title} ${f.excerpt}`.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((f) => ({
        code: f.code,
        title: f.title,
        status: f.status,
        categoryKey: findCategory(f.categoryLabel).key,
      })),
  };
  return {
    q: keyword,
    types: [...SEARCH_TYPES],
    results,
    total: results.tasks.length + results.documents.length + results.feedback.length,
  };
}

/**
 * GET /search — tìm đồng thời trong nhiệm vụ, văn bản và phản ánh.
 *
 * Từ khoá ngắn hơn `SEARCH_MIN_LENGTH` trả về kết quả rỗng ngay tại trình duyệt,
 * không gọi máy chủ (backend cũng từ chối từ khoá rỗng bằng lỗi 400).
 */
export async function globalSearch(
  keyword: string,
  limit = SEARCH_PREVIEW_LIMIT,
  types: readonly SearchType[] = SEARCH_TYPES,
): Promise<SearchResponse> {
  const q = keyword.trim();
  if (q.length < SEARCH_MIN_LENGTH) return emptySearchResponse(q);

  if (appConfig.api.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, appConfig.api.mockDelayMs));
    return mockSearch(q, limit);
  }

  return apiClient.get<SearchResponse>(`/search${buildQuery({ q, types: types.join(","), limit })}`);
}
