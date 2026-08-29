"use client";

import { useState } from "react";
import { taskPriorities } from "@/config/status.config";
import { fetchDepartments, fetchStaffDirectory, findStaffIn } from "@/services/catalogs.service";
import type { CreateTaskInput } from "@/services/tasks.service";
import { useCatalog } from "@/hooks/useCatalog";
import { Drawer } from "@/components/ui/Drawer";

/**
 * Form giao việc mới — submit gọi thẳng POST /tasks, mã nhiệm vụ do máy chủ cấp.
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
  description: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  assignee: "",
  department: "",
  deadline: "",
  priority: "tb",
  description: "",
};

/** "2026-09-10" -> "10/09/2026" */
function toDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function NewTaskForm({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Gọi POST /tasks; chờ máy chủ trả lời xong mới đóng form */
  onCreate: (input: CreateTaskInput) => Promise<void>;
}) {
  // Danh mục dùng chung lấy từ API (GET /catalogs/departments, /catalogs/staff)
  const departments = useCatalog(fetchDepartments);
  const staffDirectory = useCatalog(fetchStaffDirectory);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

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

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) next.title = "Vui lòng nhập tiêu đề nhiệm vụ";
    if (!form.assignee) next.assignee = "Vui lòng chọn người thực hiện";
    if (!form.department) next.department = "Vui lòng chọn bộ phận chủ trì";
    if (!form.deadline) next.deadline = "Vui lòng chọn hạn xử lý";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onCreate({
        title: form.title.trim(),
        assignee: form.assignee,
        department: form.department,
        deadline: toDisplayDate(form.deadline),
        priority: form.priority || "tb",
        description: form.description.trim(),
        checklist: [],
      });
      setForm(EMPTY_FORM);
      setErrors({});
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
      title="Giao việc mới"
      meta="Nhiệm vụ sẽ được đưa vào cột Mới giao"
      footer={
        <>
          <button className="btn pri" type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Đang giao việc…" : "Giao việc"}
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

        <div className="fgroup">
          <label>Mô tả nhiệm vụ</label>
          <textarea
            className="finp"
            placeholder="Nội dung, yêu cầu, kết quả cần đạt…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
      </div>
    </Drawer>
  );
}
