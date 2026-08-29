import type { ReactNode } from "react";
import { Chip, Note } from "@/components/common";
import { slaText, type FeedbackCategory } from "@/config/categories";
import { appConfig } from "@/config/app.config";
import type { LocationState } from "./DetailStep";

/** Số ký tự mô tả hiển thị rút gọn ở màn xác nhận */
const DESC_PREVIEW_LEN = 180;
const SWATCH_SIZE = 34;

function shorten(text: string): string {
  return text.length > DESC_PREVIEW_LEN ? `${text.slice(0, DESC_PREVIEW_LEN).trimEnd()}…` : text;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="tiny muted" style={{ fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

/** Bước 3 — xem lại toàn bộ nội dung trước khi gửi */
export function ConfirmStep({
  category,
  title,
  description,
  images,
  location,
}: {
  category: FeedbackCategory;
  title: string;
  description: string;
  images: string[];
  location: LocationState;
}) {
  return (
    <>
      <h3 style={{ marginBottom: 10 }}>Kiểm tra lại thông tin</h3>

      <div className="card card-b">
        <Row label="Danh mục">
          <Chip label={category.label} color={category.color} icon={category.icon} />
        </Row>

        <Row label="Tiêu đề">
          <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: ".95rem" }}>{title}</div>
        </Row>

        <Row label="Mô tả chi tiết">
          <div className="sm" style={{ whiteSpace: "pre-wrap" }}>
            {shorten(description)}
          </div>
        </Row>

        <Row label={`Ảnh hiện trường (${images.length}/${appConfig.maxFeedbackImages})`}>
          {images.length === 0 ? (
            <div className="sm muted">Không đính kèm ảnh</div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              {images.map((color, i) => (
                <span
                  key={`${color}-${i}`}
                  className="thumb"
                  style={{ width: SWATCH_SIZE, height: SWATCH_SIZE, background: color }}
                />
              ))}
            </div>
          )}
        </Row>

        <div>
          <div className="tiny muted" style={{ fontWeight: 600, marginBottom: 4 }}>
            Vị trí
          </div>
          <div className="sm">{location.address.trim() || "Chưa xác định vị trí"}</div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Note color="var(--green)" icon="ok">
          <b style={{ color: "var(--navy)" }}>Cam kết xử lý của {appConfig.org.name}</b>
          <div style={{ marginTop: 2 }}>{slaText(category)}</div>
        </Note>
      </div>
    </>
  );
}
