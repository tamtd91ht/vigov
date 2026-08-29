"use client";

import { useState } from "react";
import { taskPriorities } from "@/config/status.config";
import { fetchDepartments, fetchStaffDirectory } from "@/services/catalogs.service";
import {
  addTaskComment,
  apiErrorMessage,
  createTask,
  getTask,
  listTasks,
  toggleChecklistItem,
  updateTask,
  type CreateTaskInput,
  type TaskDetail,
  type UpdateTaskInput,
} from "@/services/tasks.service";
import { useApiResource } from "@/hooks/useApiResource";
import { useCatalog } from "@/hooks/useCatalog";
import { Icon } from "@/lib/icons";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { FilterChips } from "@/components/ui/FilterChips";
import { useToast } from "@/components/ui/Toast";
import { KanbanBoard } from "./KanbanBoard";
import { TaskTable } from "./TaskTable";
import { TaskDrawer } from "./TaskDrawer";
import { NewTaskForm } from "./NewTaskForm";

const VIEW_OPTIONS = [
  { key: "kanban", label: "Kanban" },
  { key: "list", label: "Bảng" },
];

/** Kanban cần đủ nhiệm vụ để xếp 5 cột nên lấy trang lớn hơn chế độ bảng */
const KANBAN_PAGE_SIZE = 100;
const LIST_PAGE_SIZE = 20;

export function TasksPage() {
  const { showToast } = useToast();

  // Danh mục dùng chung lấy từ API (GET /catalogs/departments, /catalogs/staff)
  const departments = useCatalog(fetchDepartments);
  const staffDirectory = useCatalog(fetchStaffDirectory);

  const [view, setView] = useState("kanban");
  const [deptFilter, setDeptFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const limit = view === "kanban" ? KANBAN_PAGE_SIZE : LIST_PAGE_SIZE;

  // Bộ lọc và phân trang đều là tham số truy vấn gửi lên máy chủ
  const list = useApiResource(
    () =>
      listTasks({
        department: deptFilter === "all" ? undefined : deptFilter,
        assignee: assigneeFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        limit,
      }),
    [deptFilter, assigneeFilter, priorityFilter, page, limit],
  );

  // Chi tiết nhiệm vụ (kèm bình luận, nhật ký) tải riêng khi mở drawer
  const detail = useApiResource<TaskDetail | null>(
    () => (openTaskId ? getTask(openTaskId) : Promise.resolve(null)),
    [openTaskId],
  );

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  /** Đổi bộ lọc thì quay về trang đầu để không rơi vào trang trống */
  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const openTask = (id: string) => {
    setOpenTaskId(id);
    setDrawerOpen(true);
  };

  /** Đồng bộ bản ghi vừa ghi thành công vào cả drawer lẫn danh sách */
  const applyTask = (updated: TaskDetail) => {
    detail.setData(updated);
    list.setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((t) => (t.id === updated.id ? updated : t)),
          }
        : prev,
    );
  };

  /** Tick việc con — backend tính lại tiến độ rồi trả về nhiệm vụ mới */
  const toggleChecklist = async (index: number, done: boolean) => {
    if (!openTaskId) return;
    try {
      const updated = await toggleChecklistItem(openTaskId, index, done);
      applyTask(updated);
      showToast(`Đã cập nhật tiến độ nhiệm vụ ${updated.id} (${updated.progress}%)`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const sendComment = async (content: string) => {
    if (!openTaskId) return;
    try {
      applyTask(await addTaskComment(openTaskId, content));
      showToast("Đã gửi ý kiến trao đổi");
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const saveTask = async (patch: UpdateTaskInput) => {
    if (!openTaskId) return;
    try {
      const updated = await updateTask(openTaskId, patch);
      applyTask(updated);
      showToast(`Đã cập nhật nhiệm vụ ${updated.id}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Giao việc mới — chờ máy chủ cấp mã rồi tải lại danh sách */
  const submitNewTask = async (input: CreateTaskInput) => {
    try {
      const created = await createTask(input);
      setFormOpen(false);
      setPage(1);
      list.reload();
      showToast(`Đã giao việc ${created.id} cho ${created.assignee}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  return (
    <div className="pg">
      <PageHead
        title="Quản lý nhiệm vụ"
        sub="Theo dõi nhiệm vụ giao từ kết luận họp, văn bản đến và phản ánh của người dân"
        actions={
          <button className="btn pri" type="button" onClick={() => setFormOpen(true)}>
            <Icon name="plus" size={15} />
            Giao việc mới
          </button>
        }
      />

      {/* Thanh công cụ lọc + chuyển chế độ xem */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <FilterChips
          chips={departments.map((d) => ({ key: d, label: d }))}
          active={deptFilter}
          onChange={(key) => changeFilter(() => setDeptFilter(key))}
          allLabel="Tất cả bộ phận"
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <select
          className="sel"
          value={assigneeFilter}
          onChange={(e) => changeFilter(() => setAssigneeFilter(e.target.value))}
        >
          <option value="">Tất cả người thực hiện</option>
          {staffDirectory.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="sel"
          value={priorityFilter}
          onChange={(e) => changeFilter(() => setPriorityFilter(e.target.value))}
        >
          <option value="">Tất cả mức ưu tiên</option>
          {taskPriorities.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        {(deptFilter !== "all" || assigneeFilter || priorityFilter) && (
          <button
            className="btn sm"
            type="button"
            onClick={() =>
              changeFilter(() => {
                setDeptFilter("all");
                setAssigneeFilter("");
                setPriorityFilter("");
              })
            }
          >
            Xoá bộ lọc
          </button>
        )}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span className="tiny muted">
            Hiển thị {items.length}/{total} nhiệm vụ
          </span>
          <SegmentControl
            options={VIEW_OPTIONS}
            value={view}
            onChange={(key) => {
              setView(key);
              setPage(1);
            }}
          />
        </div>
      </div>

      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty={items.length === 0}
        emptyMessage="Không có nhiệm vụ phù hợp bộ lọc"
      >
        {view === "kanban" ? (
          <KanbanBoard tasks={items} onOpen={openTask} />
        ) : (
          <TaskTable tasks={items} onOpen={openTask} />
        )}
      </DataState>

      {pageCount > 1 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 14,
          }}
        >
          <button className="btn sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trang trước
          </button>
          <span className="tiny muted">
            Trang {page}/{pageCount}
          </span>
          <button className="btn sm" type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Trang sau
          </button>
        </div>
      )}

      <TaskDrawer
        task={detail.data}
        loading={detail.loading}
        error={detail.error}
        onRetry={detail.reload}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onToggleChecklist={toggleChecklist}
        onSendComment={sendComment}
        onSave={saveTask}
      />
      <NewTaskForm open={formOpen} onClose={() => setFormOpen(false)} onCreate={submitNewTask} />
    </div>
  );
}
