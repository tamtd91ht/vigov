"use client";

import { useState } from "react";
import type { CmsVideo } from "@/types";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { readMediaDuration, toDurationLabel } from "@/lib/media";
import { fetchVideoTopics } from "@/services/catalogs.service";
import { useApiResource } from "@/hooks/useApiResource";
import { useCatalog } from "@/hooks/useCatalog";
import { ApiError } from "@/services/api";
import { getSignedUrl } from "@/services/files.service";
import { createVideo, deleteVideo, listVideos, updateVideo } from "@/services/content.service";
import { CONTENT_STATUS, TOPIC_GRADIENTS, TOPIC_GRADIENT_FALLBACK, VIDEO_SOURCES } from "./config";

const SOURCE_OPTIONS = [
  { key: "youtube", label: "Nhúng YouTube" },
  { key: "hosted", label: "Tự host (upload)" },
];

/** Số video mỗi lần tải — bản tin của một xã hiếm khi vượt ngưỡng này */
const VIDEO_PAGE_SIZE = 60;

const ACTION_BTN_STYLE = { width: 28, height: 28, borderRadius: 8 } as const;

interface VideoFormState {
  title: string;
  topic: string;
  source: CmsVideo["source"];
  link: string;
  /** Mã tệp video đã tải lên khi chọn nguồn "tự host" */
  videoFileId: string;
  /** Thời lượng "mm:ss" đọc từ siêu dữ liệu tệp video */
  duration: string;
}

/** Chủ đề để trống — mặc định là mục đầu danh mục sau khi tải xong */
const EMPTY_FORM: VideoFormState = { title: "", topic: "", source: "youtube", link: "", videoFileId: "", duration: "" };

