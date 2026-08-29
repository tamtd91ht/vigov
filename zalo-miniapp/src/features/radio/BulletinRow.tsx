import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { formatNumber, formatTime, tint } from "@/components/common";
import type { RadioBulletin } from "@/types";
import { clamp2 } from "./PlayerCard";

/** Nhãn dùng trong hàng bản tin */
const NOW_PLAYING_LABEL = "Đang phát";
const PAUSED_LABEL = "Tạm dừng";
const PLAYS_SUFFIX = "lượt nghe";
const META_SEP = " · ";

const PINK = "var(--pink)";
const NAVY = "var(--navy)";

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 10,
  width: "100%",
  textAlign: "left",
};

const playBtnBase: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  flex: "none",
};

/** Một bản tin trong danh sách theo ngày */
export function BulletinRow({
  bulletin,
  current,
  playing,
  onPress,
}: {
  bulletin: RadioBulletin;
  current: boolean;
  playing: boolean;
  onPress: () => void;
}) {
  const showPause = current && playing;

  return (
    <button className="card card-b tap" style={rowStyle} onClick={onPress}>
      <span
        style={{
          ...playBtnBase,
          background: current ? tint(PINK, 0.12) : "#fff",
          border: `1.5px solid ${current ? PINK : "var(--bd)"}`,
          color: current ? PINK : NAVY,
        }}
      >
        <Icon name={showPause ? "pause" : "playFill"} size={17} fill={!showPause} strokeWidth={2.2} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...clamp2, fontSize: ".88rem", fontWeight: 600, color: NAVY }}>{bulletin.title}</span>
        <span className="tiny muted" style={{ display: "block", marginTop: 3 }}>
          {bulletin.category}
          {META_SEP}
          {formatTime(bulletin.durationSeconds)}
          {META_SEP}
          {formatNumber(bulletin.plays)} {PLAYS_SUFFIX}
        </span>
        {current && (
          <span className="tiny" style={{ display: "block", marginTop: 3, color: PINK, fontWeight: 700 }}>
            {playing ? NOW_PLAYING_LABEL : PAUSED_LABEL}
          </span>
        )}
      </span>
    </button>
  );
}
