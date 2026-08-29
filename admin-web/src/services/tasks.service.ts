import type { Comment, Task, TimelineItem } from "@/types";
import { appConfig } from "@/config/app.config";
import { ApiError, apiClient, buildQuery, type Paged } from "@/services/api";
import { mockTaskComments, mockTaskLog, taskAttachments, tasks as mockTasks } from "@/mocks/tasks";

/**
 * Lớp dịch vụ phân hệ Quản lý nhiệm vụ — bọc toàn bộ endpoint /tasks của backend.
 *
 * Backend dùng khoá chính là `code` (NV-2601); giao diện dùng `Task.id`,
 * nên mọi bản ghi trả về đều được ánh xạ `code → id`.
 *
 * Khi `appConfig.api.useMocks === true`, service phục vụ dữ liệu từ
 * `src/mocks/tasks.ts` để demo được lúc chưa có backend. Nhánh rẽ mock chỉ
 * nằm trong file này, các trang không cần biết.
 */

/** Nhiệm vụ kèm phần chi tiết (bình luận, nhật ký, tệp) backend trả về */
export interface TaskDetail extends Task {
  comments: Comment[];
  timeline: TimelineItem[];
  attachments: string[];
}

/** Bộ lọc + phân trang cho GET /tasks (gửi lên máy chủ, không lọc ở trình duyệt) */
export interface TaskQuery {
  status?: string;
  department?: string;
  assignee?: string;
  priority?: string;
  /** Từ khoá tìm theo mã / tiêu đề / mô tả */
  q?: string;
  page?: number;
  limit?: number;
}

/** Thân yêu cầu POST /tasks */
export interface CreateTaskInput {
  title: string;
  assignee: string;
  department: string;
  /** dd/MM/yyyy */
  deadline: string;
  priority?: string;
  description?: string;
  checklist?: { title: string }[];
}

/** Thân yêu cầu PATCH /tasks/:code — mọi trường đều tuỳ chọn */
export interface UpdateTaskInput {
  title?: string;
  assignee?: string;
  department?: string;
  /** dd/MM/yyyy */
  deadline?: string;
  priority?: string;
  status?: string;
  progress?: number;
  description?: string;
  collaborators?: string[];
}

/** Bản ghi thô backend trả về — khoá chính là `code`, chưa có `id` */
interface RawTask extends Omit<Task, "id"> {
  code: string;
  comments?: Comment[];
  timeline?: TimelineItem[];
  attachments?: string[];
}

/** Ánh xạ bản ghi backend sang kiểu dùng trong giao diện */
function toTaskDetail(raw: RawTask): TaskDetail {
  const { code, comments, timeline, attachments, ...rest } = raw;
  return {
    ...rest,
    id: code,
    collaborators: rest.collaborators ?? [],
    checklist: rest.checklist ?? [],
    comments: comments ?? [],
    timeline: timeline ?? [],
    attachments: attachments ?? [],
  };
}

/** Thông báo lỗi tiếng Việt để hiện toast sau thao tác ghi */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Thao tác không thành công, vui lòng thử lại";
}

/* ───────────────────────── Chế độ mock ───────────────────────── */

/** Kho dữ liệu mock giữ trong bộ nhớ để thao tác ghi vẫn phản hồi được khi demo */
let mockStore: TaskDetail[] | null = null;

function store(): TaskDetail[] {
  if (!mockStore) {
    mockStore = mockTasks.map((task) => ({
      ...task,
      comments: mockTaskComments(task),
      timeline: mockTaskLog(task),
      attachments: [...taskAttachments],
    }));
  }
  return mockStore;
}

function mockDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, appConfig.api.mockDelayMs));
}

/** Tìm nhiệm vụ mock theo mã, ném lỗi 404 giống backend nếu không có */
function mockFind(code: string): TaskDetail {
  const found = store().find((t) => t.id === code);
  if (!found) throw new ApiError(`Không tìm thấy nhiệm vụ ${code}`, 404);
  return found;
}

/** Tiến độ = số việc con đã xong / tổng số việc con (khớp công thức backend) */
function calcProgress(checklist: { done: boolean }[]): number {
  if (!checklist.length) return 0;
  return Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);
}

/* ───────────────────────── Đọc dữ liệu ───────────────────────── */

