"use client";

import { useState } from "react";
import { taskPriorities, taskStatuses } from "@/config/status.config";
import { fetchDepartments, fetchStaffDirectory, findStaffIn } from "@/services/catalogs.service";
import type { CreateTaskInput, TaskDetail, UpdateTaskInput } from "@/services/tasks.service";
import { useCatalog } from "@/hooks/useCatalog";
import { Drawer } from "@/components/ui/Drawer";

/**
 * Form giao việc mới / sửa nhiệm vụ — một component cho cả hai việc.
 *
 * Hai chế độ chỉ khác nhau ở giá trị khởi tạo, endpoint được gọi (POST /tasks
 * hay PATCH /tasks/:code) và bộ trường hiển thị (sửa thì thêm trạng thái).
 * Tách thành hai component là nhân đôi toàn bộ phần kiểm tra dữ liệu và danh
 * mục cán bộ / bộ phận.
 *
 * Câu hỏi mở #6 (chờ khách hàng xác nhận):
 * - Bộ trường của form (có cần nguồn liên kết, cán bộ phối hợp, tệp đính kèm ngay khi giao?).
 * - Cơ chế thông báo người nhận việc (ZNS / push / email nội bộ) khi nhiệm vụ được giao.
 * Hiện giữ bộ trường tối thiểu theo mockup đã duyệt.
 */

interface FormState {
  title: string;
  assignee: string;
  department: string;
  deadline: string; // yyyy-mm-dd (input type=date)
  priority: string;
  status: string;
  description: string;
  checklist: { title: string; done: boolean }[];
}

const EMPTY_FORM: FormState = {
  title: "",
  assignee: "",
  department: "",
  deadline: "",
  priority: "tb",
  status: "moi",
  description: "",
  checklist: [],
};

/** "2026-09-10" -> "10/09/2026" */
function toDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** "10/09/2026" -> "2026-09-10" cho input type=date; chuỗi không đúng dạng trả rỗng */
function toInputDate(displayDate: string): string {
  const matched = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(displayDate.trim());
  return matched ? `${matched[3]}-${matched[2]}-${matched[1]}` : "";
}

/** Dựng giá trị khởi tạo của form từ nhiệm vụ đang sửa */
function formOf(task: TaskDetail): FormState {
  return {
    title: task.title,
    assignee: task.assignee,
    department: task.department,
    deadline: toInputDate(task.deadline),
    priority: task.priority,
    status: task.status,
    description: task.description,
    checklist: task.checklist.map((c) => ({ title: c.title, done: c.done })),
  };
}

