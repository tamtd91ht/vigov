"use client";

import { useState } from "react";
import Link from "next/link";
import { findStatus, taskPriorities, taskSources, taskStatuses } from "@/config/status.config";
import type { TaskDetail, UpdateTaskInput } from "@/services/tasks.service";
import { Icon } from "@/lib/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Timeline } from "@/components/ui/Timeline";
import { CommentList } from "@/components/ui/CommentList";
import { FileList } from "@/components/ui/FileList";
import { useToast } from "@/components/ui/Toast";

const DRAWER_TABS = [
  { key: "detail", label: "Chi tiết" },
  { key: "discuss", label: "Trao đổi & Nhật ký" },
];

/** Liên kết xuyên phân hệ theo nguồn phát sinh nhiệm vụ */
function SourceLink({ task }: { task: TaskDetail }) {
  const source = findStatus(taskSources, task.sourceType);
  const href = task.sourceType === "vb" ? "/documents" : task.sourceType === "pa" ? "/feedback" : null;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <Chip color={source.color} tint={source.tint} dot>
        {source.label}
      </Chip>
      <span>{task.sourceLabel || "Giao trực tiếp"}</span>
      {href && (
        <Link href={href} className="btn sm" style={{ textDecoration: "none" }}>
          <Icon name="right" size={13} />
          {task.sourceType === "vb" ? "Mở phân hệ Văn bản" : "Mở phân hệ Phản ánh"}
        </Link>
      )}
    </div>
  );
}

