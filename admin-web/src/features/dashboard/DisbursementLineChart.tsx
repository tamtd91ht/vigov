"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatBillion } from "@/lib/format";
import type { DisbursementSeries } from "./types";

/** Cấu hình vẽ SVG — port từ hàm lineChart() của mockup */
const CHART = {
  width: 640,
  height: 210,
  padLeft: 44,
  padRight: 14,
  padTop: 12,
  padBottom: 28,
  /** Trần trục tung mặc định (tỷ đồng); vượt mức này thì trục tự co giãn theo số liệu */
  maxValue: 13,
  /** Các mốc kẻ lưới ngang mặc định (tỷ đồng) */
  gridSteps: [0, 3, 6, 9, 12],
  /** Số khoảng chia khi phải co giãn trục */
  gridDivisions: 4,
  /** Màu lưới/nhãn trục — mockup dùng màu riêng, chưa có CSS var tương ứng */
  gridColor: "#EDF0F3",
  axisTextColor: "var(--mut)",
  planColor: "var(--orange)",
  actualColor: "var(--green)",
} as const;

const LEGEND = [
  { label: "Kế hoạch", color: CHART.planColor },
  { label: "Thực tế", color: CHART.actualColor },
];

/** Biểu đồ đường "Luỹ kế giải ngân" — SVG polyline thuần, thực tế chỉ vẽ tới điểm có số liệu */
export function DisbursementLineChart({ data }: { data: DisbursementSeries }) {
  const { width: W, height: H, padLeft: pl, padRight: pr, padTop: pt, padBottom: pb } = CHART;
  const n = data.months.length;

  // Trục tung giữ thang mặc định khi số liệu còn nhỏ, chỉ co giãn khi kế hoạch vượt trần
  const values = [...data.plan, ...data.actual].filter((v): v is number => v != null);
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  const scaled = dataMax > CHART.maxValue;
  const maxValue = scaled ? Math.ceil(dataMax / CHART.gridDivisions) * CHART.gridDivisions : CHART.maxValue;
  const gridSteps = scaled
    ? Array.from({ length: CHART.gridDivisions + 1 }, (_, i) => (maxValue / CHART.gridDivisions) * i)
    : CHART.gridSteps;

  // n = 1 thì không chia được khoảng cách — đặt điểm duy nhất vào giữa vùng vẽ
  const x = (i: number) => (n > 1 ? pl + (i * (W - pl - pr)) / (n - 1) : (pl + W - pr) / 2);
  const y = (v: number) => pt + (1 - v / maxValue) * (H - pt - pb);

  // Dựng path bỏ qua các điểm null: 'M' khi bắt đầu đoạn mới, 'L' khi nối tiếp
  const buildPath = (arr: (number | null)[]) =>
    arr
      .map((v, i) =>
        v == null ? null : `${i === 0 || arr[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`,
      )
      .filter(Boolean)
      .join(" ");

  // Điểm thực tế cuối cùng có số liệu — gắn nhãn giá trị ngay cạnh điểm
  const lastIdx = data.actual.reduce<number>((acc, v, i) => (v == null ? acc : i), -1);
  const lastActual = lastIdx >= 0 ? data.actual[lastIdx] : null;

  return (
    <Card style={{ marginTop: 18 }}>
      <CardHeader
        title="Luỹ kế giải ngân: kế hoạch và thực tế"
        extra={
          <div className="legend">
            {LEGEND.map((l) => (
              <span key={l.label}>
                <i style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        }
      />
      <CardBody>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} role="img" aria-label="Biểu đồ luỹ kế giải ngân theo tháng">
          {/* Lưới ngang + nhãn trục tung */}
          {gridSteps.map((v) => (
            <g key={v}>
              <line x1={pl} y1={y(v)} x2={W - pr} y2={y(v)} stroke={CHART.gridColor} />
              <text x={pl - 9} y={y(v) + 4} fill={CHART.axisTextColor} fontSize={10.5} textAnchor="end">
                {v.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ
              </text>
            </g>
          ))}
          {/* Nhãn tháng trục hoành */}
          {data.months.map((t, i) => (
            <text key={t} x={x(i)} y={H - 8} fill={CHART.axisTextColor} fontSize={10.5} textAnchor="middle">
              {t}
            </text>
          ))}
          {/* Đường kế hoạch (nét đứt) */}
          <path
            d={buildPath(data.plan)}
            fill="none"
            stroke={CHART.planColor}
            strokeWidth={2.2}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
          {/* Đường thực tế — dừng ở tháng cuối có số liệu */}
          <path d={buildPath(data.actual)} fill="none" stroke={CHART.actualColor} strokeWidth={2.6} strokeLinecap="round" />
          {/* Chấm tròn tại các điểm thực tế */}
          {data.actual.map((v, i) =>
            v == null ? null : (
              <circle key={data.months[i]} cx={x(i)} cy={y(v)} r={3.1} fill="#fff" stroke={CHART.actualColor} strokeWidth={2} />
            ),
          )}
          {/* Nhãn giá trị thực tế mới nhất */}
          {lastActual != null && (
            <text x={x(lastIdx) + 8} y={y(lastActual) - 10} fill={CHART.actualColor} fontSize={11} fontWeight={700}>
              {formatBillion(lastActual)}
            </text>
          )}
        </svg>
      </CardBody>
    </Card>
  );
}
