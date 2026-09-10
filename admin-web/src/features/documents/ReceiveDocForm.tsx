"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { fetchDepartments, fetchDocumentTypes } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { urgencyLevels, confidentialityLevels } from "@/config/status.config";

import { previewDocumentOcr } from "@/services/documents.service";
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
  // Bỏ trống — loại văn bản mặc định là mục đầu của danh mục sau khi tải xong
  docType: "",
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

/**
 * dd/mm/yyyy (OCR trả về) -> yyyy-mm-dd (giá trị của input type=date).
 * Trả chuỗi rỗng nếu không đúng dạng — thà để trống còn hơn điền ngày sai vào
 * hồ sơ hành chính.
 */
function toIsoDate(vn: string): string {
  const m = (vn ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  // Chặn ngày vô nghĩa kiểu 32/13/2026 do OCR đọc sai chữ số
  if (day < 1 || day > 31 || month < 1 || month > 12) return "";
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Khớp giá trị OCR đọc được với một mục trong danh mục.
 *
 * VÌ SAO KHÔNG SO SÁNH TRỰC TIẾP: danh mục dùng "Hoả tốc" (dấu hỏi) trong khi
 * OCR trả "Hỏa tốc" (dấu ngã) — cùng một mức độ khẩn nhưng khác dấu, so bằng
 * `===` là trượt. Bỏ dấu rồi so là khớp được cả hai cách viết, và cũng khớp
 * khi OCR trả chữ hoa toàn bộ.
 *
 * Không khớp mục nào thì trả rỗng để nơi gọi GIỮ NGUYÊN giá trị đang chọn —
 * không được đặt bừa một mức độ mật cho văn bản hành chính.
 */
function matchCatalog(value: string, options: readonly { key: string }[]): string {
  const norm = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const target = norm(value);
  if (!target) return "";
  return options.find((o) => norm(o.key) === target)?.key ?? "";
}

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
  // Loại văn bản lấy từ API (GET /catalogs/document-types)
  const docTypes = useCatalog(fetchDocumentTypes);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  /** Mã tệp bản scan vừa tải lên; rỗng nghĩa là vào sổ trước, đính kèm sau */
  const [scanFileId, setScanFileId] = useState("");
  /** Đổi khoá để dựng lại ô tải tệp khi mở lại form (xoá tệp của lượt trước) */
  const [uploadKey, setUploadKey] = useState(0);
  /** Đang gọi OCR — chặn bấm quét hai lần và chặn lưu giữa lúc quét */
  const [scanning, setScanning] = useState(false);
  /** Thông báo kết quả quét gần nhất, hiện dưới nút */
  const [scanNote, setScanNote] = useState("");
  /**
   * Cảnh báo về nhà cung cấp OCR đang dùng, do backend trả kèm kết quả quét.
   *
   * Tách khỏi `scanNote`: `scanNote` nói kết quả lần quét vừa rồi (điền được mấy
   * trường), còn ô này nói dữ liệu của cán bộ được gửi đi đâu — hai việc khác
   * nhau, và cái sau phải nổi bật hơn.
   */
  const [scanWarning, setScanWarning] = useState("");
  /** Các trường form vừa được OCR điền hộ — dùng để gắn nhãn nhắc cán bộ rà lại */
  const [ocrFilled, setOcrFilled] = useState<Set<keyof FormState>>(new Set());

  /** Chưa chọn thì lấy bộ phận đầu danh mục làm mặc định */
  const department = form.department || departments[0] || "";
  /** Chưa chọn thì lấy loại văn bản đầu danh mục làm mặc định */
  const docType = form.docType || docTypes[0] || "";

  // Làm mới form mỗi lần mở lại (điều chỉnh state trong render)
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setScanFileId("");
      setUploadKey((k) => k + 1);
      setScanNote("");
      setOcrFilled(new Set());
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    /* Cán bộ đã tự sửa thì bỏ nhãn "OCR điền" — nhãn đó chỉ để nhắc rà soát
       giá trị máy đọc, giữ lại sau khi người dùng sửa là nói sai. */
    setOcrFilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  /**
   * Quét OCR bản scan vừa tải lên và điền hộ các trường trên biểu mẫu.
   *
   * Nguyên tắc: CHỈ điền, không tự lưu và không ghi đè thứ cán bộ đã nhập.
   * Trường OCR đọc rỗng thì để nguyên — thà trống còn hơn điền sai vào một hồ
   * sơ hành chính. Mọi trường vẫn sửa lại được sau khi điền.
   */
  const runScan = async () => {
    if (!scanFileId || scanning) return;
    setScanning(true);
    setScanNote("");
    setScanWarning("");
    try {
      const { fields, notice } = await previewDocumentOcr(scanFileId);
      /* Cảnh báo do backend gửi kèm — ví dụ nhà cung cấp đang dùng là dịch vụ
         miễn phí đặt ở nước ngoài. Hiện cho cán bộ biết bản scan đi đâu; giao
         diện không tự soạn nội dung này để đổi nhà cung cấp không phải sửa ở đây. */
      setScanWarning(notice ?? "");
      const byKey = new Map(fields.map((f) => [f.key, f]));
      const val = (key: string) => (byKey.get(key)?.value ?? "").trim();

      const filled = new Set<keyof FormState>();
      const patch: Partial<FormState> = {};

      /* Chỉ điền khi OCR đọc RA GIÁ TRỊ. Trường nào máy không đọc được thì giữ
         nguyên ô đang có — kể cả khi ô đó đang trống. */
      const refNo = val("refNo");
      if (refNo) { patch.refNo = refNo; filled.add("refNo"); }

      const issued = toIsoDate(val("issuedDate"));
      if (issued) { patch.date = issued; filled.add("date"); }

      const sender = val("sender");
      if (sender) { patch.sender = sender; filled.add("sender"); }

      const summary = val("summary");
      if (summary) { patch.summary = summary; filled.add("summary"); }

      const deadline = toIsoDate(val("deadline"));
      if (deadline) { patch.deadline = deadline; filled.add("deadline"); }

      const conf = matchCatalog(val("confidentiality"), confidentialityLevels);
      if (conf) { patch.confidentiality = conf; filled.add("confidentiality"); }

      const urg = matchCatalog(val("urgency"), urgencyLevels);
      if (urg) { patch.urgency = urg; filled.add("urgency"); }

      setForm((prev) => ({ ...prev, ...patch }));
      setOcrFilled(filled);
      // Xoá lỗi của những trường vừa được điền để không còn báo đỏ oan
      setErrors((prev) => {
        const next = { ...prev };
        for (const key of filled) delete next[key];
        return next;
      });

      setScanNote(
        filled.size > 0
          ? `Đã điền ${filled.size} trường từ bản scan. Vui lòng kiểm tra lại trước khi lưu.`
          : "Không đọc được thông tin nào từ bản scan. Vui lòng nhập thủ công.",
      );
    } catch (err: unknown) {
      setScanNote(
        err instanceof Error && err.message
          ? `Không quét được bản scan: ${err.message}`
          : "Không quét được bản scan. Vui lòng thử lại hoặc nhập thủ công.",
      );
    } finally {
      setScanning(false);
    }
  };

  /** Nhãn nhỏ cạnh tên trường, cho biết giá trị do OCR điền và cần rà lại */
  const ocrTag = (key: keyof FormState) =>
    ocrFilled.has(key) ? <span className="ocr">OCR</span> : null;

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
        docType,
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
      meta="Vào sổ văn bản đến — kéo bản scan vào rồi quét OCR để máy điền hộ thông tin"
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
        {/*
          Ô kéo-thả bản scan đặt Ở ĐẦU form, không phải cuối.

          VÌ SAO: đây là thứ tự làm việc thật của cán bộ văn thư — có tệp trong
          tay thì kéo vào và để máy đọc trước, các ô phía dưới được điền hộ, cán
          bộ chỉ rà lại. Đặt ô này ở cuối là bắt nhập tay hết rồi mới thấy chỗ
          tải tệp, đúng lúc không còn cần OCR nữa.

          Cũng khớp bố cục của mockup đã duyệt và của DocumentDrawer (tab
          "Thông tin & OCR" cũng đặt bản scan trên cùng) — hai màn cùng nói về
          bản scan thì không nên xếp ngược nhau.
        */}
        <div className="fgroup">
          {/* Bản scan lưu ở chế độ riêng tư: chỉ đọc được qua link ký sẵn cấp cho cán bộ */}
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
            Đính kèm rồi bấm <b>Quét OCR</b> để hệ thống điền hộ các trường bên dưới; có thể vào sổ
            trước rồi tải bản scan sau.
          </div>

          {/* Nút quét chỉ hiện khi ĐÃ có bản scan — không có tệp thì không quét được gì */}
          {scanFileId ? (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn sm pri"
                onClick={runScan}
                disabled={scanning || saving}
              >
                <Icon name={scanning ? "clock" : "layer"} size={15} />
                {scanning ? "Đang quét bản scan…" : "Quét OCR để điền hộ thông tin"}
              </button>
              {scanNote ? (
                <div className="fhint" style={{ marginTop: 8 }}>
                  {scanNote}
                </div>
              ) : null}
              {/* Cảnh báo về nhà cung cấp OCR — nội dung do backend gửi kèm kết quả */}
              {scanWarning ? (
                <div className="fwarn">
                  <Icon name="alert" size={13} /> {scanWarning}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 14px",
          }}
        >
          <div className="fgroup">
            <label>Loại văn bản{req}</label>
            <select className="finp" value={docType} onChange={(e) => set("docType", e.target.value)}>
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="fgroup">
            <label>Số/Ký hiệu{req} {ocrTag("refNo")}</label>
            <input
              className={errors.refNo ? "finp err" : "finp"}
              value={form.refNo}
              onChange={(e) => set("refNo", e.target.value)}
              placeholder="VD: 214/UBND-VP"
            />
            {errors.refNo && <div className="ferr">{errors.refNo}</div>}
          </div>
          <div className="fgroup">
            <label>Ngày đến{req} {ocrTag("date")}</label>
            <input
              className={errors.date ? "finp err" : "finp"}
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
            {errors.date && <div className="ferr">{errors.date}</div>}
          </div>
          <div className="fgroup">
            <label>Hạn xử lý {ocrTag("deadline")}</label>
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
          <label>Cơ quan ban hành{req} {ocrTag("sender")}</label>
          <input
            className={errors.sender ? "finp err" : "finp"}
            value={form.sender}
            onChange={(e) => set("sender", e.target.value)}
            placeholder="VD: UBND huyện Phú Xuyên"
          />
          {errors.sender && <div className="ferr">{errors.sender}</div>}
        </div>

        <div className="fgroup">
          <label>Trích yếu nội dung{req} {ocrTag("summary")}</label>
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
            <label>Độ mật {ocrTag("confidentiality")}</label>
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
            <label>Độ khẩn {ocrTag("urgency")}</label>
            <select className="finp" value={form.urgency} onChange={(e) => set("urgency", e.target.value)}>
              {urgencyLevels.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
