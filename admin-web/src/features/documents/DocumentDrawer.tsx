"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { Tabs } from "@/components/ui/Tabs";
import { Timeline } from "@/components/ui/Timeline";
import { FileList } from "@/components/ui/FileList";
import { deadlineLabel } from "@/lib/format";
import { ApiError } from "@/services/api";
import { fetchDepartments } from "@/services/catalogs.service";
import { getSignedUrl } from "@/services/files.service";
import { useCatalog } from "@/hooks/useCatalog";
import { documentAttachmentNames, type DocumentDetail, type OcrField } from "@/services/documents.service";

const DRAWER_TABS = [
  { key: "info", label: "Thông tin & OCR" },
  { key: "flow", label: "Luân chuyển" },
  { key: "files", label: "Tệp đính kèm" },
];

/** Khoá trường OCR backend trả về, chia theo hai khối hiển thị của mockup */
const SHORT_OCR_KEYS = ["refNo", "issuedDate", "urgency", "confidentiality"];
const LONG_OCR_KEYS = ["sender", "summary", "deadline"];

/** Ô thông tin thường (không có nhãn OCR) */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fld">
      <div className="k">{label}</div>
      <div className="v">{children}</div>
    </div>
  );
}

/** Ô thông tin do OCR bóc tách — có badge OCR + nút xác nhận */
function OcrFieldRow({
  field,
  disabled,
  onConfirm,
}: {
  field: OcrField;
  disabled: boolean;
  onConfirm: (field: OcrField) => void;
}) {
  return (
    <div className="fld">
      <div className="k">
        {field.label} <span className="ocr">OCR</span>
        <button
          type="button"
          className="icbtn"
          disabled={disabled || field.confirmed}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            marginLeft: "auto",
            color: field.confirmed ? "var(--green)" : "var(--mut)",
            borderColor: field.confirmed ? "rgba(39,174,96,.45)" : "var(--bd)",
            background: field.confirmed ? "rgba(39,174,96,.08)" : "#fff",
          }}
          title={field.confirmed ? "Trường này đã được xác nhận" : "Xác nhận trường này đúng với bản gốc"}
          onClick={() => onConfirm(field)}
        >
          <Icon name="ok" size={13} />
        </button>
      </div>
      <div className="v">{field.value}</div>
    </div>
  );
}

