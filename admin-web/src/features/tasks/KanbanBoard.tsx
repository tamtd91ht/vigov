"use client";

import type { Task } from "@/types";
import { findStatus, taskPriorities, taskStatuses } from "@/config/status.config";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/lib/icons";

/** Thẻ nhiệm vụ trong cột Kanban */
function TaskCard({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const priority = findStatus(taskPriorities, task.priority);
  const isLate = task.status === "qua";
  return (
    <div className="tk" onClick={() => onOpen(task.id)}>
      {/* Thanh màu trên đầu thẻ theo mức ưu tiên */}
      <div className="top" style={{ background: priority.color }} />
      <div className="in">
        <div className="ti">{task.title}</div>
        <div className="src">{task.sourceLabel}</div>
        <div style={{ marginTop: 11 }}>
          <ProgressBar percent={task.progress} />
          <div
            className="tiny"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <span
              style={{
                color: isLate ? "var(--red)" : "var(--mut)",
                fontWeight: 600,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <Icon name="clock" size={13} />
              Hạn {task.deadline}
            </span>
            <span style={{ fontWeight: 700, color: "var(--navy)" }}>{task.progress}%</span>
          </div>
        </div>
        <div className="ft">
          <Avatar name={task.assignee} />
          <span
            className="tiny muted"
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.assignee}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Bảng Kanban 5 cột theo taskStatuses */
export function KanbanBoard({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  return (
    <div className="kb">
      {taskStatuses.map((st) => {
        const column = tasks.filter((t) => t.status === st.key);
        return (
          <div className="kbc" key={st.key}>
            <div className="kbc-h">
              <span className="dot" style={{ background: st.color }} />
              {st.label}
              <span className="n">{column.length}</span>
            </div>
            {column.length ? (
              column.map((t) => <TaskCard key={t.id} task={t} onOpen={onOpen} />)
            ) : (
              <div className="tiny muted" style={{ padding: "14px 6px", textAlign: "center" }}>
                Không có nhiệm vụ
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