export function TaskDrawer({
  task,
  loading,
  error,
  onRetry,
  open,
  onClose,
  onToggleChecklist,
  onSendComment,
  onSave,
}: {
  task: TaskDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  open: boolean;
  onClose: () => void;
  /** Tick việc con — gọi API rồi cha cập nhật lại nhiệm vụ */
  onToggleChecklist: (index: number, done: boolean) => Promise<void>;
  onSendComment: (content: string) => Promise<void>;
  onSave: (patch: UpdateTaskInput) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState("detail");
  const [commentInput, setCommentInput] = useState("");
  const [statusDraft, setStatusDraft] = useState("moi");
  const [saving, setSaving] = useState(false);

  // Nạp lại tab + ô nhập khi mở nhiệm vụ khác (điều chỉnh state ngay trong render)
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null);
  if (task && task.id !== loadedTaskId) {
    setLoadedTaskId(task.id);
    setTab("detail");
    setCommentInput("");
    setStatusDraft(task.status);
  }

  const status = findStatus(taskStatuses, task?.status ?? "moi");
  const priority = findStatus(taskPriorities, task?.priority ?? "tb");
  const doneCount = task?.checklist.filter((c) => c.done).length ?? 0;
  const isLate = task?.status === "qua";

  /** Bọc mọi thao tác ghi: khoá nút, chờ máy chủ trả lời rồi mở lại */
  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  };

  const sendComment = () => {
    const content = commentInput.trim();
    if (!content) {
      showToast("Vui lòng nhập nội dung trao đổi");
      return;
    }
    void run(async () => {
      await onSendComment(content);
      setCommentInput("");
    });
  };

  /** Cập nhật tiến độ: đồng bộ tiến độ theo checklist + trạng thái cán bộ chọn */
  const saveProgress = () => {
    if (!task) return;
    const progress = task.checklist.length
      ? Math.round((task.checklist.filter((c) => c.done).length / task.checklist.length) * 100)
      : task.progress;
    void run(() => onSave({ status: statusDraft, progress }));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={task?.title ?? "Chi tiết nhiệm vụ"}
      meta={task ? `${task.id} · Hạn xử lý ${task.deadline}` : "Đang tải dữ liệu từ máy chủ…"}
      footer={
        <>
          <select
            className="sel"
            value={statusDraft}
            disabled={!task || saving}
            onChange={(e) => setStatusDraft(e.target.value)}
          >
            {taskStatuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn pri" type="button" disabled={!task || saving} onClick={saveProgress}>
            Cập nhật tiến độ
          </button>
          <button
            className="btn"
            type="button"
            disabled
            title="Chờ API nhắc việc — backend chưa có endpoint gửi nhắc cho người thực hiện"
          >
            Nhắc việc
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      <DataState loading={loading} error={error} onRetry={onRetry} empty={!task} emptyMessage="Chưa chọn nhiệm vụ">
        {task && (
          <div className={saving ? "saving" : undefined}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <Chip color={status.color} tint={status.tint} dot>
                {status.label}
              </Chip>
              <Chip color={priority.color} tint={priority.tint}>
                Ưu tiên: {priority.label}
              </Chip>
            </div>

            <Tabs items={DRAWER_TABS} active={tab} onChange={setTab} />

            {tab === "detail" ? (
              <div style={{ marginTop: 16 }}>
                <div className="fld">
                  <div className="k">Mô tả nhiệm vụ</div>
                  <div className="v">{task.description || <span className="muted">Chưa có mô tả</span>}</div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div className="fld">
                    <div className="k">Người giao việc</div>
                    <div className="v" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Avatar name={task.assigner} />
                      {task.assigner}
                    </div>
                  </div>
                  <div className="fld">
                    <div className="k">Người thực hiện</div>
                    <div className="v" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Avatar name={task.assignee} />
                      {task.assignee}
                    </div>
                  </div>
                  <div className="fld">
                    <div className="k">Bộ phận chủ trì</div>
                    <div className="v">{task.department}</div>
                  </div>
                  <div className="fld">
                    <div className="k">Hạn xử lý</div>
                    <div
                      className="v"
                      style={{
                        color: isLate ? "var(--red)" : "var(--tx)",
                        fontWeight: 600,
                      }}
                    >
                      {task.deadline}
                    </div>
                  </div>
                </div>
                <div className="fld">
                  <div className="k">Cán bộ phối hợp</div>
                  <div className="v" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {task.collaborators.length ? (
                      task.collaborators.map((name) => (
                        <span
                          key={name}
                          style={{
                            display: "flex",
                            gap: 7,
                            alignItems: "center",
                            border: "1px solid var(--bd)",
                            borderRadius: 20,
                            padding: "3px 12px 3px 3px",
                            fontSize: 12.5,
                          }}
                        >
                          <Avatar name={name} />
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="muted">Không có</span>
                    )}
                  </div>
                </div>
                <div className="fld">
                  <div className="k">Nguồn liên kết</div>
                  <div className="v">
                    <SourceLink task={task} />
                  </div>
                </div>

                <div className="gsec">
                  <h4>
                    Nhiệm vụ con ({doneCount}/{task.checklist.length} đã hoàn thành)
                  </h4>
                  <div>
                    {task.checklist.length ? (
                      task.checklist.map((item, i) => (
                        <label key={`${item.title}-${i}`} className={`chk ${item.done ? "done" : ""}`}>
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={saving}
                            onChange={() => void run(() => onToggleChecklist(i, !item.done))}
                          />
                          <span className="lb">{item.title}</span>
                        </label>
                      ))
                    ) : (
                      <div className="tiny muted">Nhiệm vụ chưa chia việc con</div>
                    )}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <ProgressBar percent={task.progress} thick />
                    <div
                      className="tiny"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 6,
                      }}
                    >
                      <span className="muted">Tiến độ tổng thể</span>
                      <b style={{ color: "var(--navy)" }}>{task.progress}%</b>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <CommentList comments={task.comments} />
                <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
                  <input
                    className="sel"
                    style={{ flex: 1, minWidth: 0 }}
                    placeholder="Nhập ý kiến trao đổi…"
                    value={commentInput}
                    disabled={saving}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  />
                  <button className="btn pri sm" type="button" disabled={saving} onClick={sendComment}>
                    <Icon name="send" size={14} />
                    Gửi
                  </button>
                </div>
                <div className="gsec">
                  <h4>Nhật ký xử lý</h4>
                  {task.timeline.length ? (
                    <Timeline items={task.timeline} />
                  ) : (
                    <div className="tiny muted">Chưa có mốc xử lý nào</div>
                  )}
                </div>
                <div className="gsec">
                  <h4>Tệp đính kèm minh chứng</h4>
                  {task.attachments.length ? (
                    <FileList names={task.attachments} />
                  ) : (
                    <div className="tiny muted">Chưa có tệp đính kèm</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DataState>
    </Drawer>
  );
}
