import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { formatTime, tint } from "@/components/common";
import { skipSeconds, speedLabel, useRadio } from "@/state/RadioContext";

/** Nhãn/hằng số dùng trong khối phát */
const EMPTY_PLAYER_TEXT = "Chọn một bản tin để nghe";
const BACK_LABEL = "Tua lùi";
const FWD_LABEL = "Tua nhanh";
const PLAY_LABEL = "Phát";
const PAUSE_LABEL = "Tạm dừng";
const SPEED_LABEL = "Đổi tốc độ phát";

const NAVY = "var(--navy)";
const WHITE_SOFT = "rgba(255,255,255,.72)";
const WHITE_GLASS = "rgba(255,255,255,.16)";

/** Cắt tiêu đề còn 2 dòng — dùng chung khối phát và hàng bản tin */
export const clamp2: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
};

const cardStyle: CSSProperties = {
  background: `linear-gradient(135deg,#16314e,${NAVY})`,
  borderRadius: 16,
  padding: 16,
  color: "#fff",
};

const rangeStyle: CSSProperties = {
  width: "100%",
  height: 4,
  accentColor: "var(--pink)",
  cursor: "pointer",
  display: "block",
  margin: "14px 0 2px",
};

const roundBtnStyle: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: "50%",
  background: "#fff",
  color: NAVY,
  display: "grid",
  placeItems: "center",
  flex: "none",
};

const skipBtnStyle: CSSProperties = {
  position: "relative",
  width: 40,
  height: 40,
  display: "grid",
  placeItems: "center",
  color: "#fff",
  flex: "none",
};

const skipNumStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  fontSize: ".56rem",
  fontWeight: 700,
  paddingTop: 2,
};

/**
 * Khối phát lớn đầu màn Truyền thanh (WBS #17).
 * Nguồn audio thật lấy từ file storage (P3 #24) — hiện mô phỏng bằng bộ đếm ở RadioContext.
 */
export function PlayerCard() {
  const { bulletin, playing, position, duration, speed, toggle, seek, skip, cycleSpeed } = useRadio();

  if (!bulletin) {
    return (
      <div
        style={{
          background: tint(NAVY, 0.06),
          border: `1px solid ${tint(NAVY, 0.18)}`,
          borderRadius: 16,
          padding: "26px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="radio" size={34} color={NAVY} />
        <div className="sm muted">{EMPTY_PLAYER_TEXT}</div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <span className="chip" style={{ background: WHITE_GLASS, color: "#fff" }}>
        {bulletin.category}
      </span>

      <div style={{ ...clamp2, fontSize: "1rem", fontWeight: 700, color: "#fff", marginTop: 10 }}>
        {bulletin.title}
      </div>

      <input
        type="range"
        min={0}
        max={duration}
        value={position}
        onChange={(e) => seek(+e.target.value)}
        style={rangeStyle}
        aria-label="Thanh tua bản tin"
      />

      <div className="tiny" style={{ display: "flex", justifyContent: "space-between", color: WHITE_SOFT }}>
        <span>{formatTime(position)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div style={{ position: "relative", marginTop: 12, minHeight: 54 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <button style={skipBtnStyle} onClick={() => skip(-skipSeconds)} aria-label={BACK_LABEL}>
            <Icon name="skipBack" size={26} strokeWidth={1.7} />
            <span style={skipNumStyle}>{skipSeconds}</span>
          </button>

          <button style={roundBtnStyle} onClick={toggle} aria-label={playing ? PAUSE_LABEL : PLAY_LABEL}>
            <Icon name={playing ? "pause" : "playFill"} size={24} fill={!playing} strokeWidth={2.2} />
          </button>

          <button style={skipBtnStyle} onClick={() => skip(skipSeconds)} aria-label={FWD_LABEL}>
            <Icon name="skipFwd" size={26} strokeWidth={1.7} />
            <span style={skipNumStyle}>{skipSeconds}</span>
          </button>
        </div>

        <button
          className="chip"
          onClick={cycleSpeed}
          aria-label={SPEED_LABEL}
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            background: WHITE_GLASS,
            color: "#fff",
            padding: "5px 11px",
          }}
        >
          {speedLabel(speed)}
        </button>
      </div>
    </div>
  );
}
