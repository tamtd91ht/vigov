"use client";

import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { taskPriorities, taskStatuses } from "@/config/status.config";
import { fetchDepartments, fetchStaffDirectory } from "@/services/catalogs.service";
import {
  addTaskAttachments,
  addTaskComment,
  apiErrorMessage,
  createTask,
  deleteTask,
  exportTasksExcel,
  getTask,
  listTasks,
  removeTaskAttachment,
  restoreTask,
  toggleChecklistItem,
  updateTask,
  type CreateTaskInput,
  type TaskDetail,
  type UpdateTaskInput,
} from "@/services/tasks.service";
import { REALTIME_EVENTS } from "@/services/realtime.service";
import { useApiResource } from "@/hooks/useApiResource";
import { useRealtime } from "@/hooks/useRealtime";
import { useCatalog } from "@/hooks/useCatalog";
import { Icon } from "@/lib/icons";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { FilterChips } from "@/components/ui/FilterChips";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import type { DateRange } from "@/config/date-range.config";
import { useToast } from "@/components/ui/Toast";
import { authService, getServerSession } from "@/services/auth";
import { findRole } from "@/config/roles.config";
import { Drawer } from "@/components/ui/Drawer";
import { KanbanBoard } from "./KanbanBoard";
import { TaskTable } from "./TaskTable";
import { TaskDrawer } from "./TaskDrawer";
import { TaskForm } from "./TaskForm";

const VIEW_OPTIONS = [
  { key: "kanban", label: "Kanban" },
  { key: "list", label: "Bảng" },
];

/** Hai thùng dữ liệu loại trừ nhau: đang dùng / đã xoá mềm */
const SCOPE_OPTIONS = [
  { key: "active", label: "Đang dùng" },
  { key: "deleted", label: "Đã xoá" },
];

const DELETE_NOTE =
  "Xoá mềm: nhiệm vụ biến mất khỏi Kanban, bảng danh sách và các báo cáo, nhưng bản ghi " +
  "vẫn nằm trong cơ sở dữ liệu — nhật ký xử lý, ý kiến trao đổi và tệp minh chứng đều còn. " +
  'Khôi phục lại được ở bộ lọc "Đã xoá".';

/** Kanban cần đủ nhiệm vụ để xếp 5 cột nên lấy trang lớn hơn chế độ bảng */
const KANBAN_PAGE_SIZE = 100;
const LIST_PAGE_SIZE = 20;

