"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { fetchDepartments } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { urgencyLevels, confidentialityLevels } from "@/config/status.config";
import { incomingDocTypes } from "@/mocks/documents";
import type { CreateDocumentInput } from "@/services/documents.service";

interface FormState {
  docType: string;
  refNo: string;
  date: string; // yyyy-mm-dd (input type=date)
  sender: string;
  summary: string;
  department: string;
  deadline: string; // yyyy-mm-dd, có thể trống
  confidentiality: string;
  urgency: string;
  signer: string;
}

const EMPTY_FORM: FormState = {
  docType: incomingDocTypes[0],
  refNo: "",
  date: "",
  sender: "",
  summary: "",
  // Bỏ trống — bộ phận mặc định là mục đầu của danh mục sau khi tải xong
  department: "",
  deadline: "",
  confidentiality: "Thường",
  urgency: "Thường",
  signer: "",
};

/** yyyy-mm-dd -> dd/mm/yyyy */
function toVnDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ReceiveDocForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** Gọi POST /documents; số đến do máy chủ cấp */
  onSubmit: (values: CreateDocumentInput) => Promise<void>;
}) {
  // Danh mục bộ phận lấy từ API (GET /catalogs/departments)
  const departments = useCatalog(fetchDepartments);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  /** Mã tệp bản scan vừa tải lên; rỗng nghĩa là vào sổ trước, đính kèm sau */
  const [scanFileId, setScanFileId] = useState("");
  /** Đổi khoá để dựng lại ô tải tệp khi mở lại form (xoá tệp của lượt trước) */
  const [uploadKey, setUploadKey] = useState(0);

  /** Chưa chọn thì lấy bộ phận đầu danh mục làm mặc định */
  const department = form.department || departments[0] || "";

  // Làm mới form mỗi lần mở lại (điều chỉnh state trong render)
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setScanFileId("");
      setUploadKey((k) => k + 1);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.refNo.trim()) nextErrors.refNo = "Vui lòng nhập số/ký hiệu văn bản";
    if (!form.date) nextErrors.date = "Vui lòng chọn ngày văn bản đến";
    if (!form.sender.trim()) nextErrors.sender = "Vui lòng nhập cơ quan ban hành";
    if (!form.summary.trim()) nextErrors.summary = "Vui lòng nhập trích yếu nội dung";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit({
        docType: form.docType,
        refNo: form.refNo.trim(),
        date: toVnDate(form.date),
        sender: form.sender.trim(),
        summary: form.summary.trim(),
        department,
        // Bỏ trống hạn xử lý thì không gửi trường này (backend từ chối chuỗi rỗng)
        deadline: form.deadline ? toVnDate(form.deadline) : undefined,
        confidentiality: form.confidentiality,
        urgency: form.urgency,
        signer: form.signer.trim(),
        pageCount: 1,
        // Chưa đính kèm bản scan thì không gửi trường này để backend giữ nguyên giá trị rỗng
        scanFileId: scanFileId || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const req = <span className="req"> *</span>;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tiếp nhận văn bản đến"
      meta="Vào sổ văn bản đến — đính kèm bản scan để chạy bóc tách OCR"
      footer={
        <>
          <button type="button" className="btn pri" disabled={saving} onClick={() => void submit()}>
            <Icon name="plus" size={15} />
            {saving ? "Đang vào sổ…" : "Vào sổ văn bản"}
          </button>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      <div className={saving ? "saving" : undefined}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 14px",
          }}
        >
          <div className="fgroup">
            <label>Loại văn bản{req}</label>
            <select className="finp" value={form.docType} onChange={(e) => set("docType", e.target.value)}>
              {incomingDocTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="fgroup">
            <label>Số/Ký hiệu{req}</label>
            <input
              className={errors.refNo ? "finp err" : "finp"}
              value={form.refNo}
              onChange={(e) => set("refNo", e.target.value)}
              placeholder="VD: 214/UBND-VP"
            />
            {errors.refNo && <div className="ferr">{errors.refNo}</div>}
          </div>
          <div className="fgroup">
            <label>Ngày đến{req}</label>
            <input
              className={errors.date ? "finp err" : "finp"}
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
            {errors.date && <div className="ferr">{errors.date}</div>}
          </div>
          <div className="fgroup">
            <label>Hạn xử lý</label>
            <input
              className="finp"
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
            <div className="fhint">Bỏ trống nếu văn bản không yêu cầu hạn</div>
          </div>
        </div>

        <div className="fgroup">
          <label>Cơ quan ban hành{req}</label>
          <input
            className={errors.sender ? "finp err" : "finp"}
            value={form.sender}
            onChange={(e) => set("sender", e.target.value)}
            placeholder="VD: UBND huyện Phú Xuyên"
          />
          {errors.sender && <div className="ferr">{errors.sender}</div>}
        </div>

        <div className="fgroup">
          <label>Trích yếu nội dung{req}</label>
          <textarea
            className={errors.summary ? "finp err" : "finp"}
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="Tóm tắt nội dung chính của văn bản"
          />
          {errors.summary && <div className="ferr">{errors.summary}</div>}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 14px",
          }}
        >
          <div className="fgroup">
            <label>Bộ phận chủ trì</label>
            <select className="finp" value={department} onChange={(e) => set("department", e.target.value)}>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="fgroup">
            <label>Người ký</label>
            <input
              className="finp"
              value={form.signer}
              onChange={(e) => set("signer", e.target.value)}
              placeholder="Chức danh và họ tên người ký"
            />
          </div>
          <div className="fgroup">
            <label>Độ mật</label>
            <select
              className="finp"
              value={form.confidentiality}
              onChange={(e) => set("confidentiality", e.target.value)}
            >
              {confidentialityLevels.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fgroup">
            <label>Độ khẩn</label>
            <select className="finp" value={form.urgency} onChange={(e) => set("urgency", e.target.value)}>
              {urgencyLevels.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bản scan lưu ở chế độ riêng tư: chỉ đọc được qua link ký sẵn cấp cho cán bộ */}
        <div className="fgroup">
          <label>Bản scan văn bản</label>
          <FileUpload
            key={uploadKey}
            purpose="scan"
            isPrivate
            placeholder="Kéo-thả bản scan vào đây hoặc bấm để chọn"
            onUploaded={(fileId) => setScanFileId(fileId)}
            onCleared={() => setScanFileId("")}
            disabled={saving}
          />
          <div className="fhint">
            Đính kèm ngay để chạy OCR bóc tách thông tin; có thể vào sổ trước rồi tải bản scan sau.
          </div>
        </div>
      </div>
    </Drawer>
  );
}
