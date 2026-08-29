"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/lib/icons";
import { findStatus, taskPriorities } from "@/config/status.config";
import type { UrgentItem } from "./types";

/** Route đích khi bấm một dòng / nút "Xem toàn bộ nhiệm vụ" */
const TASKS_ROUTE = "/tasks";

/** Màu chip nhãn hạn: quá hạn = đỏ, còn hạn = xám nền nhạt */
const DEADLINE_CHIP = {
  late: { color: "var(--red)", tint: "rgba(231,76,60,.10)" },
  normal: { color: "var(--mut)", tint: "var(--bg2)" },
} as const;

/** Danh sách "Cần xử lý ngay" — dot màu theo mức ưu tiên, chip nhãn hạn */
export function UrgentList({ items }: { items: UrgentItem[] }) {
  const router = useRouter();

  return (
    <Card style={{ alignSelf: "start" }}>
      <CardHeader title="Cần xử lý ngay" extra={`${items.length} việc`} />
      <div className="rows">
        {items.length === 0 && (
          <div className="empty">
            <Icon name="ok" size={34} />
            <div style={{ marginTop: 10 }}>Không có việc cần xử lý gấp</div>
          </div>
        )}
        {items.map((u) => {
          const priority = findStatus(taskPriorities, u.priority);
          const chip = u.late ? DEADLINE_CHIP.late : DEADLINE_CHIP.normal;
          return (
            <div key={u.code ?? u.title} className="row-it" onClick={() => router.push(TASKS_ROUTE)} role="button">
              <span className="dot" style={{ background: priority.color, marginTop: 6 }} title={`Ưu tiên: ${priority.label}`} />
              <div style={{ flex: 1 }}>
                <div className="t">{u.title}</div>
                <div className="m">{u.department}</div>
              </div>
              <Chip color={chip.color} tint={chip.tint}>
                {u.deadline}
              </Chip>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--bd)" }}>
        <button type="button" className="btn sm" onClick={() => router.push(TASKS_ROUTE)}>
          Xem toàn bộ nhiệm vụ <Icon name="right" size={14} />
        </button>
      </div>
    </Card>
  );
}
