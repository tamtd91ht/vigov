import type { CSSProperties, ReactNode } from "react";

export function Chip({
  children,
  color,
  tint,
  dot,
  style,
}: {
  children: ReactNode;
  color: string;
  tint?: string;
  dot?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span className="chip" style={{ color, background: tint ?? "rgba(0,0,0,.04)", ...style }}>
      {dot && <span className="dot" style={{ background: color }} />}
      {children}
    </span>
  );
}
