"use client";

import { useMemo, useState } from "react";
import type { RadioBulletin } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { readMediaDuration, toDurationLabel } from "@/lib/media";
import { fetchRadioCategories } from "@/services/catalogs.service";
import { useApiResource } from "@/hooks/useApiResource";
import { useCatalog } from "@/hooks/useCatalog";
import { ApiError } from "@/services/api";
import { getSignedUrl } from "@/services/files.service";
import { createRadio, deleteRadio, listRadio, updateRadio } from "@/services/content.service";
import { CONTENT_STATUS, todayStamp } from "./config";

/** Số bản tin tải mỗi lần — đủ cho lịch phát vài tháng của một xã */
const RADIO_PAGE_SIZE = 80;

const ACTION_BTN_STYLE = { width: 28, height: 28, borderRadius: 8 } as const;

interface RadioFormState {
  title: string;
  category: string;
  /** Mã tệp âm thanh đã tải lên */
  audioFileId: string;
  /** Thời lượng đọc từ tệp, tính bằng giây */
  durationSeconds: number;
}

/** Chuyên mục để trống — mặc định là mục đầu danh mục sau khi tải xong */
const EMPTY_FORM: RadioFormState = { title: "", category: "", audioFileId: "", durationSeconds: 0 };

export function RadioList() {
  const { showToast } = useToast();
  // Danh mục chuyên mục lấy từ API (GET /catalogs/radio-categories)
  const radioCategories = useCatalog(fetchRadioCategories);
  const radio = useApiResource(() => listRadio({ page: 1, limit: RADIO_PAGE_SIZE }), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RadioFormState>(EMPTY_FORM);
  const [titleError, setTitleError] = useState("");
  const [audioError, setAudioError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Đổi khoá để dựng lại ô tải tệp mỗi lần mở form */
  const [uploadKey, setUploadKey] = useState(0);
  /** Bản tin đang mở bằng link đọc tệp */
  const [openingId, setOpeningId] = useState<string | null>(null);

  const bulletins = useMemo(() => radio.data?.items ?? [], [radio.data]);
  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  /** Nhóm bản tin theo ngày, giữ nguyên thứ tự máy chủ trả về (mới → cũ) */
  const groups = useMemo(() => {
    const map = new Map<string, RadioBulletin[]>();
    for (const b of bulletins) {
      const key = b.date || "Chưa đặt ngày phát";
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    return Array.from(map.entries());
  }, [bulletins]);

  const openForm = () => {
    setForm(EMPTY_FORM);
    setTitleError("");
    setAudioError("");
    setUploadKey((k) => k + 1);
    setFormOpen(true);
  };

  /** Mở tệp âm thanh trong tab mới — trình duyệt tự dựng trình phát */
  const play = async (bulletin: RadioBulletin) => {
    if (!bulletin.audioFileId) {
      showToast("Bản tin chưa đính kèm tệp âm thanh");
      return;
    }
    setOpeningId(bulletin.id);
    try {
      const signed = await getSignedUrl(bulletin.audioFileId);
      window.open(signed.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      failed(err, "Không mở được tệp âm thanh");
    } finally {
      setOpeningId(null);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setTitleError("Vui lòng nhập tiêu đề bản tin");
      return;
    }
    if (!form.audioFileId) {
      setAudioError("Vui lòng tải lên tệp âm thanh của bản tin");
      return;
    }
    setSaving(true);
    try {
      await createRadio({
        title: form.title.trim(),
        category: form.category || radioCategories[0] || "",
        date: todayStamp(),
        audioFileId: form.audioFileId,
        durationSeconds: form.durationSeconds || undefined,
        status: "draft",
      });
      setFormOpen(false);
      showToast("Đã thêm bản tin truyền thanh ở trạng thái nháp");
      radio.reload();
    } catch (err) {
      failed(err, "Không thêm được bản tin truyền thanh");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (bulletin: RadioBulletin) => {
    const publishing = bulletin.status === "draft";
    setBusyId(bulletin.id);
    try {
      await updateRadio(bulletin.id, { status: publishing ? "published" : "draft" });
      showToast(publishing ? "Đã phát hành bản tin" : "Đã chuyển bản tin về trạng thái nháp");
      radio.reload();
    } catch (err) {
      failed(err, "Không đổi được trạng thái bản tin");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (bulletin: RadioBulletin) => {
    if (!window.confirm(`Xoá bản tin "${bulletin.title}"?`)) return;
    setBusyId(bulletin.id);
    try {
      await deleteRadio(bulletin.id);
      showToast("Đã xoá bản tin truyền thanh");
      radio.reload();
    } catch (err) {
      failed(err, "Không xoá được bản tin");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div className="sm muted">Bản tin phát trên loa truyền thanh xã và nghe lại được trong Mini App</div>
        <button className="btn pri" style={{ marginLeft: "auto" }} type="button" onClick={openForm}>
          <Icon name="plus" size={15} />
          Thêm bản tin
        </button>
      </div>

      <DataState
        loading={radio.loading}
        error={radio.error}
        onRetry={radio.reload}
        empty={bulletins.length === 0}
        emptyMessage="Chưa có bản tin truyền thanh nào"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map(([date, items]) => (
            <Card key={date}>
              <CardHeader title={`Ngày ${date}`} extra={<span>{items.length} bản tin</span>} />
              <div className="rows">
                {items.map((b) => {
                  const status = CONTENT_STATUS[b.status];
                  const busy = busyId === b.id;
                  return (
                    <div
                      className={busy || openingId === b.id ? "row-it saving" : "row-it"}
                      key={b.id}
                      style={{ alignItems: "center" }}
                      onClick={() => void play(b)}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "rgba(59,130,196,.12)",
                          color: "var(--blue)",
                          display: "grid",
                          placeItems: "center",
                          flex: "none",
                        }}
                      >
                        <Icon name="play" size={16} />
                      </span>
                      <div style={{ flex: 1 }}>
                        <div className="t">{b.title}</div>
                        <div className="m" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Icon name="clock" size={12} />
                            {b.duration}
                          </span>
                          <span>{formatNumber(b.plays)} lượt nghe</span>
                        </div>
                      </div>
                      {b.category && <Chip color="var(--navy)" tint="rgba(27,58,92,.08)">{b.category}</Chip>}
                      <Chip color={status.color} tint={status.tint} dot>{status.label}</Chip>
                      <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="icbtn"
                          style={ACTION_BTN_STYLE}
                          type="button"
                          disabled={busy}
                          title={b.status === "published" ? "Chuyển về nháp" : "Phát hành bản tin"}
                          onClick={() => togglePublish(b)}
                        >
                          <Icon name={b.status === "published" ? "down" : "send"} size={13} />
                        </button>
                        <button
                          className="icbtn"
                          style={{ ...ACTION_BTN_STYLE, color: "var(--red)" }}
                          type="button"
                          disabled={busy}
                          title="Xoá bản tin"
                          onClick={() => remove(b)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </DataState>

      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Thêm bản tin truyền thanh"
        meta="Bản tin phát trên hệ thống loa xã và lưu để công dân nghe lại"
        footer={
          <>
            <button className={saving ? "btn pri saving" : "btn pri"} type="button" disabled={saving} onClick={submit}>
              <Icon name="ok" size={15} />
              Lưu bản tin
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
            className={`finp ${titleError ? "err" : ""}`}
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="VD: Bản tin thời sự xã sáng 27/8"
          />
          {titleError && <div className="ferr">{titleError}</div>}
        </div>

        <div className="fgroup">
          <label>Chuyên mục</label>
          <select
            className="finp"
            value={form.category || radioCategories[0] || ""}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          >
            {radioCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="fgroup">
          <label>
            Tệp âm thanh <span className="req">*</span>
          </label>
          <FileUpload
            key={uploadKey}
            purpose="audio"
            placeholder="Kéo-thả tệp âm thanh vào đây hoặc bấm để chọn"
            onUploaded={(fileId, _url, file) => {
              setAudioError("");
              setForm((p) => ({ ...p, audioFileId: fileId }));
              void readMediaDuration(file, "audio").then((seconds) =>
                setForm((p) => ({ ...p, durationSeconds: Math.round(seconds) })),
              );
            }}
            onCleared={() => setForm((p) => ({ ...p, audioFileId: "", durationSeconds: 0 }))}
            disabled={saving}
          />
          {audioError && <div className="ferr">{audioError}</div>}
          <div className="fhint">
            {form.durationSeconds
              ? `Thời lượng đọc từ tệp: ${toDurationLabel(form.durationSeconds)}`
              : "Thời lượng được đọc tự động từ tệp âm thanh sau khi tải lên."}
          </div>
        </div>
      </Drawer>
    </>
  );
}
