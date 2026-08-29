"use client";

import type { Task } from "@/types";
import { findStatus, taskPriorities, taskStatuses } from "@/config/status.config";
import { deadlineLabel } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

/** Số ngày còn lại tới hạn so với hôm nay (âm = quá hạn) — deadline dạng "dd/MM/yyyy" */
function daysUntilDeadline(deadline: string): number {
  const matched = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(deadline.trim());
  if (!matched) return 0;
  const due = new Date(Number(matched[3]), Number(matched[2]) - 1, Number(matched[1]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Ô hạn xử lý: ngày + nhãn số ngày còn lại (nhiệm vụ đã hoàn thành chỉ hiển thị ngày) */
function DeadlineCell({ task }: { task: Task }) {
  if (task.status === "xong") {
    return (
      <>
        <div>{task.deadline}</div>
        <div className="tiny" style={{ color: "var(--green)", fontWeight: 600, marginTop: 2 }}>
          Đã hoàn thành
        </div>
      </>
    );
  }
  const label = deadlineLabel(daysUntilDeadline(task.deadline));
  return (
    <>
      <div style={label.late ? { color: "var(--red)", fontWeight: 700 } : undefined}>{task.deadline}</div>
      <div className="tiny" style={{ color: label.color, fontWeight: 600, marginTop: 2 }}>
        {label.text}
      </div>
    </>
  );
}

/** Chế độ xem Bảng danh sách nhiệm vụ */
export function TaskTable({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  return (
    <Card>
      <div className="tw">
        <table className="tb2">
          <thead>
            <tr>
              <th>Mã</th>
              <th style={{ minWidth: 260 }}>Tên việc</th>
              <th>Người thực hiện</th>
              <th>Bộ phận</th>
              <th>Hạn</th>
              <th>Tiến độ</th>
              <th>Ưu tiên</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length ? (
              tasks.map((t) => {
                const status = findStatus(taskStatuses, t.status);
                const priority = findStatus(taskPriorities, t.priority);
                return (
                  <tr key={t.id} className={t.status === "qua" ? "late" : ""} onClick={() => onOpen(t.id)}>
                    <td className="tiny muted" style={{ whiteSpace: "nowrap" }}>
                      {t.id}
                    </td>
                    <td>
                      <div className="tt">{t.title}</div>
                      <div className="tiny muted">{t.sourceLabel}</div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Avatar name={t.assignee} />
                        <span>{t.assignee}</span>
                      </div>
                    </td>
                    <td>{t.department}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <DeadlineCell task={t} />
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <ProgressBar percent={t.progress} />
                      <div className="tiny muted" style={{ marginTop: 4 }}>
                        {t.progress}%
                      </div>
                    </td>
                    <td>
                      <Chip color={priority.color} tint={priority.tint}>
                        {priority.label}
                      </Chip>
                    </td>
                    <td>
                      <Chip color={status.color} tint={status.tint} dot>
                        {status.label}
                      </Chip>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="muted"
                  style={{
                    textAlign: "center",
                    padding: 28,
                    cursor: "default",
                  }}
                >
                  Không có nhiệm vụ phù hợp bộ lọc
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
