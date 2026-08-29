import { progressColor } from "@/lib/format";

export function ProgressBar({ percent, color, thick }: { percent: number; color?: string; thick?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={thick ? "pbar thick" : "pbar"}>
      <i style={{ width: `${clamped}%`, background: color ?? progressColor(clamped) }} />
    </div>
  );
}
