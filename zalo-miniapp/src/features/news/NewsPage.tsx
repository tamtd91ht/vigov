import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/components/Icon";
import { formatNumber } from "@/components/common";
import { DataState } from "@/components/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { contentService } from "@/services/content.service";
import type { Article, ArticleType } from "@/types";

/** Thứ tự tab loại bài viết */
export const ARTICLE_TYPES: ArticleType[] = ["news", "event", "notice"];

/** Nhãn hiển thị theo loại bài viết — dùng chung với màn chi tiết */
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  news: "Tin tức",
  event: "Sự kiện",
  notice: "Thông báo",
};

/** Icon đại diện theo loại bài viết */
export const ARTICLE_TYPE_ICONS: Record<ArticleType, IconName> = {
  news: "news",
  event: "clock",
  notice: "megaphone",
};

/** Màu nhận diện theo loại bài viết */
export const ARTICLE_TYPE_COLORS: Record<ArticleType, string> = {
  news: "var(--blue)",
  event: "var(--pink)",
  notice: "var(--orange)",
};

const COVER_HEIGHT = 150;
const THUMB_SIZE = 72;

/** Nền cover: gradient từ màu bài viết sang chính màu đó pha 25% đen */
export function coverGradient(color: string): string {
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, #000 25%, ${color}))`;
}

/** Cắt chữ sau n dòng */
export function clampLines(lines: number): CSSProperties {
  return { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" };
}

/** Tin tức – Sự kiện – Thông báo của xã (WBS #16) — GET /content/public/articles */
export function NewsPage() {
  const [type, setType] = useState<ArticleType>("news");
  // Lọc theo loại ngay ở máy chủ (tham số ?type=) thay vì tải hết rồi lọc tại máy
  const resource = useApiResource(() => contentService.listArticles(type), [type]);
  const articles = resource.data ?? [];

  return (
    <>
      <div className="subhead">
        <h2>Tin tức xã</h2>
      </div>
      <div className="page">
        <div className="chips-row" style={{ marginBottom: 14 }}>
          {ARTICLE_TYPES.map((t) => (
            <button key={t} className={`fchip ${t === type ? "on" : ""}`} onClick={() => setType(t)}>
              {ARTICLE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <DataState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          empty={articles.length === 0}
          emptyIcon={ARTICLE_TYPE_ICONS[type]}
          emptyMessage={`Chưa có bài viết nào trong mục ${ARTICLE_TYPE_LABELS[type]}`}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {articles.map((a, i) =>
              i === 0 ? <FeaturedCard key={a.id} article={a} /> : <ArticleRow key={a.id} article={a} />,
            )}
          </div>
        </DataState>
      </div>
    </>
  );
}

/** Bài nổi bật đầu danh sách — cover gradient lớn + tiêu đề + excerpt */
function FeaturedCard({ article }: { article: Article }) {
  const navigate = useNavigate();

  return (
    <div className="card tap" role="button" style={{ overflow: "hidden" }} onClick={() => navigate(`/news/${article.id}`)}>
      <div
        style={{
          position: "relative",
          height: COVER_HEIGHT,
          background: coverGradient(article.coverColor),
          overflow: "hidden",
        }}
      >
        <span style={{ position: "absolute", right: -12, bottom: -16, color: "rgba(255,255,255,.22)" }}>
          <Icon name={ARTICLE_TYPE_ICONS[article.type]} size={112} strokeWidth={1.3} />
        </span>
        <span
          className="chip"
          style={{ position: "absolute", left: 12, top: 12, background: "rgba(255,255,255,.24)", color: "#fff" }}
        >
          {article.category}
        </span>
      </div>
      <div className="card-b">
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--navy)", lineHeight: 1.35, ...clampLines(2) }}>
          {article.title}
        </div>
        <div className="sm muted" style={{ marginTop: 6, ...clampLines(2) }}>
          {article.excerpt}
        </div>
        <div className="tiny muted" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <span>{article.publishedAt}</span>
          <span>·</span>
          <Icon name="eye" size={13} />
          <span>{formatNumber(article.views)} lượt xem</span>
        </div>
      </div>
    </div>
  );
}

/** Bài thường — thumb vuông + tiêu đề + chuyên mục */
function ArticleRow({ article }: { article: Article }) {
  const navigate = useNavigate();

  return (
    <div
      className="card card-b tap"
      role="button"
      style={{ display: "flex", gap: 12, alignItems: "center" }}
      onClick={() => navigate(`/news/${article.id}`)}
    >
      <span className="thumb" style={{ width: THUMB_SIZE, height: THUMB_SIZE, background: article.coverColor }}>
        <Icon name={ARTICLE_TYPE_ICONS[article.type]} size={26} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--navy)", lineHeight: 1.4, ...clampLines(2) }}>
          {article.title}
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          {article.category} · {article.publishedAt}
        </div>
      </div>
    </div>
  );
}
