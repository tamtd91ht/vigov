import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Note } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { LocationPreviewMap } from "@/components/LocationPreviewMap";
import type { PickedImage } from "./usePickedImages";

/** Giới hạn nhập liệu — thống nhất với Web Quản trị */
export const MAX_TITLE_LEN = 120;
export const MAX_DESC_LEN = 1000;

const THUMB_RATIO = "1 / 1";
const COORD_DIGITS = 5;

/** Sai số vượt ngưỡng này thì nói thẳng là điểm còn thô, đừng để người dùng tin nhầm */
const COARSE_ACCURACY_M = 100;

/** Nhãn nguồn toạ độ — người thử cần biết điểm trên bản đồ do đâu mà có */
const LOCATION_SOURCE_LABEL: Record<"zalo" | "browser" | "mock", string> = {
  browser: "GPS thiết bị",
  zalo: "dịch vụ Zalo",
  mock: "dữ liệu mẫu",
};

/** Trạng thái lấy vị trí hiện trường */
export interface LocationState {
  status: "idle" | "loading" | "granted" | "denied";
  address: string;
  lat?: number;
  lng?: number;
  /** Bán kính sai số (mét) do thiết bị khai */
  accuracy?: number;
  /** Nguồn toạ độ — hiện ra để người thử biết đường nào đang chạy */
  source?: "zalo" | "browser" | "mock";
  /** Mã định vị của Zalo — backend đổi ra toạ độ ở P3-26 */
  token?: string;
  /** Lý do thất bại nguyên văn từ SDK, hiện ra để người thử đọc được */
  error?: string;
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
  /** Ảnh đã chọn kèm trạng thái tải lên của từng ảnh */
  images: PickedImage[];
  /** Mở trình chọn ảnh của Zalo rồi tải những ảnh vừa chọn */
  onPickImages: () => void;
  /** Tải lại một ảnh đã thất bại */
  onRetryImage: (key: string) => void;
  onRemoveImage: (key: string) => void;
  /** Đang mở trình chọn ảnh */
  picking: boolean;
  location: LocationState;
  onAddressChange: (value: string) => void;
  editingAddress: boolean;
  onToggleEditAddress: () => void;
  onRetryLocation: () => void;
  errors: DetailErrors;
}