export function TasksPage() {
  const { showToast } = useToast();
  /**
   * Mã nhiệm vụ trên thanh địa chỉ (/tasks?code=NV-2601) — tìm kiếm toàn cục và
   * trung tâm thông báo điều hướng sang đây kèm mã để mở sẵn ngăn chi tiết.
   */
  const codeParam = useSearchParams().get("code");

  // Danh mục dùng chung lấy từ API (GET /catalogs/departments, /catalogs/staff)
  const departments = useCatalog(fetchDepartments);
  const staffDirectory = useCatalog(fetchStaffDirectory);

  const [view, setView] = useState("kanban");
  const [deptFilter, setDeptFilter] = useState("all");
  /* Ba bộ lọc dưới đây chọn được NHIỀU giá trị — mảng rỗng nghĩa là không lọc */
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Nhiệm vụ đang mở trong form: `null` = giao việc mới, undefined = form đóng */
  const [formTask, setFormTask] = useState<TaskDetail | null | undefined>(undefined);
  /** Đang xem thùng nhiệm vụ đã xoá mềm thay vì danh sách đang dùng */
  const [deletedView, setDeletedView] = useState(false);
  /** Nhiệm vụ chờ xác nhận xoá — mở drawer nhập lý do */
  const [deleteTarget, setDeleteTarget] = useState<TaskDetail | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const limit = view === "kanban" ? KANBAN_PAGE_SIZE : LIST_PAGE_SIZE;

  /**
   * Xoá / khôi phục nhiệm vụ yêu cầu quyền `tasks:admin` ở backend.
   * Ẩn hẳn nút với vai trò không đủ quyền thay vì để bấm rồi nhận 403.
   */
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const canDelete = findRole(session?.roleKey ?? "")?.modules.tasks === "admin";

  // Bộ lọc và phân trang đều là tham số truy vấn gửi lên máy chủ
  const list = useApiResource(
    () =>
      listTasks({
        department: deptFilter === "all" ? undefined : deptFilter,
        assignee: assigneeFilter,
        priority: priorityFilter,
        status: statusFilter,
        from: range.from || undefined,
        to: range.to || undefined,
        deleted: deletedView || undefined,
        page,
        limit,
      }),
    [
      deptFilter,
      assigneeFilter,
      priorityFilter,
      statusFilter,
      range.from,
      range.to,
      deletedView,
      page,
      limit,
    ],
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

  /**
   * Xuất Excel theo ĐÚNG bộ lọc đang áp dụng (không chỉ trang đang xem).
   * Máy chủ chặn khi bộ lọc khớp quá nhiều dòng và trả thông báo tiếng Việt —
   * hiện nguyên thông báo đó để cán bộ biết phải thu hẹp bộ lọc.
   */
  const exportExcel = async () => {
    setExporting(true);
    try {
      const fileName = await exportTasksExcel({
        department: deptFilter === "all" ? undefined : deptFilter,
        assignee: assigneeFilter,
        priority: priorityFilter,
        status: statusFilter,
        from: range.from || undefined,
        to: range.to || undefined,
        deleted: deletedView || undefined,
      });
      showToast(`Đã tải tệp ${fileName}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  /*
   * Mở sẵn ngăn chi tiết theo mã trên thanh địa chỉ. Dùng lại đúng state của
   * drawer thay vì dựng luồng dữ liệu riêng: `detail` đã tự tải theo `openTaskId`.
   *
   * Điều chỉnh state NGAY TRONG RENDER (khuôn mẫu đang dùng ở các drawer khác)
   * thay vì trong effect: cách này không tạo thêm một lượt render trung gian và
   * cán bộ đóng drawer rồi thì không bị mở lại.
   */
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  if (codeParam && codeParam !== appliedCode) {
    setAppliedCode(codeParam);
    openTask(codeParam);
  }

  /*
   * Có biến động nhiệm vụ ở nơi khác thì tải lại danh sách (và bản chi tiết đang
   * mở). Backend chỉ gửi tín hiệu gọn nên bắt buộc phải hỏi lại API.
   */
  useRealtime({
    [REALTIME_EVENTS.taskChanged]: () => {
      list.reload();
      if (openTaskId) detail.reload();
    },
  });

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
      setFormTask(undefined);
      setPage(1);
      list.reload();
      showToast(`Đã giao việc ${created.id} cho ${created.assignee}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /**
   * Lưu nội dung sửa từ form. Tải lại cả danh sách vì sửa người thực hiện / bộ
   * phận / trạng thái có thể làm nhiệm vụ rơi ra ngoài bộ lọc đang áp dụng —
   * lúc đó nó phải biến mất khỏi bảng, không phải nằm lại với dữ liệu mới.
   */
  const submitEditTask = async (patch: UpdateTaskInput) => {
    if (!formTask) return;
    try {
      const updated = await updateTask(formTask.id, patch);
      setFormTask(undefined);
      applyTask(updated);
      list.reload();
      showToast(`Đã cập nhật nhiệm vụ ${updated.id}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Xoá MỀM nhiệm vụ: đặt cờ xoá, dữ liệu và nhật ký vẫn còn */
  const submitDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await deleteTask(target.id, deleteReason);
      setDeleteTarget(null);
      setDeleteReason("");
      setDrawerOpen(false);
      list.reload();
      showToast(`Đã xoá nhiệm vụ ${target.id}. Dữ liệu vẫn được giữ, khôi phục ở bộ lọc "Đã xoá".`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Khôi phục nhiệm vụ đã xoá mềm — bản ghi trở lại danh sách đang dùng */
  const restore = async () => {
    if (!openTaskId) return;
    try {
      const restored = await restoreTask(openTaskId);
      setDrawerOpen(false);
      list.reload();
      showToast(`Đã khôi phục nhiệm vụ ${restored.id}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Đính kèm tệp minh chứng vừa tải lên vào nhiệm vụ đang mở */
  const attachFile = async (fileId: string) => {
    if (!openTaskId) return;
    try {
      applyTask(await addTaskAttachments(openTaskId, [fileId]));
      showToast("Đã đính kèm tệp minh chứng vào nhiệm vụ");
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const removeFile = async (fileId: string) => {
    if (!openTaskId) return;
    try {
      applyTask(await removeTaskAttachment(openTaskId, fileId));
      showToast("Đã gỡ tệp đính kèm khỏi nhiệm vụ");
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
          /* Thùng "Đã xoá" là chỗ khôi phục, không phải chỗ giao việc mới */
          deletedView ? undefined : (
            <button className="btn pri" type="button" onClick={() => setFormTask(null)}>
              <Icon name="plus" size={15} />
              Giao việc mới
            </button>
          )
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
        <MultiSelect
          options={staffDirectory.map((st) => ({
            value: st.name,
            label: st.name,
            hint: st.department,
          }))}
          value={assigneeFilter}
          onChange={(next) => changeFilter(() => setAssigneeFilter(next))}
          allLabel="Tất cả người thực hiện"
          searchPlaceholder="Nhập tên cán bộ để tìm…"
        />
        <MultiSelect
          options={taskPriorities.map((p) => ({ value: p.key, label: p.label }))}
          value={priorityFilter}
          onChange={(next) => changeFilter(() => setPriorityFilter(next))}
          allLabel="Tất cả mức ưu tiên"
          searchPlaceholder="Tìm mức ưu tiên…"
        />
        <MultiSelect
          options={taskStatuses.map((st) => ({ value: st.key, label: st.label }))}
          value={statusFilter}
          onChange={(next) => changeFilter(() => setStatusFilter(next))}
          allLabel="Tất cả trạng thái"
          searchPlaceholder="Tìm trạng thái…"
        />
        <DateRangeFilter
          value={range}
          onChange={(next) => changeFilter(() => setRange(next))}
          allLabel="Toàn bộ thời gian"
        />
        {(deptFilter !== "all" ||
          assigneeFilter.length > 0 ||
          priorityFilter.length > 0 ||
          statusFilter.length > 0 ||
          range.from ||
          range.to) && (
          <button
            className="btn sm"
            type="button"
            onClick={() =>
              changeFilter(() => {
                setDeptFilter("all");
                setAssigneeFilter([]);
                setPriorityFilter([]);
                setStatusFilter([]);
                setRange({ from: "", to: "" });
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
          <button
            className="btn sm"
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || items.length === 0}
            title="Xuất toàn bộ nhiệm vụ khớp bộ lọc ra tệp Excel"
          >
            <Icon name="file" size={15} />
            {exporting ? "Đang xuất…" : "Xuất Excel"}
          </button>
          <SegmentControl
            options={SCOPE_OPTIONS}
            value={deletedView ? "deleted" : "active"}
            onChange={(key) =>
              changeFilter(() => {
                setDeletedView(key === "deleted");
                // Thùng đã xoá xem dạng bảng dễ đối chiếu hơn Kanban theo trạng thái
                if (key === "deleted") setView("list");
              })
            }
          />
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
        emptyMessage={deletedView ? "Chưa có nhiệm vụ nào bị xoá" : "Không có nhiệm vụ phù hợp bộ lọc"}
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
        onAttachFile={attachFile}
        onRemoveFile={removeFile}
        onEdit={() => detail.data && setFormTask(detail.data)}
        onDelete={() => {
          setDeleteReason("");
          setDeleteTarget(detail.data ?? null);
        }}
        onRestore={restore}
        canDelete={canDelete}
      />

      <TaskForm
        open={formTask !== undefined}
        onClose={() => setFormTask(undefined)}
        task={formTask ?? null}
        onCreate={submitNewTask}
        onUpdate={submitEditTask}
      />

      {/* Drawer xác nhận xoá mềm nhiệm vụ */}
      <Drawer
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Xoá nhiệm vụ"
        meta={deleteTarget ? `${deleteTarget.id} · ${deleteTarget.title}` : undefined}
        footer={
          <>
            <button type="button" className="btn danger" onClick={() => void submitDelete()}>
              <Icon name="trash" size={15} />
              Xác nhận xoá
            </button>
            <button
              type="button"
              className="btn"
              style={{ marginLeft: "auto" }}
              onClick={() => setDeleteTarget(null)}
            >
              Huỷ
            </button>
          </>
        }
      >
        <div className="note" style={{ marginBottom: 16 }}>
          {DELETE_NOTE}
        </div>
        <div className="fgroup">
          <label htmlFor="task-delete-reason">Lý do xoá</label>
          <textarea
            id="task-delete-reason"
            className="finp"
            value={deleteReason}
            placeholder="Ví dụ: Giao trùng với NV-2599, nhiệm vụ kiểm thử…"
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <div className="fhint">
            Không bắt buộc. Lý do được ghi vào nhật ký xử lý của nhiệm vụ để truy vết.
          </div>
        </div>
      </Drawer>
    </div>
  );
}
