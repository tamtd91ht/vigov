"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/lib/icons";
import { ApiError } from "@/services/api";
import {
  ACCEPT_BY_PURPOSE,
  FORMAT_HINT_BY_PURPOSE,
  MAX_FILE_SIZE,
  formatFileSize,
  getSignedUrl,
  uploadFile,
  validateFile,
  type FilePurpose,
} from "@/services/files.service";

export interface FileUploadProps {
  /** Mục đích tệp — quyết định MIME được phép và thư mục lưu trên máy chủ */
  purpose: FilePurpose;
  /** Tệp riêng tư chỉ đọc được qua link ký sẵn (bản scan, ảnh phản ánh) */
  isPrivate?: boolean;
  /** Ghi đè danh sách định dạng của thẻ input; mặc định suy từ `purpose` */
  accept?: string;
  /** Gọi khi máy chủ đã nhận tệp — `url` là đường dẫn đọc tệp do backend cấp */
  onUploaded: (fileId: string, url: string, file: File) => void;
  /** Mã tệp đã đính kèm sẵn (mở form sửa, hoặc bản ghi đã có tệp) */
  currentFileId?: string;
  /** Tên tệp hiển thị cho `currentFileId` khi biết trước */
  currentFileName?: string;
  /** Gọi khi cán bộ gỡ tệp đang đính kèm */
  onCleared?: () => void;
  /** Dòng chữ trong ô kéo-thả khi chưa có tệp */
  placeholder?: string;
  /** Chiều cao ô kéo-thả (px) */
  height?: number;
  disabled?: boolean;
}

/** Trạng thái nội bộ của một lượt tải lên */
type Phase = "idle" | "uploading" | "done";

/**
 * Ô tải tệp dùng chung: kéo-thả hoặc bấm chọn, kiểm tra dung lượng và định dạng
 * ngay tại trình duyệt rồi gửi lên `/files/upload` kèm thanh tiến trình thật
 * (lấy từ sự kiện `progress` của XMLHttpRequest).
 */
export function FileUpload({
  purpose,
  isPrivate = false,
  accept,
  onUploaded,
  currentFileId,
  currentFileName,
  onCleared,
  placeholder,
  height = 110,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  /** Tệp vừa tải lên thành công trong phiên này — để hiện tên và dung lượng thật */
  const [uploaded, setUploaded] = useState<{ name: string; size: number } | null>(null);
  const [opening, setOpening] = useState(false);

  const busy = phase === "uploading";
  const attached = phase === "done" || Boolean(currentFileId);

  const pick = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  const send = async (file: File) => {
    const invalid = validateFile(file, purpose);
    if (invalid) {
      setError(invalid);
      setPhase("idle");
      return;
    }

    setError("");
    setPercent(0);
    setPhase("uploading");
    try {
      const result = await uploadFile(file, purpose, isPrivate, setPercent);
      setUploaded({ name: result.originalName, size: result.size });
      setPhase("done");
      onUploaded(result.id, result.url, file);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được tệp lên máy chủ");
      setPhase("idle");
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const file = event.dataTransfer.files[0];
    if (file) void send(file);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled && !busy) setDragging(true);
  };

  /** Mở tệp bằng link ký sẵn — dùng được cho cả tệp công khai lẫn riêng tư */
  const open = async () => {
    const id = currentFileId;
    if (!id) return;
    setOpening(true);
    try {
      const signed = await getSignedUrl(id);
      window.open(signed.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không mở được tệp đính kèm");
    } finally {
      setOpening(false);
    }
  };

  const clear = () => {
    setPhase("idle");
    setUploaded(null);
    setPercent(0);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onCleared?.();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept ?? (ACCEPT_BY_PURPOSE[purpose] || undefined)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Xoá giá trị để chọn lại đúng tệp vừa rồi vẫn kích hoạt onChange
          e.target.value = "";
          if (file) void send(file);
        }}
      />

      {attached && !busy ? (
        <div className="upl-file">
          <span className="ph">
            <Icon name="clip" size={16} />
          </span>
          <span className="nm" title={uploaded?.name ?? currentFileName ?? "Tệp đã đính kèm"}>
            {uploaded?.name ?? currentFileName ?? "Tệp đã đính kèm"}
          </span>
          {uploaded && <span className="sz">{formatFileSize(uploaded.size)}</span>}
          {currentFileId && (
            <button className="btn sm" type="button" disabled={opening} onClick={() => void open()}>
              <Icon name="eye" size={13} />
              {opening ? "Đang mở…" : "Mở tệp"}
            </button>
          )}
          <button className="btn sm" type="button" disabled={disabled} onClick={pick}>
            <Icon name="clip" size={13} />
            Chọn tệp khác
          </button>
          {onCleared && (
            <button
              className="btn sm"
              type="button"
              title="Gỡ tệp đang đính kèm"
              style={{ color: "var(--red)" }}
              disabled={disabled}
              onClick={clear}
            >
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      ) : (
        <div
          className={`upl${dragging ? " drag" : ""}${busy ? " busy" : ""}${error ? " err" : ""}`}
          style={{ height }}
          role="button"
          tabIndex={disabled || busy ? -1 : 0}
          onClick={pick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Icon name={busy ? "clock" : "clip"} size={22} />
          <div>{busy ? `Đang tải lên… ${percent}%` : (placeholder ?? "Kéo-thả tệp vào đây hoặc bấm để chọn")}</div>
          {busy ? (
            <div className="upl-prog">
              <i style={{ width: `${percent}%` }} />
            </div>
          ) : (
            <div className="upl-hint">
              {FORMAT_HINT_BY_PURPOSE[purpose]} · tối đa {formatFileSize(MAX_FILE_SIZE)}
            </div>
          )}
        </div>
      )}

      {error && <div className="ferr">{error}</div>}
    </div>
  );
}