export function VideoGrid() {
  const { showToast } = useToast();
  // Danh mục chủ đề lấy từ API (GET /catalogs/video-topics)
  const videoTopics = useCatalog(fetchVideoTopics);
  const videos = useApiResource(() => listVideos({ page: 1, limit: VIDEO_PAGE_SIZE }), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<VideoFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ title?: string; link?: string; file?: string }>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Đổi khoá để dựng lại ô tải tệp mỗi lần mở form (xoá tệp của lượt trước) */
  const [uploadKey, setUploadKey] = useState(0);
  /** Video đang mở bằng link ký sẵn */
  const [openingId, setOpeningId] = useState<string | null>(null);

  const items = videos.data?.items ?? [];
  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  const openForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setUploadKey((k) => k + 1);
    setFormOpen(true);
  };

  /** Mở video tự host trong tab mới bằng link đọc tệp */
  const play = async (video: CmsVideo) => {
    if (video.source === "youtube") {
      if (!video.youtubeUrl) {
        showToast("Video chưa có link YouTube");
        return;
      }
      window.open(video.youtubeUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!video.videoFileId) {
      showToast("Video chưa đính kèm tệp phát");
      return;
    }
    setOpeningId(video.id);
    try {
      const signed = await getSignedUrl(video.videoFileId);
      window.open(signed.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      failed(err, "Không mở được tệp video");
    } finally {
      setOpeningId(null);
    }
  };

  const submit = async () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Vui lòng nhập tiêu đề video";
    if (form.source === "youtube" && !form.link.trim()) next.link = "Vui lòng dán link YouTube của video";
    if (form.source === "hosted" && !form.videoFileId) next.file = "Vui lòng tải lên tệp video";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await createVideo({
        title: form.title.trim(),
        topic: form.topic || videoTopics[0] || "",
        source: form.source,
        youtubeUrl: form.source === "youtube" ? form.link.trim() : undefined,
        videoFileId: form.source === "hosted" ? form.videoFileId : undefined,
        duration: form.source === "hosted" ? form.duration || undefined : undefined,
        status: "draft",
      });
      setFormOpen(false);
      showToast("Đã thêm video mới ở trạng thái nháp");
      videos.reload();
    } catch (err) {
      failed(err, "Không thêm được video");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (video: CmsVideo) => {
    const publishing = video.status === "draft";
    setBusyId(video.id);
    try {
      await updateVideo(video.id, { status: publishing ? "published" : "draft" });
      showToast(publishing ? "Đã đăng video lên Mini App" : "Đã gỡ video khỏi Mini App");
      videos.reload();
    } catch (err) {
      failed(err, "Không đổi được trạng thái video");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (video: CmsVideo) => {
    if (!window.confirm(`Xoá video "${video.title}"?`)) return;
    setBusyId(video.id);
    try {
      await deleteVideo(video.id);
      showToast("Đã xoá video");
      videos.reload();
    } catch (err) {
      failed(err, "Không xoá được video");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div className="sm muted">
          {formatNumber(videos.data?.total ?? 0)} video tuyên truyền · phát trong mục Truyền thông của Mini App
        </div>
        <button className="btn pri" style={{ marginLeft: "auto" }} type="button" onClick={openForm}>
          <Icon name="plus" size={15} />
          Thêm video
        </button>
      </div>

      <DataState
        loading={videos.loading}
        error={videos.error}
        onRetry={videos.reload}
        empty={items.length === 0}
        emptyMessage="Chưa có video tuyên truyền nào"
      >
        <div className="grid3">
          {items.map((v) => {
            const source = VIDEO_SOURCES[v.source];
            const status = CONTENT_STATUS[v.status];
            const busy = busyId === v.id;
            return (
              <div
                className={busy || openingId === v.id ? "fb saving" : "fb"}
                key={v.id}
                onClick={() => void play(v)}
              >
                <div className="img" style={{ background: TOPIC_GRADIENTS[v.topic] ?? TOPIC_GRADIENT_FALLBACK }}>
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,.22)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name="play" size={20} />
                  </span>
                  <span
                    className="tiny"
                    style={{
                      position: "absolute",
                      right: 10,
                      bottom: 8,
                      background: "rgba(0,0,0,.45)",
                      padding: "1px 7px",
                      borderRadius: 6,
                      fontWeight: 700,
                    }}
                  >
                    {v.duration}
                  </span>
                </div>
                <div className="in">
                  <div className="ti">{v.title}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {v.topic && <Chip color="var(--navy)" tint="rgba(27,58,92,.08)">{v.topic}</Chip>}
                    {v.status === "draft" && (
                      <Chip color={status.color} tint={status.tint}>{status.label}</Chip>
                    )}
                  </div>
                  <div className="ft">
                    <span className="tiny muted" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="eye" size={13} />
                      {formatNumber(v.views)} lượt xem
                    </span>
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Chip color={source.color} tint={source.tint}>{source.label}</Chip>
                      <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="icbtn"
                          style={ACTION_BTN_STYLE}
                          type="button"
                          disabled={busy}
                          title={v.status === "published" ? "Gỡ video" : "Đăng video"}
                          onClick={() => togglePublish(v)}
                        >
                          <Icon name={v.status === "published" ? "down" : "send"} size={13} />
                        </button>
                        <button
                          className="icbtn"
                          style={{ ...ACTION_BTN_STYLE, color: "var(--red)" }}
                          type="button"
                          disabled={busy}
                          title="Xoá video"
                          onClick={() => remove(v)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DataState>

      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Thêm video tuyên truyền"
        meta="Video hiển thị trong mục Truyền thông trên Mini App công dân"
        footer={
          <>
            <button className={saving ? "btn pri saving" : "btn pri"} type="button" disabled={saving} onClick={submit}>
              <Icon name="ok" size={15} />
              Lưu video
            </button>
            <button className="btn" type="button" onClick={() => setFormOpen(false)}>
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
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="VD: Hướng dẫn nộp hồ sơ trực tuyến trên Mini App"
          />
          {errors.title && <div className="ferr">{errors.title}</div>}
        </div>

        <div className="fgroup">
          <label>Chủ đề</label>
          <select
            className="finp"
            value={form.topic || videoTopics[0] || ""}
            onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
          >
            {videoTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Câu hỏi mở #19: phương án lưu video — nhúng YouTube (miễn phí, phụ thuộc nền tảng)
            hay tự host trên hạ tầng của xã (chủ động nhưng tốn băng thông/lưu trữ).
            UI hỗ trợ cả hai, chờ khách chốt phương án chính. */}
        <div className="fgroup">
          <label>Nguồn video</label>
          <SegmentControl
            options={SOURCE_OPTIONS}
            value={form.source}
            onChange={(key) => setForm((p) => ({ ...p, source: key as CmsVideo["source"] }))}
          />
        </div>

        {form.source === "youtube" ? (
          <div className="fgroup">
            <label>
              Link YouTube <span className="req">*</span>
            </label>
            <input
              className={`finp ${errors.link ? "err" : ""}`}
              value={form.link}
              onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
              placeholder="https://youtube.com/watch?v=…"
            />
            {errors.link && <div className="ferr">{errors.link}</div>}
          </div>
        ) : (
          <div className="fgroup">
            <label>
              Tệp video <span className="req">*</span>
            </label>
            <FileUpload
              key={uploadKey}
              purpose="video"
              placeholder="Kéo-thả tệp video vào đây hoặc bấm để chọn"
              onUploaded={(fileId, _url, file) => {
                setErrors((p) => ({ ...p, file: undefined }));
                setForm((p) => ({ ...p, videoFileId: fileId }));
                void readMediaDuration(file, "video").then((seconds) =>
                  setForm((p) => ({ ...p, duration: toDurationLabel(seconds) })),
                );
              }}
              onCleared={() => setForm((p) => ({ ...p, videoFileId: "", duration: "" }))}
              disabled={saving}
            />
            {errors.file && <div className="ferr">{errors.file}</div>}
            {form.duration && <div className="fhint">Thời lượng đọc từ tệp: {form.duration}</div>}
          </div>
        )}

        <div className="note" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ marginTop: 2 }}>
            <Icon name="alert" size={15} />
          </span>
          <span>
            Thời lượng được đọc trực tiếp từ tệp video tải lên; video nhúng YouTube lấy thời lượng và ảnh đại diện từ
            nền tảng.
          </span>
        </div>
      </Drawer>
    </>
  );
}