/** Bước 2 — nội dung phản ánh, ảnh hiện trường và vị trí */
export function DetailStep({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  images,
  onPickImages,
  onRetryImage,
  onRemoveImage,
  picking,
  location,
  onAddressChange,
  editingAddress,
  onToggleEditAddress,
  onRetryLocation,
  errors,
}: DetailStepProps) {
  const canAddImage = images.length < appConfig.maxFeedbackImages;
  const hasPoint = location.lat !== undefined && location.lng !== undefined;

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
          {images.map((image, i) => (
            <AttachmentThumb
              key={image.key}
              uri={image.uri}
              index={i}
              style={{
                aspectRatio: THUMB_RATIO,
                position: "relative",
                // Viền đỏ để thấy ngay ô nào hỏng, không phải đọc chữ mới biết
                outline: image.status === "error" ? "2px solid var(--red)" : undefined,
              }}
            >
              {/* Lớp phủ trạng thái: đang tải thì làm mờ ảnh và quay vòng,
                  thất bại thì cho bấm để thử lại đúng ảnh đó */}
              {image.status === "uploading" && <ThumbOverlay><span className="spin" /></ThumbOverlay>}
              {image.status === "error" && (
                <ThumbOverlay>
                  <button
                    type="button"
                    aria-label={`Thử tải lại ảnh ${i + 1}`}
                    onClick={() => onRetryImage(image.key)}
                    style={{ color: "#fff", display: "grid", placeItems: "center", gap: 2 }}
                  >
                    <Icon name="refresh" size={20} color="#fff" />
                    <span className="tiny" style={{ fontWeight: 700 }}>
                      Thử lại
                    </span>
                  </button>
                </ThumbOverlay>
              )}

              <button
                type="button"
                aria-label={`Xoá ảnh ${i + 1}`}
                onClick={() => onRemoveImage(image.key)}
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,.5)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  zIndex: 3,
                }}
              >
                <Icon name="close" size={14} strokeWidth={2.4} />
              </button>
            </AttachmentThumb>
          ))}

          {canAddImage && (
            <button
              type="button"
              onClick={onPickImages}
              disabled={picking}
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
              {picking ? (
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

        {/* Lý do thất bại phải hiện thành chữ: người dân cầm điện thoại không
            mở được console, mà "thử lại" mãi không xong thì cần biết vì sao */}
        {images
          .filter((image) => image.status === "error")
          .map((image, i) => (
            <div className="ferr" key={image.key}>
              Ảnh {images.indexOf(image) + 1}: {image.error ?? "không tải lên được"}
              {i === 0 && " — bấm “Thử lại” trên ảnh, hoặc xoá ảnh để gửi phiếu."}
            </div>
          ))}

        <div className="fhint">
          Tối đa {appConfig.maxFeedbackImages} ảnh · đã chọn {images.length}
          {images.some((image) => image.status === "uploading") && " · đang tải lên…"}
        </div>
      </div>

      <div className="fgroup">
        <label>
          {/* Bắt buộc khi KHÔNG có toạ độ: lúc đó địa chỉ chữ là thứ duy nhất
              chỉ được chỗ xảy ra sự việc. Xét theo toạ độ chứ không theo
              `status` — xin quyền xong mà vẫn không ra điểm nào dùng được là
              chuyện có thật. */}
          Vị trí xảy ra sự việc {!hasPoint && <span className="req">*</span>}
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
                {/*
                  Mở sẵn ô nhập khi CHƯA CÓ địa chỉ, không chỉ khi thiếu toạ độ.
                  Hệ thống chưa chốt nhà cung cấp bản đồ nên phần lớn trường hợp
                  không tra được địa chỉ từ toạ độ; hiện dòng chữ "Chưa có địa
                  chỉ" rồi bắt người dùng tự tìm ra nút "Sửa" là để trống một ô
                  mà chính họ cần điền.
                */}
                {editingAddress || !hasPoint || !location.address.trim() ? (
                  <input
                    className={`finp ${errors.address ? "err" : ""}`}
                    value={location.address}
                    placeholder="Nhập địa chỉ cụ thể"
                    onChange={(e) => onAddressChange(e.target.value)}
                  />
                ) : (
                  <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: ".9rem" }}>
                    {location.address}
                  </div>
                )}
                {/* Nói thật vì sao ô trống, để người dân không tưởng app lỗi */}
                {hasPoint && !location.address.trim() && (
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    Đã ghim đúng vị trí trên bản đồ; hệ thống chưa tra được tên đường nên
                    mời bạn gõ giúp địa chỉ cho dễ tìm.
                  </div>
                )}
                {location.lat !== undefined && location.lng !== undefined && (
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {location.lat.toFixed(COORD_DIGITS)}, {location.lng.toFixed(COORD_DIGITS)}
                    {/* Sai số phải hiện: điểm lệch 2km nhìn trên bản đồ y hệt
                        điểm lệch 10m, mà chỉ một trong hai ghim đúng chỗ. */}
                    {location.accuracy !== undefined && ` · ±${Math.round(location.accuracy)}m`}
                    {location.source && ` · ${LOCATION_SOURCE_LABEL[location.source]}`}
                  </div>
                )}
              </div>
              {hasPoint && (
                <button type="button" className="btn sm" onClick={onToggleEditAddress}>
                  <Icon name={editingAddress ? "check" : "edit"} size={15} />
                  {editingAddress ? "Xong" : "Sửa"}
                </button>
              )}
            </div>
            {errors.address && <div className="ferr">{errors.address}</div>}
            {/* Người dân phải THẤY điểm mình đang báo — một dòng toạ độ thì không ai
                kiểm tra được. GPS lệch vài trăm mét là cán bộ tới nhầm nơi. */}
            <LocationPreviewMap lat={location.lat} lng={location.lng} />

            {/* Điểm còn thô: nói ra và mời bấm lại. GPS cần vài giây ngoài trời
                mới bắt được vệ tinh; lần đọc đầu thường là điểm wifi/trạm phát. */}
            {location.accuracy !== undefined && location.accuracy > COARSE_ACCURACY_M && (
              <div className="tiny" style={{ marginTop: 8, color: "var(--orange)" }}>
                Điểm này còn lệch tới ±{Math.round(location.accuracy)}m. Ra chỗ thoáng rồi bấm định vị
                lại, hoặc sửa địa chỉ bằng tay.
              </div>
            )}

            <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={onRetryLocation}>
              <Icon name="pin" size={15} />
              Định vị lại
            </button>
          </div>
        )}

        {location.status === "denied" && (
          <>
            {/* Câu này phải đúng cho CẢ HAI trường hợp: không lấy được vị trí,
                và lấy được nhưng lệch quá xa nên đã bỏ. Nói "không truy cập
                được" trong trường hợp thứ hai là nói sai. */}
            <Note color="var(--orange)" icon="alert">
              Chưa xác định được vị trí đủ chính xác — vui lòng nhập địa chỉ
            </Note>
            {/* Lý do nguyên văn: phân biệt "người dùng bấm từ chối" với "Zalo
                chặn quyền API getLocation" — hai việc khác nhau hoàn toàn, mà
                trước đây màn hình hiện y như nhau. */}
            {location.error && (
              <div className="tiny muted" style={{ marginTop: 6, wordBreak: "break-word" }}>
                Chi tiết: {location.error}
              </div>
            )}
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: 8 }}
              onClick={onRetryLocation}
            >
              <Icon name="pin" size={15} />
              Thử định vị lại
            </button>
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

/**
 * Ô ảnh đính kèm — hiện ảnh thật từ đường dẫn Zalo trả về.
 *
 * Đường dẫn tạm của Zalo có thể hết hiệu lực (người dùng xoá ảnh gốc, phiên
 * webview mới), lúc đó thẻ img báo lỗi tải. Bắt `onError` để rơi về ô màu giữ
 * chỗ kèm icon, thay vì để lại một ô ảnh vỡ trên màn hình.
 */
/** Lớp phủ mờ trên ô ảnh, dùng cho trạng thái đang tải và tải lỗi */
function ThumbOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
}

export function AttachmentThumb({
  uri,
  index,
  style,
  children,
}: {
  uri: string;
  index: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const palette = appConfig.imagePlaceholderColors;
  const fallback = palette[index % palette.length];

  return (
    <div className="thumb" style={{ background: fallback, overflow: "hidden", ...style }}>
      {broken ? (
        <Icon name="image" size={24} color="rgba(255,255,255,.85)" />
      ) : (
        <img src={uri} alt={`Ảnh hiện trường ${index + 1}`} onError={() => setBroken(true)} loading="lazy" />
      )}
      {children}
    </div>
  );
}