/** Danh sách nhiệm vụ có lọc + phân trang phía máy chủ */
export async function listTasks(query: TaskQuery = {}): Promise<Paged<TaskDetail>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  if (appConfig.api.useMocks) {
    await mockDelay();
    const keyword = query.q?.trim().toLowerCase() ?? "";
    const matched = store().filter(
      (t) =>
        (!query.status || t.status === query.status) &&
        (!query.department || t.department === query.department) &&
        (!query.assignee || t.assignee === query.assignee) &&
        (!query.priority || t.priority === query.priority) &&
        (!keyword ||
          t.id.toLowerCase().includes(keyword) ||
          t.title.toLowerCase().includes(keyword) ||
          t.description.toLowerCase().includes(keyword)),
    );
    return {
      items: matched.slice((page - 1) * limit, page * limit),
      total: matched.length,
      page,
      limit,
    };
  }

  const res = await apiClient.get<Paged<RawTask>>(
    `/tasks${buildQuery({
      status: query.status,
      department: query.department,
      assignee: query.assignee,
      priority: query.priority,
      q: query.q,
      page,
      limit,
    })}`,
  );
  return {
    items: res.items.map(toTaskDetail),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

/** Chi tiết một nhiệm vụ theo mã NV-xxxx */
export async function getTask(code: string): Promise<TaskDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    return { ...mockFind(code) };
  }
  return toTaskDetail(await apiClient.get<RawTask>(`/tasks/${encodeURIComponent(code)}`));
}

/* ───────────────────────── Thao tác ghi ───────────────────────── */

/** Giao nhiệm vụ mới — backend tự cấp mã NV-xxxx */
export async function createTask(input: CreateTaskInput): Promise<TaskDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const list = store();
    const max = list.reduce((acc, t) => Math.max(acc, Number.parseInt(t.id.replace("NV-", ""), 10) || 0), 0);
    const created: TaskDetail = {
      id: `NV-${max + 1}`,
      title: input.title,
      sourceLabel: "Giao trực tiếp",
      sourceType: "hop",
      assignee: input.assignee,
      department: input.department,
      deadline: input.deadline,
      progress: 0,
      status: "moi",
      priority: (input.priority ?? "tb") as Task["priority"],
      assigner: "Nguyễn Văn Bình",
      collaborators: [],
      description: input.description ?? "",
      checklist: (input.checklist ?? []).map((c) => ({
        title: c.title,
        done: false,
      })),
      comments: [],
      timeline: [],
      attachments: [],
    };
    list.unshift(created);
    return { ...created };
  }
  return toTaskDetail(await apiClient.post<RawTask>("/tasks", input));
}

/** Cập nhật thông tin / trạng thái / tiến độ nhiệm vụ */
export async function updateTask(code: string, input: UpdateTaskInput): Promise<TaskDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const task = mockFind(code);
    Object.assign(task, input as Partial<TaskDetail>);
    if (input.status === "xong") task.progress = 100;
    return { ...task };
  }
  return toTaskDetail(await apiClient.patch<RawTask>(`/tasks/${encodeURIComponent(code)}`, input));
}

/** Tick / bỏ tick một việc con — backend tính lại tiến độ và trả về nhiệm vụ mới */
export async function toggleChecklistItem(code: string, index: number, done: boolean): Promise<TaskDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const task = mockFind(code);
    if (!task.checklist[index]) throw new ApiError(`Không tìm thấy việc con số ${index}`, 404);
    task.checklist = task.checklist.map((c, i) => (i === index ? { ...c, done } : c));
    task.progress = calcProgress(task.checklist);
    if (task.progress === 100 && task.status !== "xong") task.status = "cho";
    return { ...task };
  }
  return toTaskDetail(
    await apiClient.patch<RawTask>(`/tasks/${encodeURIComponent(code)}/checklist/${index}`, { done }),
  );
}

/** Thêm ý kiến trao đổi vào nhiệm vụ */
export async function addTaskComment(code: string, content: string): Promise<TaskDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const task = mockFind(code);
    task.comments = [
      {
        authorName: "Nguyễn Văn Bình",
        authorInitials: "VB",
        authorColor: "var(--navy)",
        time: "Vừa xong",
        content,
      },
      ...task.comments,
    ];
    return { ...task };
  }
  return toTaskDetail(await apiClient.post<RawTask>(`/tasks/${encodeURIComponent(code)}/comments`, { content }));
}

/** Xoá nhiệm vụ — chỉ tài khoản quản trị hệ thống dùng được */
export async function deleteTask(code: string): Promise<void> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    mockStore = store().filter((t) => t.id !== code);
    return;
  }
  await apiClient.delete<{ deleted: boolean }>(`/tasks/${encodeURIComponent(code)}`);
}