export function DocumentDrawer({
  doc,
  loading,
  error,
  onRetry,
  open,
  onClose,
  onCreateTask,
  onMoveDepartment,
  onRunOcr,
  onConfirmField,
  onConfirmAll,
  onAttachScan,
}: {
  doc: DocumentDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  open: boolean;
  onClose: () => void;
  /** Bấm "Chuyển thành công việc" — gọi POST /workflow/document-to-task */
  onCreateTask: (doc: DocumentDetail) => Promise<void>;
  onMoveDepartment: (department: string) => Promise<void>;
  onRunOcr: () => Promise<void>;
  onConfirmField: (key: string) => Promise<void>;
  onConfirmAll: () => Promise<void>;
  /** Đính kèm bản scan vừa tải lên — gọi PATCH /documents/:arrivalNo */
  onAttachScan: (scanFileId: string) => Promise<void>;
}) {
  // Danh mục bộ phận lấy từ API (GET /catalogs/departments)
  const departments = useCatalog(fetchDepartments);

  const [tab, setTab] = useState("info");
  /** Rỗng = chưa chọn; mặc định là bộ phận của văn bản, sau đó là mục đầu danh mục */
  const [deptChoice, setDeptChoice] = useState("");
  const targetDept = deptChoice || doc?.department || departments[0] || "";
  const [saving, setSaving] = useState(false);
  /** Đang xin link ký sẵn để mở bản scan */
  const [openingScan, setOpeningScan] = useState(false);
  const [scanError, setScanError] = useState("");

  // Nạp lại tab + bộ phận đích khi mở văn bản khác (điều chỉnh state trong render)
  const [loadedDocNo, setLoadedDocNo] = useState<string | null>(null);
  if (doc && doc.arrivalNo !== loadedDocNo) {
    setLoadedDocNo(doc.arrivalNo);
    setTab("info");
    setDeptChoice("");
    setScanError("");
  }

  /**
   * Mở bản scan trong tab mới. Tệp lưu riêng tư nên phải xin link ký sẵn —
   * thẻ <a> không gửi được header Authorization.
   */
  const openScan = async (scanFileId: string) => {
    setOpeningScan(true);
    setScanError("");
    try {
      const signed = await getSignedUrl(scanFileId);
      window.open(signed.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : "Không mở được bản scan");
    } finally {
      setOpeningScan(false);
    }
  };

  /** Bọc mọi thao tác ghi: khoá nút, chờ máy chủ trả lời rồi mở lại */
  const run = (action: () => Promise<void>) => {
    setSaving(true);
    void action().finally(() => setSaving(false));
  };

  const ocrFields = doc?.ocrFields ?? [];
  const confirmedCount = ocrFields.filter((f) => f.confirmed).length;
  const allConfirmed = ocrFields.length > 0 && confirmedCount === ocrFields.length;
  const due = deadlineLabel(doc?.daysLeft ?? 0);

  const find = (key: string) => ocrFields.find((f) => f.key === key);
  /** Biến cục bộ để TypeScript giữ được kiểu đã thu hẹp bên trong các callback JSX */
  const scanFileId = doc?.scanFileId;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={doc?.summary ?? "Chi tiết văn bản"}
      meta={doc ? `Số đến ${doc.arrivalNo} · ${doc.refNo} · ${doc.sender}` : "Đang tải dữ liệu từ máy chủ…"}
      footer={
        <>
          <button
            type="button"
            className="btn pri"
            disabled={!doc || saving}
            onClick={() => doc && run(() => onCreateTask(doc))}
          >
            <Icon name="right" size={15} />
            Chuyển thành công việc
          </button>
          <select
            className="sel"
            value={targetDept}
            disabled={!doc || saving}
            onChange={(e) => setDeptChoice(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={!doc || saving || targetDept === doc?.department}
            onClick={() => run(() => onMoveDepartment(targetDept))}
          >
            <Icon name="send" size={15} />
            Chuyển bộ phận
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      <DataState loading={loading} error={error} onRetry={onRetry} empty={!doc} emptyMessage="Chưa chọn văn bản">
        {doc && (
          <div className={saving ? "saving" : undefined}>
            <Tabs items={DRAWER_TABS} active={tab} onChange={setTab} />

            {tab === "info" && (
              <>
                {scanFileId ? (
                  <div className="scan-real">
                    <span className="ph">
                      <Icon name="file" size={20} />
                    </span>
                    <span className="tx">
                      <b>Bản scan văn bản</b>
                      <span>{doc.pageCount} trang · tệp riêng tư, mở bằng link truy cập có chữ ký</span>
                    </span>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={openingScan}
                      onClick={() => void openScan(scanFileId)}
                    >
                      <Icon name="eye" size={14} />
                      {openingScan ? "Đang mở…" : "Mở bản scan"}
                    </button>
                    <button type="button" className="btn sm pri" disabled={saving} onClick={() => run(onRunOcr)}>
                      <Icon name="layer" size={14} />
                      {ocrFields.length ? "Chạy lại OCR" : "Chạy OCR"}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 18 }}>
                    <FileUpload
                      key={doc.arrivalNo}
                      purpose="scan"
                      isPrivate
                      height={150}
                      placeholder="Kéo-thả bản scan vào đây hoặc bấm để chọn"
                      onUploaded={(fileId) => run(() => onAttachScan(fileId))}
                      disabled={saving}
                    />
                    <div className="fhint">
                      Văn bản chưa có bản scan nên chưa chạy được OCR. Tải tệp lên để đính kèm ngay tại đây.
                    </div>
                  </div>
                )}
                {scanError && <div className="ferr" style={{ marginBottom: 12 }}>{scanError}</div>}

                {ocrFields.length > 0 ? (
                  <div className="note" style={{ marginBottom: 18 }}>
                    <Icon name="ok" size={15} /> Hệ thống đã tự động bóc tách <b>{ocrFields.length} trường thông tin</b>{" "}
                    từ bản scan bằng công nghệ nhận dạng ký tự. Các trường có nhãn <span className="ocr">OCR</span> cần
                    cán bộ kiểm tra lại trước khi lưu.
                  </div>
                ) : (
                  scanFileId && (
                    <div className="note" style={{ marginBottom: 18 }}>
                      <Icon name="alert" size={15} /> Văn bản chưa có kết quả bóc tách. Bấm <b>Chạy OCR</b> để hệ thống
                      nhận dạng các trường thông tin từ bản scan đính kèm.
                    </div>
                  )
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <span className="tiny muted">
                    Đã xác nhận {confirmedCount}/{ocrFields.length} trường
                  </span>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={saving || allConfirmed || ocrFields.length === 0}
                    onClick={() => run(onConfirmAll)}
                  >
                    <Icon name="ok" size={14} />
                    Xác nhận tất cả
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0 14px",
                  }}
                >
                  <Field label="Số đến">
                    <b style={{ color: "var(--navy)" }}>{doc.arrivalNo}</b>
                  </Field>
                  <Field label="Loại văn bản">{doc.docType}</Field>
                  {SHORT_OCR_KEYS.map((key) => {
                    const field = find(key);
                    return field ? (
                      <OcrFieldRow
                        key={key}
                        field={field}
                        disabled={saving}
                        onConfirm={(f) => run(() => onConfirmField(f.key))}
                      />
                    ) : null;
                  })}
                </div>
                {LONG_OCR_KEYS.map((key) => {
                  const field = find(key);
                  return field ? (
                    <OcrFieldRow
                      key={key}
                      field={field}
                      disabled={saving}
                      onConfirm={(f) => run(() => onConfirmField(f.key))}
                    />
                  ) : null;
                })}
                <Field label="Người ký">{doc.signer || <span className="muted">Chưa ghi nhận</span>}</Field>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0 14px",
                  }}
                >
                  <Field label="Tình trạng hạn xử lý">
                    {doc.deadline ? (
                      <>
                        {doc.deadline} · <b style={{ color: due.color }}>{due.text}</b>
                      </>
                    ) : (
                      <span className="muted">Chưa đặt hạn</span>
                    )}
                  </Field>
                  <Field label="Bộ phận đang giữ">{doc.department}</Field>
                </div>
                {doc.linkedTaskCode && (
                  <Field label="Nhiệm vụ theo dõi">
                    <b style={{ color: "var(--navy)" }}>{doc.linkedTaskCode}</b>
                  </Field>
                )}
              </>
            )}

            {tab === "flow" && (
              <div>
                <h4 style={{ fontSize: 12.5, marginBottom: 12 }}>Dòng thời gian chuyển tiếp xử lý</h4>
                {doc.timeline.length ? (
                  <Timeline items={doc.timeline} />
                ) : (
                  <div className="tiny muted">Chưa có mốc luân chuyển nào</div>
                )}
              </div>
            )}

            {tab === "files" && (
              <div>
                <h4 style={{ fontSize: 12.5, marginBottom: 12 }}>Tệp đính kèm</h4>
                <FileList names={documentAttachmentNames} />
                <div className="fhint" style={{ marginTop: 10 }}>
                  Danh sách tệp tạm — kho tệp văn thư thật tích hợp cùng API tệp đính kèm (WBS #26).
                </div>
              </div>
            )}
          </div>
        )}
      </DataState>
    </Drawer>
  );
}
