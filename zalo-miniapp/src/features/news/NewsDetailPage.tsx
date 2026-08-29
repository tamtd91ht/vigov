import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { Chip, SectionHead, formatNumber } from "@/components/common";
import { DataState } from "@/components/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import { contentService } from "@/services/content.service";
import { useToast } from "@/state/ToastContext";
import type { Article } from "@/types";
import {
  ARTICLE_TYPE_COLORS,
  ARTICLE_TYPE_ICONS,
  ARTICLE_TYPE_LABELS,
  clampLines,
  coverGradient,
} from "./NewsPage";

const COVER_HEIGHT = 180;
const RELATED_COUNT = 3;
const RELATED_THUMB = 56;
const SHARE_TOAST = "Chia sẻ bài viết sẽ bổ sung cùng tích hợp Zalo SDK";
const NOT_FOUND = "Không tìm thấy bài viết";
/** Màu cover khi chưa biết bài viết (đang tải hoặc lỗi) */
const NEUTRAL_COVER = "var(--navy)";

/** Nút tròn nền đen mờ đè lên cover */
const overlayBtn: CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: "rgba(0,0,0,.34)",
  display: "grid",
  placeItems: "center",
};

/** Chi tiết bài viết (WBS #16) — GET /content/public/articles/:id (tăng lượt xem) */
export function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const detail = useApiResource(
    () => (id ? contentService.getArticle(id) : Promise.reject(new ApiError(NOT_FOUND, 404))),
    [id],
  );
  const article = detail.data;

  /** Tin liên quan cùng loại — chỉ tải sau khi biết bài viết thuộc loại nào */
  const relatedRes = useApiResource(
    () => (article ? contentService.listArticles(article.type) : Promise.resolve<Article[]>([])),
    [article?.id, article?.type],
  );
  const related = (relatedRes.data ?? []).filter((a) => a.id !== article?.id).slice(0, RELATED_COUNT);

  const coverColor = article?.coverColor ?? NEUTRAL_COVER;
  const typeIcon = ARTICLE_TYPE_ICONS[article?.type ?? "news"];

  return (
    <div className="app">
      {/* Cover có nút back + chia sẻ đè lên (không dùng SubHeader) */}
      <div
        style={{
          position: "relative",
          height: COVER_HEIGHT,
          background: coverGradient(coverColor),
          overflow: "hidden",
          flex: "none",
        }}
      >
        <span style={{ position: "absolute", right: -14, bottom: -18, color: "rgba(255,255,255,.2)" }}>
          <Icon name={typeIcon} size={132} strokeWidth={1.2} />
        </span>
        <button style={overlayBtn} onClick={() => navigate(-1)} aria-label="Quay lại">
          <Icon name="back" size={19} color="#fff" />
        </button>
        <button
          style={{ ...overlayBtn, left: "auto", right: 12 }}
          onClick={() => showToast(SHARE_TOAST)}
          aria-label="Chia sẻ"
        >
          <Icon name="send" size={18} color="#fff" />
        </button>
      </div>

      <div className="page plain">
        <DataState
          loading={detail.loading}
          error={detail.error}
          onRetry={detail.reload}
          empty={!article}
          emptyIcon="news"
          emptyMessage={NOT_FOUND}
        >
          {article && (
            <>
              <Chip
                label={ARTICLE_TYPE_LABELS[article.type]}
                color={ARTICLE_TYPE_COLORS[article.type]}
                icon={ARTICLE_TYPE_ICONS[article.type]}
              />
              <h1 style={{ marginTop: 10, lineHeight: 1.35 }}>{article.title}</h1>
              <div className="tiny muted" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <span>{article.publishedAt}</span>
                <span>·</span>
                <Icon name="eye" size={13} />
                <span>{formatNumber(article.views)} lượt xem</span>
              </div>

              <div className="divider" />

              {article.content.split("\n\n").map((p, i) => (
                <p key={i} style={{ marginBottom: 14, lineHeight: 1.75, textAlign: "justify" }}>
                  {p}
                </p>
              ))}

              {related.length > 0 && (
                <>
                  <SectionHead title="Tin liên quan" />
                  <div style={{ display: "grid", gap: 10 }}>
                    {related.map((r) => (
                      <RelatedRow key={r.id} article={r} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </DataState>
      </div>
    </div>
  );
}

/** Bài liên quan — thay thế bài hiện tại trong lịch sử điều hướng */
function RelatedRow({ article }: { article: Article }) {
  const navigate = useNavigate();

  return (
    <div
      className="card card-b tap"
      role="button"
      style={{ display: "flex", gap: 11, alignItems: "center" }}
      onClick={() => navigate(`/news/${article.id}`, { replace: true })}
    >
      <span className="thumb" style={{ width: RELATED_THUMB, height: RELATED_THUMB, background: article.coverColor }}>
        <Icon name={ARTICLE_TYPE_ICONS[article.type]} size={21} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".86rem", fontWeight: 600, color: "var(--navy)", lineHeight: 1.4, ...clampLines(2) }}>
          {article.title}
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          {article.publishedAt}
        </div>
      </div>
      <Icon name="right" size={17} color="var(--mut)" />
    </div>
  );
}
