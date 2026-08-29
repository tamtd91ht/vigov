import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Note } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { zaloService } from "@/services/zalo";

/** Giới hạn nhập liệu — thống nhất với Web Quản trị */
export const MAX_TITLE_LEN = 120;
export const MAX_DESC_LEN = 1000;

/** Màu placeholder cho ảnh mock, dùng xoay vòng theo số ảnh đã thêm */
const IMAGE_COLORS = ["var(--blue)", "var(--green)", "var(--purple)", "var(--orange)", "var(--teal)"];

const THUMB_RATIO = "1 / 1";
const COORD_DIGITS = 5;

/** Trạng thái lấy vị trí hiện trường */
export interface LocationState {
  status: "idle" | "loading" | "granted" | "denied";
  address: string;
  lat?: number;
  lng?: number;
}

/** Lỗi validate của bước 2 */
export interface DetailErrors {
  title?: string;
  description?: string;
  address?: string;
}

interface DetailStepProps {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  images: string[];
  onImagesChange: (next: string[]) => void;
  location: LocationState;
  onAddressChange: (value: string) => void;
  editingAddress: boolean;
  onToggleEditAddress: () => void;
  errors: DetailErrors;
}

/** Bước 2 — nội dung phản ánh, ảnh hiện trường và vị trí */
export function DetailStep({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  images,
  onImagesChange,
  location,
  onAddressChange,
  editingAddress,
  onToggleEditAddress,
  errors,
}: DetailStepProps) {
  const [adding, setAdding] = useState(false);
  const canAddImage = images.length < appConfig.maxFeedbackImages;

  /**
   * Mock chọn ảnh: chỉ thêm một ô màu placeholder.
   * chooseImage thật của Zalo SDK (sdk.chooseImage + upload lên server) thuộc hệ tích hợp ngoài.
   */
  async function handleAddImage() {
    if (adding || !canAddImage) return;
    setAdding(true);
    const ok = await zaloService.chooseImage();
    setAdding(false);
    if (!ok) return;
    onImagesChange([...images, IMAGE_COLORS[images.length % IMAGE_COLORS.length]]);
  }

  return (
    <>
      <div className="fgroup">
        <label htmlFor="fb-title">
          Tiêu đề <span className="req">*</span>
        </label>
        <input
          id="fb-title"
          className={`finp ${errors.title ? "err" : ""}`}
          value={title}
          maxLength={MAX_TITLE_LEN}
          placeholder="Ví dụ: Rác tồn đọng tại đầu ngõ 12"
          onChange={(e) => onTitleChange(e.target.value.slice(0, MAX_TITLE_LEN))}
        />
        {errors.title && <div className="ferr">{errors.title}</div>}
      </div>

      <div className="fgroup">
        <label htmlFor="fb-desc">
          Mô tả chi tiết <span className="req">*</span>
        </label>
        <textarea
          id="fb-desc"
          className={`finp ${errors.description ? "err" : ""}`}
          value={description}
          maxLength={MAX_DESC_LEN}
          placeholder="Mô tả sự việc, thời điểm xảy ra và mức độ ảnh hưởng…"
          onChange={(e) => onDescriptionChange(e.target.value.slice(0, MAX_DESC_LEN))}
        />
        <div className="counter">
          {description.length}/{MAX_DESC_LEN}
        </div>
        {errors.description && <div className="ferr">{errors.description}</div>}
      </div>

      <div className="fgroup">
        <label>Ảnh hiện trường</label>
        <div className="grid3">
          {images.map((color, i) => (
            <div
              key={`${color}-${i}`}
              className="thumb"
              style={{ aspectRatio: THUMB_RATIO, background: color, position: "relative" }}
            >
              <Icon name="image" size={24} color="rgba(255,255,255,.85)" />
              <button
                type="button"
                aria-label={`Xoá ảnh ${i + 1}`}
                onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))}
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,.45)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="close" size={14} strokeWidth={2.4} />
              </button>
            </div>
          ))}

          {canAddImage && (
            <button
              type="button"
              onClick={handleAddImage}
              disabled={adding}
              style={{
                aspectRatio: THUMB_RATIO,
                border: "1.5px dashed var(--bd)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg2)",
                color: "var(--mut)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {adding ? (
                <span className="spin dark" />
              ) : (
                <>
                  <Icon name="camera" size={21} />
                  <span className="tiny" style={{ fontWeight: 600 }}>
                    Thêm ảnh
                  </span>
                </>
              )}
            </button>
          )}
        </div>
        <div className="fhint">
          Tối đa {appConfig.maxFeedbackImages} ảnh · đã chọn {images.length}
        </div>
      </div>

      <div className="fgroup">
        <label>
          Vị trí xảy ra sự việc {location.status === "denied" && <span className="req">*</span>}
        </label>

        {(location.status === "idle" || location.status === "loading") && (
          <div className="card card-b" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="spin dark" />
            <span className="sm muted">Đang xác định vị trí…</span>
          </div>
        )}

        {location.status === "granted" && (
          <div className="card card-b">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon name="pin" size={20} color="var(--pink)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingAddress ? (
                  <input
                    className="finp"
                    value={location.address}
                    placeholder="Nhập địa chỉ cụ thể"
                    onChange={(e) => onAddressChange(e.target.value)}
                  />
                ) : (
                  <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: ".9rem" }}>
                    {location.address || "Chưa có địa chỉ"}
                  </div>
                )}
                {location.lat !== undefined && location.lng !== undefined && (
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {location.lat.toFixed(COORD_DIGITS)}, {location.lng.toFixed(COORD_DIGITS)}
                  </div>
                )}
              </div>
              <button type="button" className="btn sm" onClick={onToggleEditAddress}>
                <Icon name={editingAddress ? "check" : "edit"} size={15} />
                {editingAddress ? "Xong" : "Sửa"}
              </button>
            </div>
          </div>
        )}

        {location.status === "denied" && (
          <>
            <Note color="var(--orange)" icon="alert">
              Không truy cập được vị trí — vui lòng nhập địa chỉ
            </Note>
            <input
              className={`finp ${errors.address ? "err" : ""}`}
              style={{ marginTop: 10 }}
              value={location.address}
              placeholder="Ví dụ: Ngõ 12, Thôn Đông"
              onChange={(e) => onAddressChange(e.target.value)}
            />
            {errors.address && <div className="ferr">{errors.address}</div>}
          </>
        )}
      </div>
    </>
  );
}
