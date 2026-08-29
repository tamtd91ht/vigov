"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { MonthlyTaskStat } from "./types";

/** Màu chú giải — cột "được giao" dùng đúng màu của class .bar.b2 (globals.css) */
const LEGEND = {
  done: { label: "Đã hoàn thành", color: "var(--blue)" },
  assigned: { label: "Được giao", color: "#DCE7F2" },
} as const;

/** Biểu đồ cột đôi "Nhiệm vụ hoàn thành theo tháng" — dựng bằng div .bars như mockup */
export function MonthlyTasksChart({ data }: { data: MonthlyTaskStat[] }) {
  // Chiều cao cột tính % theo giá trị lớn nhất của cột "được giao"
  const max = Math.max(...data.map((m) => m.assigned), 1);

  return (
    <Card>
      <CardHeader
        title="Nhiệm vụ hoàn thành theo tháng"
        extra={
          <div className="legend">
            <span>
              <i style={{ background: LEGEND.done.color }} />
              {LEGEND.done.label}
            </span>
            <span>
              <i style={{ background: LEGEND.assigned.color }} />
              {LEGEND.assigned.label}
            </span>
          </div>
        }
      />
      <CardBody>
        <div className="bars">
          {data.map((m) => (
            <div key={m.month} className="col" title={`${m.month}: hoàn thành ${m.done}/${m.assigned} việc`}>
              <div className="stack">
                <div className="bar" style={{ height: `${(m.done / max) * 100}%` }} />
                <div className="bar b2" style={{ height: `${(m.assigned / max) * 100}%` }} />
              </div>
              <div className="lbl">{m.month}</div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
