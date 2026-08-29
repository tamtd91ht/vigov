"use client";

import { useState } from "react";
import type { CmsArticle } from "@/types";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { SignedImage } from "@/components/ui/SignedImage";
import { Icon } from "@/lib/icons";
import { fetchArticleCategories } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { ARTICLE_TYPES } from "./config";

/** Dữ liệu form gửi lên khi lưu — phần còn lại (id, tác giả, ngày, lượt xem) do trang cha quyết định */
export interface ArticleFormValue {
  title: string;
  type: CmsArticle["type"];
  category: string;
  excerpt: string;
  content: string;
  /** Mã tệp ảnh bìa; chuỗi rỗng = không có ảnh bìa */
  coverFileId: string;
  status: CmsArticle["status"];
}

const EMPTY_VALUE: ArticleFormValue = {
  title: "",
  type: "news",
  // Bỏ trống — chuyên mục mặc định là mục đầu danh mục sau khi tải xong
  category: "",
  excerpt: "",
  content: "",
  coverFileId: "",
  status: "draft",
};

export function ArticleForm({
  open,
  article,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  /** null = viết bài mới */
  article: CmsArticle | null;
  /** true khi đang gọi API lưu — khoá nút để tránh gửi trùng */
  saving: boolean;
  onClose: () => void;
  onSave: (value: ArticleFormValue) => void;
}) {
  // Danh mục chuyên mục lấy từ API (GET /catalogs/article-categories)
  const articleCategories = useCatalog(fetchArticleCategories);

  const [value, setValue] = useState<ArticleFormValue>(EMPTY_VALUE);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  // Nạp lại form mỗi lần mở drawer (điều chỉnh state trong render)
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = open ? `${article?.id ?? "new"}` : null;
  if (open && currentKey !== loadedKey) {
    setLoadedKey(currentKey);
    setErrors({});
    setValue(
      article
        ? {
            title: article.title,
            type: article.type,
            category: article.category,
            excerpt: article.excerpt,
            content: article.content,
            coverFileId: article.coverFileId ?? "",
            status: article.status,
          }
        : EMPTY_VALUE,
    );
  }
  if (!open && loadedKey !== null) setLoadedKey(null);

  const set = <K extends keyof ArticleFormValue>(key: K, v: ArticleFormValue[K]) => setValue((prev) => ({ ...prev, [key]: v }));

  const submit = () => {
    const next: typeof errors = {};
    if (!value.title.trim()) next.title = "Vui lòng nhập tiêu đề bài viết";
    if (!value.content.trim()) next.content = "Vui lòng nhập nội dung bài viết";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave({
      ...value,
      title: value.title.trim(),
      category: value.category || articleCategories[0] || "",
      excerpt: value.excerpt.trim(),
      content: value.content.trim(),
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={article ? "Sửa bài viết" : "Viết bài mới"}
      meta={article ? `${article.author} · ${article.publishedAt || "chưa đăng"}` : "Bài viết sẽ hiển thị trên Mini App công dân"}
      footer={
        <>
          <button className={saving ? "btn pri saving" : "btn pri"} type="button" disabled={saving} onClick={submit}>
            <Icon name="ok" size={15} />
            {article ? "Lưu thay đổi" : "Lưu bài viết"}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      <div className="fgroup">
        <label>
          Tiêu đề <span className="req">*</span>
        </label>
        <input
          className={`finp ${errors.title ? "err" : ""}`}
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="VD: Xã Đại Thắng ra mắt mô hình camera an ninh thôn xóm"
        />
        {errors.title && <div className="ferr">{errors.title}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="fgroup">
          <label>Loại bài</label>
          <select className="finp" value={value.type} onChange={(e) => set("type", e.target.value as CmsArticle["type"])}>
            {(Object.keys(ARTICLE_TYPES) as CmsArticle["type"][]).map((t) => (
              <option key={t} value={t}>
                {ARTICLE_TYPES[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="fgroup">
          <label>Chuyên mục</label>
          <select
            className="finp"
            value={value.category || articleCategories[0] || ""}
            onChange={(e) => set("category", e.target.value)}
          >
            {articleCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ảnh bìa công khai: Mini App nhúng thẳng bằng thẻ <img> nên không đặt riêng tư */}
      <div className="fgroup">
        <label>Ảnh bìa</label>
        {value.coverFileId && (
          <div className="upl-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 8 }}>
            <div className="th">
              <SignedImage fileId={value.coverFileId} alt="Ảnh bìa bài viết" />
            </div>
          </div>
        )}
        <FileUpload
          key={loadedKey ?? "new"}
          purpose="cover"
          height={96}
          placeholder="Kéo-thả ảnh bìa vào đây hoặc bấm để chọn"
          currentFileId={value.coverFileId || undefined}
          onUploaded={(fileId) => set("coverFileId", fileId)}
          onCleared={() => set("coverFileId", "")}
          disabled={saving}
        />
        <div className="fhint">Không chọn ảnh bìa thì Mini App dùng nền màu theo chuyên mục.</div>
      </div>

      <div className="fgroup">
        <label>Tóm tắt</label>
        <textarea
          className="finp"
          style={{ minHeight: 64 }}
          value={value.excerpt}
          onChange={(e) => set("excerpt", e.target.value)}
          placeholder="Đoạn mô tả ngắn hiển thị ở danh sách tin trên Mini App"
        />
      </div>

      <div className="fgroup">
        <label>
          Nội dung <span className="req">*</span>
        </label>
        <textarea
          className={`finp ${errors.content ? "err" : ""}`}
          style={{ minHeight: 180 }}
          value={value.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Nội dung đầy đủ của bài viết…"
        />
        {errors.content && <div className="ferr">{errors.content}</div>}
        <div className="fhint">Trình soạn thảo định dạng (ảnh, heading) sẽ tích hợp khi nối API CMS.</div>
      </div>

      <div className="fgroup">
        <label>Trạng thái</label>
        <select className="finp" value={value.status} onChange={(e) => set("status", e.target.value as CmsArticle["status"])}>
          <option value="draft">Nháp — chưa hiển thị trên Mini App</option>
          <option value="published">Đã đăng — công khai với công dân</option>
        </select>
      </div>
    </Drawer>
  );
}
