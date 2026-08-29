import { apiClient, buildQuery } from "./api";
import { appConfig } from "@/config/app.config";
import { cmsArticles, cmsVideos, radioBulletins } from "@/mocks/cms";
import type { BroadcastLog, CmsArticle, CmsVideo, RadioBulletin } from "@/types";

/**
 * Phân hệ CMS nội dung Mobile (WBS #10) + gửi thông báo hàng loạt (WBS #23).
 * Backend trả tài liệu Mongo thô (`_id`, `durationSeconds`…) nên lớp này quy đổi
 * về đúng kiểu dùng chung trong `@/types` trước khi giao cho giao diện.
 */

/** Trang kết quả của nhóm endpoint /content — có thêm totalPages so với Paged */
export interface ContentPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ArticleQuery {
  type?: string;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ContentQuery {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ArticleInput {
  type: CmsArticle["type"];
  title: string;
  category?: string;
  excerpt?: string;
  content?: string;
  coverColor?: string;
  coverFileId?: string;
  status?: CmsArticle["status"];
}

export interface VideoInput {
  title: string;
  topic?: string;
  duration?: string;
  source: CmsVideo["source"];
  youtubeUrl?: string;
  videoFileId?: string;
  coverColor?: string;
  status?: CmsVideo["status"];
}

export interface RadioInput {
  title: string;
  category?: string;
  date?: string;
  durationSeconds?: number;
  audioFileId?: string;
  status?: RadioBulletin["status"];
}

export interface BroadcastInput {
  /** Backend nhận danh sách kênh; giao diện hiện chọn một kênh mỗi lượt gửi */
  channels: ("zns" | "push")[];
  audience: BroadcastLog["audience"];
  title: string;
  body: string;
}

export interface BroadcastResult {
  audience: BroadcastLog["audience"];
  total: number;
  ok: number;
  failed: number;
}

/** ===== Kiểu tài liệu thô backend trả về ===== */

interface RawArticle {
  _id: string;
  type: string;
  title: string;
  category?: string;
  excerpt?: string;
  content?: string;
  coverColor?: string;
  coverFileId?: string;
  status: string;
  publishedAt?: string;
  author?: string;
  views?: number;
}

interface RawVideo {
  _id: string;
  title: string;
  topic?: string;
  duration?: string;
  views?: number;
  source: string;
  videoFileId?: string;
  youtubeUrl?: string;
  publishedAt?: string;
  status: string;
}

interface RawRadio {
  _id: string;
  title: string;
  category?: string;
  date?: string;
  durationSeconds?: number;
  plays?: number;
  audioFileId?: string;
  status: string;
}

interface RawPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEFAULT_COVER_COLOR = "var(--blue)";
/** Nhãn thời lượng khi bản tin chưa có tệp âm thanh để đo */
const UNKNOWN_DURATION = "--:--";

function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

/** Giây → "mm:ss"; 0/không có → "--:--" */
function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return UNKNOWN_DURATION;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toArticle(raw: RawArticle): CmsArticle {
  return {
    id: raw._id,
    type: raw.type as CmsArticle["type"],
    title: raw.title,
    category: raw.category ?? "",
    excerpt: raw.excerpt ?? "",
    content: raw.content ?? "",
    coverColor: raw.coverColor ?? DEFAULT_COVER_COLOR,
    coverFileId: raw.coverFileId || undefined,
    status: raw.status as CmsArticle["status"],
    publishedAt: raw.publishedAt ?? "",
    author: raw.author ?? "",
    views: raw.views ?? 0,
  };
}

function toVideo(raw: RawVideo): CmsVideo {
  return {
    id: raw._id,
    title: raw.title,
    topic: raw.topic ?? "",
    duration: raw.duration || UNKNOWN_DURATION,
    views: raw.views ?? 0,
    source: raw.source as CmsVideo["source"],
    videoFileId: raw.videoFileId || undefined,
    youtubeUrl: raw.youtubeUrl || undefined,
    publishedAt: raw.publishedAt ?? "",
    status: raw.status as CmsVideo["status"],
  };
}

function toRadio(raw: RawRadio): RadioBulletin {
  return {
    id: raw._id,
    title: raw.title,
    category: raw.category ?? "",
    date: raw.date ?? "",
    duration: formatDuration(raw.durationSeconds),
    plays: raw.plays ?? 0,
    audioFileId: raw.audioFileId || undefined,
    status: raw.status as RadioBulletin["status"],
  };
}

/** Phân trang tại chỗ cho chế độ mock */
function mockPage<T>(all: T[], page = 1, limit = 20): ContentPage<T> {
  const start = (page - 1) * limit;
  return {
    items: all.slice(start, start + limit),
    total: all.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  };
}

// ─── Bài viết ──────────────────────────────────────────────────────────────

/** GET /content/articles */
export async function listArticles(query: ArticleQuery = {}): Promise<ContentPage<CmsArticle>> {
  if (appConfig.api.useMocks) {
    const filtered = cmsArticles.filter(
      (a) =>
        (!query.type || a.type === query.type) &&
        (!query.status || a.status === query.status) &&
        (!query.q || a.title.toLowerCase().includes(query.q.toLowerCase())),
    );
    return mockDelay(mockPage(filtered, query.page, query.limit));
  }
  const raw = await apiClient.get<RawPage<RawArticle>>(`/content/articles${buildQuery({ ...query })}`);
  return { ...raw, items: raw.items.map(toArticle) };
}

/** GET /content/articles/:id — nội dung đầy đủ để mở form sửa */
export async function getArticle(id: string): Promise<CmsArticle> {
  if (appConfig.api.useMocks) {
    const found = cmsArticles.find((a) => a.id === id);
    if (!found) throw new Error("Không tìm thấy bài viết");
    return mockDelay({ ...found });
  }
  return toArticle(await apiClient.get<RawArticle>(`/content/articles/${encodeURIComponent(id)}`));
}

/** POST /content/articles */
export async function createArticle(input: ArticleInput): Promise<CmsArticle> {
  if (appConfig.api.useMocks) {
    return mockDelay(
      toArticle({ ...input, _id: `ART-NEW-${Date.now()}`, status: input.status ?? "draft" } as RawArticle),
    );
  }
  return toArticle(await apiClient.post<RawArticle>("/content/articles", input));
}

/** PATCH /content/articles/:id — không đổi trạng thái phát hành */
export async function updateArticle(id: string, input: Partial<ArticleInput>): Promise<CmsArticle> {
  if (appConfig.api.useMocks) {
    return mockDelay(toArticle({ ...input, _id: id, status: input.status ?? "draft" } as RawArticle));
  }
  return toArticle(await apiClient.patch<RawArticle>(`/content/articles/${encodeURIComponent(id)}`, input));
}

/** PATCH /content/articles/:id/publish — đăng hoặc gỡ bài */
export async function publishArticle(id: string, status: CmsArticle["status"]): Promise<CmsArticle> {
  if (appConfig.api.useMocks) {
    return mockDelay(toArticle({ _id: id, type: "news", title: "", status } as RawArticle));
  }
  return toArticle(
    await apiClient.patch<RawArticle>(`/content/articles/${encodeURIComponent(id)}/publish`, { status }),
  );
}

/** DELETE /content/articles/:id — yêu cầu quyền cms:admin */
export async function deleteArticle(id: string): Promise<void> {
  if (appConfig.api.useMocks) {
    await mockDelay(null);
    return;
  }
  await apiClient.delete<{ deleted: boolean }>(`/content/articles/${encodeURIComponent(id)}`);
}

// ─── Video ─────────────────────────────────────────────────────────────────

/** GET /content/videos */
export async function listVideos(query: ContentQuery = {}): Promise<ContentPage<CmsVideo>> {
  if (appConfig.api.useMocks) return mockDelay(mockPage(cmsVideos, query.page, query.limit));
  const raw = await apiClient.get<RawPage<RawVideo>>(`/content/videos${buildQuery({ ...query })}`);
  return { ...raw, items: raw.items.map(toVideo) };
}

/** POST /content/videos */
export async function createVideo(input: VideoInput): Promise<CmsVideo> {
  if (appConfig.api.useMocks) {
    return mockDelay(toVideo({ ...input, _id: `VID-NEW-${Date.now()}`, status: input.status ?? "draft" } as RawVideo));
  }
  return toVideo(await apiClient.post<RawVideo>("/content/videos", input));
}

/** PATCH /content/videos/:id */
export async function updateVideo(id: string, input: Partial<VideoInput>): Promise<CmsVideo> {
  if (appConfig.api.useMocks) {
    return mockDelay(toVideo({ ...input, _id: id, source: "youtube", status: input.status ?? "draft" } as RawVideo));
  }
  return toVideo(await apiClient.patch<RawVideo>(`/content/videos/${encodeURIComponent(id)}`, input));
}

/** DELETE /content/videos/:id */
export async function deleteVideo(id: string): Promise<void> {
  if (appConfig.api.useMocks) {
    await mockDelay(null);
    return;
  }
  await apiClient.delete<{ deleted: boolean }>(`/content/videos/${encodeURIComponent(id)}`);
}

// ─── Bản tin truyền thanh ──────────────────────────────────────────────────

/** GET /content/radio */
export async function listRadio(query: ContentQuery = {}): Promise<ContentPage<RadioBulletin>> {
  if (appConfig.api.useMocks) return mockDelay(mockPage(radioBulletins, query.page, query.limit));
  const raw = await apiClient.get<RawPage<RawRadio>>(`/content/radio${buildQuery({ ...query })}`);
  return { ...raw, items: raw.items.map(toRadio) };
}

/** POST /content/radio */
export async function createRadio(input: RadioInput): Promise<RadioBulletin> {
  if (appConfig.api.useMocks) {
    return mockDelay(toRadio({ ...input, _id: `RAD-NEW-${Date.now()}`, status: input.status ?? "draft" } as RawRadio));
  }
  return toRadio(await apiClient.post<RawRadio>("/content/radio", input));
}

/** PATCH /content/radio/:id */
export async function updateRadio(id: string, input: Partial<RadioInput>): Promise<RadioBulletin> {
  if (appConfig.api.useMocks) {
    return mockDelay(toRadio({ ...input, _id: id, status: input.status ?? "draft" } as RawRadio));
  }
  return toRadio(await apiClient.patch<RawRadio>(`/content/radio/${encodeURIComponent(id)}`, input));
}

/** DELETE /content/radio/:id */
export async function deleteRadio(id: string): Promise<void> {
  if (appConfig.api.useMocks) {
    await mockDelay(null);
    return;
  }
  await apiClient.delete<{ deleted: boolean }>(`/content/radio/${encodeURIComponent(id)}`);
}

// ─── Gửi thông báo hàng loạt ───────────────────────────────────────────────

/** POST /notifications/broadcast — trả về số người nhận thật do backend giải ra */
export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  if (appConfig.api.useMocks) {
    return mockDelay({ audience: input.audience, total: 0, ok: 0, failed: 0 });
  }
  return apiClient.post<BroadcastResult>("/notifications/broadcast", input);
}
