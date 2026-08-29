import type { OnTimePoint } from "@/services/reports.service";

/* Kích thước & thang đo SVG (đồng bộ mockup) */
const W = 620;
const H = 200;
const PAD = { left: 40, right: 14, top: 14, bottom: 28 };
/** Trục tung mặc định 60–100% */
const Y_MIN = 60;
const Y_MAX = 100;
const GRID_STEPS = [60, 70, 80, 90, 100];
/** Thang dự phòng khi có tháng tỷ lệ thấp hơn trần dưới mặc định */
const FULL_GRID_STEPS = [0, 25, 50, 75, 100];
/** Màu đường kỳ hiện tại / cùng kỳ năm trước */
const LINE_CURRENT = "var(--blue)";
const LINE_PREVIOUS = "#DCE7F2";

/** "Tháng 8" -> "T8" cho nhãn trục hoành */
function shortMonth(label: string): string {
  return label.replace(/^Tháng\s*/i, "T");
}

/**
 * Biểu đồ đường SVG: tỷ lệ xử lý đúng hạn theo tháng.
 * `previous` là chuỗi cùng kỳ năm trước, chỉ vẽ khi bật so sánh.
 */
export function OnTimeLineChart({ data, previous }: { data: OnTimePoint[]; previous: OnTimePoint[] | null }) {
  const n = data.length;
  const current = data.map((p) => p.rate);
  const compareSeries = previous ? previous.slice(0, n).map((p) => p.rate) : null;

  // Thang mặc định 60–100% chỉ dùng khi mọi giá trị nằm trong khoảng đó
  const values = [...current, ...(compareSeries ?? [])];
  const useFullScale = values.some((v) => v < Y_MIN);
  const yMin = useFullScale ? 0 : Y_MIN;
  const gridSteps = useFullScale ? FULL_GRID_STEPS : GRID_STEPS;

  // n = 1 (kỳ báo cáo một tháng) thì không chia được khoảng — đặt điểm vào giữa vùng vẽ
  const x = (i: number) => (n > 1 ? PAD.left + (i * (W - PAD.left - PAD.right)) / (n - 1) : (PAD.left + W - PAD.right) / 2);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (Y_MAX - yMin)) * (H - PAD.top - PAD.bottom);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: 200, display: "block" }}
      role="img"
      aria-label="Tỷ lệ xử lý đúng hạn theo tháng"
    >
      {gridSteps.map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#EDF0F3" />
          <text x={PAD.left - 8} y={y(v) + 4} fill="#8896A6" fontSize={10.5} textAnchor="end">
            {v}%
          </text>
        </g>
      ))}
      {data.map((p, i) => (
        <text key={p.month} x={x(i)} y={H - 8} fill="#8896A6" fontSize={10.5} textAnchor="middle">
          {shortMonth(p.month)}
        </text>
      ))}
      {compareSeries && (
        <path d={path(compareSeries)} fill="none" stroke={LINE_PREVIOUS} strokeWidth={2.2} strokeDasharray="6 4" strokeLinecap="round" />
      )}
      <path d={path(current)} fill="none" stroke={LINE_CURRENT} strokeWidth={2.6} strokeLinecap="round" />
      {data.map((p, i) => (
        <circle key={p.month} cx={x(i)} cy={y(p.rate)} r={3.1} fill="#fff" stroke="#3B82C4" strokeWidth={2}>
          <title>{`${p.month}: ${p.onTime}/${p.total} việc đúng hạn (${p.rate}%)`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Chú giải dùng ở header card (đường năm trước chỉ hiện khi bật so sánh) */
export function OnTimeLegend({ year, compareYear }: { year: number; compareYear: number | null }) {
  return (
    <span className="legend">
      <span>
        <i style={{ background: LINE_CURRENT }} />
        Năm {year}
      </span>
      {compareYear !== null && (
        <span>
          <i style={{ background: LINE_PREVIOUS }} />
          Năm {compareYear}
        </span>
      )}
    </span>
  );
}
