"use client";

import type { CmsArticle } from "@/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { DataState } from "@/components/ui/DataState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { ARTICLE_TYPES, CONTENT_STATUS } from "./config";

/** Chip lọc theo loại bài — key trùng CmsArticle["type"], gửi thẳng lên tham số `type` */
const TYPE_FILTERS = (Object.keys(ARTICLE_TYPES) as CmsArticle["type"][]).map((key) => ({
  key,
  label: ARTICLE_TYPES[key].label,
}));

const ACTION_BTN_STYLE = { width: 30, height: 30, borderRadius: 8 } as const;

export interface ArticleTableProps {
  articles: CmsArticle[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  typeFilter: string;
  onTypeFilterChange: (key: string) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Id bài viết đang có thao tác ghi dở dang */
  busyId: string | null;
  onEdit: (article: CmsArticle) => void;
  onToggleStatus: (article: CmsArticle) => void;
  onDelete: (article: CmsArticle) => void;
}

export function ArticleTable({
  articles,
  loading,
  error,
  onRetry,
  typeFilter,
  onTypeFilterChange,
  page,
  totalPages,
  total,
  onPageChange,
  busyId,
  onEdit,
  onToggleStatus,
  onDelete,
}: ArticleTableProps) {
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <FilterChips chips={TYPE_FILTERS} active={typeFilter} onChange={onTypeFilterChange} />
      </div>
      <Card>
        <DataState
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={articles.length === 0}
          emptyMessage="Chưa có bài viết nào thuộc loại này"
        >
          <div className="tw">
            <table className="tb2">
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Loại</th>
                  <th>Chuyên mục</th>
                  <th>Tác giả</th>
                  <th>Ngày đăng</th>
                  <th>Lượt xem</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 130 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => {
                  const type = ARTICLE_TYPES[a.type];
                  const status = CONTENT_STATUS[a.status];
                  const busy = busyId === a.id;
                  return (
                    <tr key={a.id} className={busy ? "saving" : undefined} onClick={() => onEdit(a)}>
                      <td style={{ minWidth: 260 }}>
                        <div className="tt">{a.title}</div>
                        <div className="tiny muted" style={{ marginTop: 2 }}>{a.excerpt}</div>
                      </td>
                      <td>
                        <Chip color={type.color} tint={type.tint}>{type.label}</Chip>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{a.category}</td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                          <Avatar name={a.author} />
                          {a.author}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{a.publishedAt || <span className="muted">—</span>}</td>
                      <td>{a.status === "published" ? formatNumber(a.views) : <span className="muted">—</span>}</td>
                      <td>
                        <Chip color={status.color} tint={status.tint} dot>{status.label}</Chip>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="icbtn" style={ACTION_BTN_STYLE} title="Sửa bài viết" type="button" onClick={() => onEdit(a)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="icbtn"
                            style={ACTION_BTN_STYLE}
                            title={a.status === "published" ? "Gỡ bài" : "Đăng bài"}
                            type="button"
                            disabled={busy}
                            onClick={() => onToggleStatus(a)}
                          >
                            <Icon name={a.status === "published" ? "down" : "send"} size={14} />
                          </button>
                          <button
                            className="icbtn"
                            style={{ ...ACTION_BTN_STYLE, color: "var(--red)" }}
                            title="Xoá bài viết"
                            type="button"
                            disabled={busy}
                            onClick={() => onDelete(a)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <span className="sm muted">
            Trang {page}/{totalPages} · {formatNumber(total)} bài viết
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn sm" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Trang trước
            </button>
            <button
              className="btn sm"
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Trang sau
            </button>
          </span>
        </div>
      )}
    </>
  );
}
