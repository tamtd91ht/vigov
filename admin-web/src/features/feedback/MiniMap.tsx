"use client";

import { Icon } from "@/lib/icons";

/**
 * Bản đồ mini trong drawer chi tiết phản ánh — mô phỏng nền bản đồ (lưới xanh,
 * đường, kênh) như .mapwrap thu nhỏ. Provider bản đồ thật sẽ thay thế khối này.
 */
export function MiniMap({
  color,
  label,
  x,
  y,
  onClick,
}: {
  /** Màu ghim (màu lĩnh vực) */
  color: string;
  /** Nhãn vị trí (thôn/tổ) */
  label: string;
  /** Toạ độ % trong khung */
  x: number;
  y: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      title="Mở bản đồ chi tiết"
      style={{
        position: "relative",
        height: 160,
        borderRadius: 10,
        border: "1px solid var(--bd)",
        overflow: "hidden",
        cursor: "pointer",
        background: "#EDF4EE",
        backgroundImage:
          "linear-gradient(rgba(39,174,96,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(39,174,96,.10) 1px,transparent 1px)",
        backgroundSize: "34px 34px",
      }}
    >
      {/* Đường liên thôn (ngang / dọc) và kênh tiêu */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "56%", height: 9, background: "#fff", boxShadow: "0 0 0 1px #E1E7E3" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "34%", width: 8, background: "#fff", boxShadow: "0 0 0 1px #E1E7E3" }} />
      <div
        style={{ position: "absolute", left: 0, right: 0, top: "22%", height: 12, background: "rgba(59,130,196,.28)", borderRadius: 20 }}
      />
      {/* Ghim vị trí phản ánh */}
      <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-100%)", color }}>
        <Icon name="pin" size={28} strokeWidth={2} />
      </div>
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          transform: "translate(-50%,4px)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--navy)",
          background: "#fff",
          padding: "2px 8px",
          borderRadius: 10,
          border: "1px solid var(--bd)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}
