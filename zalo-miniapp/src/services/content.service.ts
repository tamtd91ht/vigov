import { appConfig } from "@/config/app.config";
import { apiClient, buildQuery, mockDelay, type Paged } from "@/services/api";
import { mockArticles } from "@/mocks/news.mock";
import { mockRadioBulletins } from "@/mocks/radio.mock";
import { mockVideos } from "@/mocks/video.mock";
import type { Article, ArticleType, RadioBulletin, VideoItem } from "@/types";

/**
 * Nội dung công khai của xã — tin tức, video tuyên truyền, bản tin truyền thanh.
 * Nguồn: nhóm endpoint /content/public/* của backend (KHÔNG cần token).
 *
 * Cờ appConfig.api.useMocks rẽ nhánh ngay tại đây để demo offline vẫn chạy;
 * các màn hình chỉ gọi service, không biết dữ liệu đến từ đâu.
 */

/** Số bản ghi lấy về mỗi màn danh sách — đủ cho quy mô nội dung cấp xã */
const LIST_LIMIT = 50;

/** Màu bìa dự phòng khi CMS chưa chọn màu cho bài viết/video */
const FALLBACK_COVER = "var(--slate)";

/** Bản ghi bài viết như backend trả về (content.schema.ts) */
interface ApiArticle {
  _id: string;
  type: string;
  title: string;
  category?: string;
  excerpt?: string;
  /** Chỉ có ở endpoint chi tiết — danh sách dùng projection '-content' */
  content?: string;
  coverColor?: string;
  publishedAt?: string;
  views?: number;
}

interface ApiVideo {
  _id: string;
  title: string;
  topic?: string;
  duration?: string;
  views?: number;
  publishedAt?: string;
  coverColor?: string;
  description?: string;
}

interface ApiRadio {
  _id: string;
  title: string;
  category?: string;
  date?: string;
  durationSeconds?: number;
  plays?: number;
}

const ARTICLE_TYPES: ArticleType[] = ["news", "event", "notice"];

function toArticleType(value: string): ArticleType {
  return ARTICLE_TYPES.includes(value as ArticleType) ? (value as ArticleType) : "news";
}

function toArticle(raw: ApiArticle): Article {
  return {
    id: raw._id,
    type: toArticleType(raw.type),
    title: raw.title,
    category: raw.category ?? "",
    excerpt: raw.excerpt ?? "",
    content: raw.content ?? "",
    coverColor: raw.coverColor || FALLBACK_COVER,
    publishedAt: raw.publishedAt ?? "",
    views: raw.views ?? 0,
  };
}

function toVideo(raw: ApiVideo): VideoItem {
  return {
    id: raw._id,
    title: raw.title,
    topic: raw.topic ?? "",
    duration: raw.duration ?? "",
    views: raw.views ?? 0,
    publishedAt: raw.publishedAt ?? "",
    coverColor: raw.coverColor || FALLBACK_COVER,
    description: raw.description ?? "",
  };
}

function toBulletin(raw: ApiRadio): RadioBulletin {
  return {
    id: raw._id,
    title: raw.title,
    category: raw.category ?? "",
    date: raw.date ?? "",
    durationSeconds: raw.durationSeconds ?? 0,
    plays: raw.plays ?? 0,
  };
}

export const contentService = {
  /** Bài viết đã phát hành, lọc theo loại (news | event | notice) */
  async listArticles(type?: ArticleType): Promise<Article[]> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return type ? mockArticles.filter((a) => a.type === type) : mockArticles;
    }
    const query = buildQuery({ type, page: 1, limit: LIST_LIMIT });
    const res = await apiClient.get<Paged<ApiArticle>>(`/content/public/articles${query}`);
    return res.items.map(toArticle);
  },

  /** Chi tiết bài viết — mỗi lần mở backend tăng lượt xem */
  async getArticle(id: string): Promise<Article> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      const found = mockArticles.find((a) => a.id === id);
      if (!found) throw new Error("Không tìm thấy bài viết");
      return found;
    }
    return toArticle(await apiClient.get<ApiArticle>(`/content/public/articles/${encodeURIComponent(id)}`));
  },

  /** Video tuyên truyền đã phát hành */
  async listVideos(): Promise<VideoItem[]> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return mockVideos;
    }
    const res = await apiClient.get<Paged<ApiVideo>>(
      `/content/public/videos${buildQuery({ page: 1, limit: LIST_LIMIT })}`,
    );
    return res.items.map(toVideo);
  },

  /** Bản tin truyền thanh đã phát hành */
  async listRadio(): Promise<RadioBulletin[]> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return mockRadioBulletins;
    }
    const res = await apiClient.get<Paged<ApiRadio>>(
      `/content/public/radio${buildQuery({ page: 1, limit: LIST_LIMIT })}`,
    );
    return res.items.map(toBulletin);
  },
};

/** Danh sách chuyên mục xuất hiện trong dữ liệu, giữ nguyên thứ tự gặp đầu tiên */
export function distinctBy<T>(items: T[], pick: (item: T) => string): string[] {
  const seen: string[] = [];
  for (const item of items) {
    const value = pick(item);
    if (value && !seen.includes(value)) seen.push(value);
  }
  return seen;
}
