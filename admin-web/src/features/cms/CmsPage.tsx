"use client";

/* ============================================================
   CMS nội dung Mobile — WBS #10
   Quản lý tin bài / video / truyền thanh hiển thị trên Mini App
   công dân và gửi thông báo broadcast (ZNS / Push).

   Nguồn dữ liệu: /content/* và /notifications/broadcast.
   Lịch sử gửi vẫn dùng dữ liệu mẫu — backend chưa có endpoint
   liệt kê các lượt broadcast đã thực hiện.

   Câu hỏi mở #14: quy trình biên tập chưa chốt — ai được đăng
   trực tiếp, ai chỉ soạn nháp chờ lãnh đạo duyệt.
   ============================================================ */

import { useState } from "react";
import type { CmsArticle } from "@/types";
import { PageHead } from "@/components/ui/PageHead";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { fetchBroadcastLogs } from "@/services/notifications.service";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  createArticle,
  deleteArticle,
  listArticles,
  publishArticle,
  sendBroadcast,
  updateArticle,
} from "@/services/content.service";
import { ArticleTable } from "./ArticleTable";
import { ArticleForm, type ArticleFormValue } from "./ArticleForm";
import { VideoGrid } from "./VideoGrid";
import { RadioList } from "./RadioList";
import { BroadcastPanel, type BroadcastFormValue } from "./BroadcastPanel";
import { BroadcastHistory } from "./BroadcastHistory";

const TAB_ITEMS = [
  { key: "articles", label: "Tin tức & Sự kiện" },
  { key: "videos", label: "Video" },
  { key: "radio", label: "Truyền thanh" },
  { key: "broadcast", label: "Gửi thông báo" },
  { key: "history", label: "Lịch sử gửi" },
];

/** Số bài viết mỗi trang gửi lên tham số `limit` */
const ARTICLE_PAGE_SIZE = 20;


export function CmsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("articles");

  // --- Tin tức & Sự kiện: bộ lọc và phân trang đều là tham số truy vấn ---
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const articles = useApiResource(
    () =>
      listArticles({
        type: typeFilter === "all" ? undefined : typeFilter,
        page,
        limit: ARTICLE_PAGE_SIZE,
      }),
    [typeFilter, page],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CmsArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // --- Broadcast: gửi và lịch sử đều qua API (GET /notifications/broadcasts) ---
  const logs = useApiResource(fetchBroadcastLogs, []);
  const [sending, setSending] = useState(false);

  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  const changeTypeFilter = (key: string) => {
    setTypeFilter(key);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (article: CmsArticle) => {
    setEditing(article);
    setFormOpen(true);
  };

  const saveArticle = async (value: ArticleFormValue) => {
    setSaving(true);
    try {
      if (editing) {
        await updateArticle(editing.id, {
          type: value.type,
          title: value.title,
          category: value.category,
          excerpt: value.excerpt,
          content: value.content,
          // Gửi cả chuỗi rỗng để backend gỡ ảnh bìa khi cán bộ bỏ ảnh
          coverFileId: value.coverFileId,
        });
        // PATCH bài viết không đổi trạng thái phát hành — dùng endpoint publish riêng
        if (value.status !== editing.status) await publishArticle(editing.id, value.status);
        showToast("Đã lưu thay đổi bài viết");
      } else {
        await createArticle(value);
        showToast(value.status === "published" ? "Đã đăng bài viết mới lên Mini App" : "Đã lưu bài viết nháp");
      }
      setFormOpen(false);
      articles.reload();
    } catch (err) {
      failed(err, "Không lưu được bài viết");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (article: CmsArticle) => {
    const publishing = article.status === "draft";
    setBusyId(article.id);
    try {
      await publishArticle(article.id, publishing ? "published" : "draft");
      showToast(publishing ? "Đã đăng bài viết lên Mini App" : "Đã gỡ bài viết khỏi Mini App");
      articles.reload();
    } catch (err) {
      failed(err, "Không đổi được trạng thái bài viết");
    } finally {
      setBusyId(null);
    }
  };

  const removeArticle = async (article: CmsArticle) => {
    if (!window.confirm(`Xoá vĩnh viễn bài viết "${article.title}"?`)) return;
    setBusyId(article.id);
    try {
      await deleteArticle(article.id);
      showToast("Đã xoá bài viết");
      articles.reload();
    } catch (err) {
      failed(err, "Không xoá được bài viết");
    } finally {
      setBusyId(null);
    }
  };

  const submitBroadcast = async (value: BroadcastFormValue) => {
    setSending(true);
    try {
      const result = await sendBroadcast({
        channels: [value.channel],
        audience: value.audience,
        title: value.title,
        body: value.body,
      });
      // Tải lại từ máy chủ thay vì tự dựng bản ghi: số đã gửi / thất bại còn
      // thay đổi sau khi nhà cung cấp trả kết quả, và id do máy chủ cấp.
      logs.reload();
      setTab("history");
      showToast(`Đã gửi thông báo tới ${formatNumber(result.ok)}/${formatNumber(result.total)} người nhận`);
    } catch (err) {
      failed(err, "Không gửi được thông báo hàng loạt");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pg">
      <PageHead
        title="Nội dung Mobile"
        sub="Quản lý tin bài, video, truyền thanh và thông báo gửi công dân trên Mini App"
        actions={
          tab === "articles" ? (
            <button className="btn pri" type="button" onClick={openCreate}>
              <Icon name="plus" size={15} />
              Viết bài mới
            </button>
          ) : undefined
        }
      />

      <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />

      {tab === "articles" && (
        <ArticleTable
          articles={articles.data?.items ?? []}
          loading={articles.loading}
          error={articles.error}
          onRetry={articles.reload}
          typeFilter={typeFilter}
          onTypeFilterChange={changeTypeFilter}
          page={articles.data?.page ?? page}
          totalPages={articles.data?.totalPages ?? 1}
          total={articles.data?.total ?? 0}
          onPageChange={setPage}
          busyId={busyId}
          onEdit={openEdit}
          onToggleStatus={toggleStatus}
          onDelete={removeArticle}
        />
      )}
      {tab === "videos" && <VideoGrid />}
      {tab === "radio" && <RadioList />}
      {tab === "broadcast" && <BroadcastPanel sending={sending} onSend={submitBroadcast} />}
      {tab === "history" && <BroadcastHistory logs={logs.data ?? []} />}

      <ArticleForm
        open={formOpen}
        article={editing}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSave={saveArticle}
      />
    </div>
  );
}