export function TaskForm({
  open,
  onClose,
  task,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Nhiệm vụ cần sửa; `null` là chế độ giao việc mới.
   * Đổi `task.id` thì form tự nạp lại giá trị.
   */
  task: TaskDetail | null;
  /** Gọi POST /tasks; chờ máy chủ trả lời xong mới đóng form */
  onCreate: (input: CreateTaskInput) => Promise<void>;
  /** Gọi PATCH /tasks/:code; chỉ gửi những trường thực sự đổi */
  onUpdate: (patch: UpdateTaskInput) => Promise<void>;
}) {
  // Danh mục dùng chung lấy từ API (GET /catalogs/departments, /catalogs/staff)
  const departments = useCatalog(fetchDepartments);
  const staffDirectory = useCatalog(fetchStaffDirectory);

  const editing = task !== null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  /** Ô nhập việc con mới — thêm vào danh sách khi bấm Enter hoặc nút Thêm */
  const [newItem, setNewItem] = useState("");

  /*
   * Nạp lại giá trị khi mở nhiệm vụ khác (hoặc chuyển sang giao việc mới).
   * Điều chỉnh state NGAY TRONG RENDER — khuôn mẫu đang dùng ở TaskDrawer và các
   * drawer khác: không tạo thêm một lượt render trung gian.
   */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const formKey = task?.id ?? "__new__";
  if (formKey !== loadedId) {
    setLoadedId(formKey);
    setForm(task ? formOf(task) : EMPTY_FORM);
    setErrors({});
    setNewItem("");
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /** Chọn người thực hiện — tự điền bộ phận theo danh bạ */
  const pickAssignee = (name: string) => {
    setForm((prev) => ({
      ...prev,
      assignee: name,
      department: findStaffIn(staffDirectory, name)?.department ?? prev.department,
    }));
    setErrors((prev) => ({
      ...prev,
      assignee: undefined,
      department: undefined,
    }));
  };

  const addItem = () => {
    const title = newItem.trim();
    if (!title) return;
    set("checklist", [...form.checklist, { title, done: false }]);
    setNewItem("");
  };

  const removeItem = (index: number) => {
    set(
      "checklist",
      form.checklist.filter((_, i) => i !== index),
    );
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) next.title = "Vui lòng nhập tiêu đề nhiệm vụ";
    if (!form.assignee) next.assignee = "Vui lòng chọn người thực hiện";
    if (!form.department) next.department = "Vui lòng chọn bộ phận chủ trì";
    if (!form.deadline) next.deadline = "Vui lòng chọn hạn xử lý";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Chỉ gửi trường thực sự đổi so với bản ghi hiện có.
   *
   * Gửi cả bộ sẽ ghi đè `checklist` mỗi lần lưu, làm backend tính lại tiến độ và
   * đẩy thêm một mục nhật ký dù cán bộ chỉ sửa tiêu đề.
   */
  const diffOf = (current: TaskDetail): UpdateTaskInput => {
    const patch: UpdateTaskInput = {};
    const title = form.title.trim();
    const description = form.description.trim();
    const deadline = toDisplayDate(form.deadline);

    if (title !== current.title) patch.title = title;
    if (form.assignee !== current.assignee) patch.assignee = form.assignee;
    if (form.department !== current.department) patch.department = form.department;
    if (deadline !== current.deadline) patch.deadline = deadline;
    if (form.priority !== current.priority) patch.priority = form.priority;
    if (form.status !== current.status) patch.status = form.status;
    if (description !== current.description) patch.description = description;

    const before = JSON.stringify(current.checklist.map((c) => [c.title, c.done]));
    const after = JSON.stringify(form.checklist.map((c) => [c.title, c.done]));
    if (before !== after) patch.checklist = form.checklist;

    return patch;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (task) {
        const patch = diffOf(task);
        // Không đổi gì thì không gọi API — tránh ghi thêm mục nhật ký rỗng
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        await onUpdate(patch);
      } else {
        await onCreate({
          title: form.title.trim(),
          assignee: form.assignee,
          department: form.department,
          deadline: toDisplayDate(form.deadline),
          priority: form.priority || "tb",
          description: form.description.trim(),
          checklist: form.checklist.map((c) => ({ title: c.title })),
        });
        setForm(EMPTY_FORM);
        setErrors({});
      }
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setErrors({});
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={editing ? `Sửa nhiệm vụ ${task.id}` : "Giao việc mới"}
      meta={
        editing ? "Thay đổi được ghi vào nhật ký xử lý của nhiệm vụ" : "Nhiệm vụ sẽ được đưa vào cột Mới giao"
      }
      footer={
        <>
          <button className="btn pri" type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Giao việc"}
          </button>
          <button className="btn" type="button" disabled={saving} onClick={close}>
            Huỷ
          </button>
        </>
      }
    >
      <div className={saving ? "saving" : undefined}>
        <div className="fgroup">
          <label>
            Tiêu đề nhiệm vụ <span className="req">*</span>
          </label>
          <input
            className={`finp ${errors.title ? "err" : ""}`}
            placeholder="VD: Rà soát hồ sơ đất đai Thôn Đông…"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          {errors.title && <div className="ferr">{errors.title}</div>}
        </div>

        <div className="fgroup">
          <label>
            Người thực hiện <span className="req">*</span>
          </label>
          <select
            className={`finp ${errors.assignee ? "err" : ""}`}
            value={form.assignee}
            onChange={(e) => pickAssignee(e.target.value)}
          >
            <option value="">— Chọn cán bộ —</option>
            {/* Người đang thực hiện có thể đã rời danh bạ; vẫn phải giữ được tên cũ */}
            {form.assignee && !staffDirectory.some((s) => s.name === form.assignee) && (
              <option value={form.assignee}>{form.assignee}</option>
            )}
            {staffDirectory.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} · {s.title}
              </option>
            ))}
          </select>
          {errors.assignee && <div className="ferr">{errors.assignee}</div>}
        </div>

        <div className="fgroup">
          <label>
            Bộ phận chủ trì <span className="req">*</span>
          </label>
          <select
            className={`finp ${errors.department ? "err" : ""}`}
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          >
            <option value="">— Chọn bộ phận —</option>
            {form.department && !departments.includes(form.department) && (
              <option value={form.department}>{form.department}</option>
            )}
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {errors.department && <div className="ferr">{errors.department}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="fgroup">
            <label>
              Hạn xử lý <span className="req">*</span>
            </label>
            <input
              type="date"
              className={`finp ${errors.deadline ? "err" : ""}`}
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
            {errors.deadline && <div className="ferr">{errors.deadline}</div>}
          </div>
          <div className="fgroup">
            <label>Mức ưu tiên</label>
            <select className="finp" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {taskPriorities.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Trạng thái chỉ sửa được ở nhiệm vụ đã có; nhiệm vụ mới luôn vào "Mới giao" */}
        {editing && (
          <div className="fgroup">
            <label>Trạng thái</label>
            <select className="finp" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {taskStatuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="fhint">Chuyển sang trạng thái Hoàn thành sẽ đưa tiến độ về 100%.</div>
          </div>
        )}

        <div className="fgroup">
          <label>Mô tả nhiệm vụ</label>
          <textarea
            className="finp"
            placeholder="Nội dung, yêu cầu, kết quả cần đạt…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="fgroup">
          <label>Nhiệm vụ con</label>
          {form.checklist.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {form.checklist.map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: "1px solid var(--bd)",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{item.title}</span>
                  {item.done && (
                    <span className="tiny" style={{ color: "var(--green)", fontWeight: 600 }}>
                      Đã xong
                    </span>
                  )}
                  <button
                    className="btn sm"
                    type="button"
                    title="Bỏ việc con này khỏi nhiệm vụ"
                    style={{ color: "var(--red)" }}
                    onClick={() => removeItem(i)}
                  >
                    Bỏ
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="finp"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Thêm một việc con…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button className="btn" type="button" disabled={!newItem.trim()} onClick={addItem}>
              Thêm
            </button>
          </div>
          <div className="fhint">
            Tiến độ nhiệm vụ tính theo số việc con đã hoàn thành. Bỏ hết việc con thì tiến độ về 0%.
          </div>
        </div>
      </div>
    </Drawer>
  );
}
