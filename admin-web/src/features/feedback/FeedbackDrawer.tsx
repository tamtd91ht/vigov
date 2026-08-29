"use client";

import { useState } from "react";
import type { CitizenFeedback } from "@/types";
import { defaultSlaRules, findCategory } from "@/config/sla.config";
import { feedbackStatuses, findStatus } from "@/config/status.config";
import { fetchDepartments, fetchStaffDirectory } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { UNASSIGNED } from "@/config/status.config";
import { latLngToPin } from "@/config/map.config";
import { slaLabel } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Drawer } from "@/components/ui/Drawer";
import { FileUpload } from "@/components/ui/FileUpload";
import { SignedImage } from "@/components/ui/SignedImage";
import { StarRating } from "@/components/ui/StarRating";
import { Tabs } from "@/components/ui/Tabs";
import { Timeline } from "@/components/ui/Timeline";
import { useToast } from "@/components/ui/Toast";
import { categoryCover } from "./FeedbackGrid";
import { MiniMap } from "./MiniMap";

type PanelMode = "assign" | "transfer" | "resolve" | null;

const TAB_ITEMS = [
  { key: "progress", label: "Tiến trình xử lý" },
  { key: "rating", label: "Đánh giá" },
];

/** Nhãn nút xác nhận theo từng panel thao tác */
const PANEL_ACTION_LABEL: Record<Exclude<PanelMode, null>, string> = {
  assign: "Xác nhận phân công",
  transfer: "Xác nhận chuyển",
  resolve: "Xác nhận đã xử lý",
};

/**
 * Một ô ảnh trong khối "trước / sau xử lý".
 * Ảnh nằm trong kho tệp dùng chung nên đọc qua link ký sẵn; chưa có ảnh thì
 * giữ nguyên ô nền màu của giao diện đã duyệt.
 */
function ImagePanel({
  fileIds,
  alt,
  emptyLabel,
  emptyBackground,
}: {
  fileIds: string[];
  alt: string;
  emptyLabel: string;
  /** Nền của ô khi chưa có ảnh; bỏ trống thì dùng nền xám nhạt */
  emptyBackground?: string;
}) {
  if (fileIds.length === 0) {
    return (
      <div
        className={emptyBackground ? "p" : "p ph"}
        style={emptyBackground ? { background: emptyBackground } : undefined}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className={fileIds.length > 1 ? "p multi" : "p"}>
      {fileIds.map((id) => (
        <SignedImage key={id} fileId={id} alt={alt} />
      ))}
    </div>
  );
}

export interface FeedbackDrawerProps {
  item: CitizenFeedback | null;
  onClose: () => void;
  /** Phân công cán bộ xử lý */
  onAssign: (code: string, staffName: string) => void;
  /** Chuyển bộ phận xử lý kèm lý do (backend bắt buộc) */
  onTransfer: (code: string, department: string, reason: string) => void;
  /** Xác nhận đã xử lý xong kèm kết quả xử lý (backend bắt buộc) và ảnh nghiệm thu */
  onResolve: (code: string, note: string, resultImageFileIds: string[]) => void;
  /** true khi đang gửi yêu cầu lên máy chủ — khoá các nút thao tác */
  saving?: boolean;
}

/** Drawer chi tiết phiếu phản ánh */
export function FeedbackDrawer({ item, onClose, onAssign, onTransfer, onResolve, saving = false }: FeedbackDrawerProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState("progress");
  const [panel, setPanel] = useState<PanelMode>(null);
  // Danh mục dùng chung lấy từ API (GET /catalogs/staff, /catalogs/departments)
  const staffDirectory = useCatalog(fetchStaffDirectory);
  const departments = useCatalog(fetchDepartments);
  /** Để trống — mặc định là mục đầu danh mục sau khi tải xong */
  const [staffChoice, setStaffChoice] = useState("");
  const [deptChoice, setDeptChoice] = useState("");
  const staffName = staffChoice || staffDirectory[0]?.name || "";
  const deptName = deptChoice || departments[0] || "";

  /** Lý do chuyển bộ phận / kết quả xử lý — dùng chung một ô nhập theo panel */
  const [note, setNote] = useState("");
  /** Ảnh nghiệm thu cán bộ vừa tải lên, gửi kèm khi xác nhận đã xử lý */
  const [resultFileIds, setResultFileIds] = useState<string[]>([]);
  /** Đổi khoá để dựng lại ô tải tệp sau mỗi ảnh, cho phép thêm nhiều ảnh */
  const [uploadKey, setUploadKey] = useState(0);

  /** Xoá nội dung nháp của panel thao tác (ô nhập + ảnh đã tải lên) */
  function resetPanelDraft() {
    setNote("");
    setResultFileIds([]);
    setUploadKey((k) => k + 1);
  }

  // Mở phiếu khác → quay về trạng thái mặc định (điều chỉnh state trong render)
  const [loadedCode, setLoadedCode] = useState<string | null>(null);
  if ((item?.code ?? null) !== loadedCode) {
    setLoadedCode(item?.code ?? null);
    setTab("progress");
    setPanel(null);
    resetPanelDraft();
  }

  const cat = findCategory(item?.categoryLabel ?? "");
  const status = findStatus(feedbackStatuses, item?.status ?? "");
  const resolved = item?.status === "Đã xử lý";
  const sla = slaLabel(item?.slaHoursLeft ?? 0, resolved);
  const unassigned = item?.assignee === UNASSIGNED;
  const slaRule = defaultSlaRules.find((r) => r.categoryKey === cat.key);
  // Ghim suy ra từ toạ độ GPS người dân gửi; chưa có toạ độ thì về vị trí mặc định
  const pin = latLngToPin(item);

  /** Mở / đóng một panel thao tác, luôn xoá nội dung nháp của panel trước */
  function togglePanel(next: Exclude<PanelMode, null>) {
    resetPanelDraft();
    setPanel(panel === next ? null : next);
  }

  // Chuyển bộ phận cần lý do, xác nhận xử lý cần kết quả xử lý — backend từ chối nếu bỏ trống
  const noteRequired = panel === "transfer" || panel === "resolve";
  const canSubmitPanel = !saving && (!noteRequired || note.trim().length > 0);

  const footer = item && (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
      {panel && (
        <div
          className={saving ? "saving" : undefined}
          style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, padding: "12px 14px" }}
        >
          {panel === "assign" && (
            <div className="fgroup" style={{ marginBottom: 10 }}>
              <label htmlFor="fb-assignee">Chọn cán bộ xử lý</label>
              <select id="fb-assignee" className="finp" value={staffName} onChange={(e) => setStaffChoice(e.target.value)}>
                {staffDirectory.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} — {s.title} · {s.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          {panel === "transfer" && (
            <div className="fgroup" style={{ marginBottom: 10 }}>
              <label htmlFor="fb-dept">Chọn bộ phận tiếp nhận</label>
              <select id="fb-dept" className="finp" value={deptName} onChange={(e) => setDeptChoice(e.target.value)}>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {noteRequired && (
            <div className="fgroup" style={{ marginBottom: 10 }}>
              <label htmlFor="fb-note">
                {panel === "transfer" ? "Lý do chuyển bộ phận" : "Kết quả xử lý"} <span className="req">*</span>
              </label>
              <textarea
                id="fb-note"
                className="finp"
                style={{ minHeight: 58 }}
                placeholder={
                  panel === "transfer"
                    ? "Ví dụ: Nội dung thuộc thẩm quyền của bộ phận Địa chính – Xây dựng"
                    : "Ví dụ: Đã thu gom rác, cắm biển cấm đổ rác, bàn giao thôn quản lý"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}

          {panel === "resolve" && (
            /* Ảnh nghiệm thu để CÔNG KHAI: app công dân phải xem được kết quả xử lý,
               mà link ký sẵn của tệp riêng tư chỉ cấp cho cán bộ và người tải lên. */
            <div className="fgroup" style={{ marginBottom: 10 }}>
              <label>Ảnh sau xử lý</label>
              {resultFileIds.length > 0 && (
                <div className="upl-grid" style={{ marginBottom: 8 }}>
                  {resultFileIds.map((id) => (
                    <div className="th" key={id}>
                      <SignedImage fileId={id} alt="Ảnh hiện trường sau xử lý" />
                    </div>
                  ))}
                </div>
              )}
              <FileUpload
                key={uploadKey}
                purpose="feedback"
                height={84}
                placeholder={
                  resultFileIds.length
                    ? "Thêm ảnh nghiệm thu khác"
                    : "Kéo-thả ảnh nghiệm thu vào đây hoặc bấm để chọn"
                }
                onUploaded={(fileId) => {
                  setResultFileIds((prev) => [...prev, fileId]);
                  setUploadKey((k) => k + 1);
                }}
                disabled={saving}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn sm pri"
              type="button"
              disabled={!canSubmitPanel}
              onClick={() => {
                if (panel === "assign") onAssign(item.code, staffName);
                else if (panel === "transfer") onTransfer(item.code, deptName, note.trim());
                else onResolve(item.code, note.trim(), resultFileIds);
                setPanel(null);
                resetPanelDraft();
              }}
            >
              <Icon name="ok" size={14} />
              {PANEL_ACTION_LABEL[panel]}
            </button>
            <button className="btn sm" type="button" disabled={saving} onClick={() => setPanel(null)}>
              Huỷ
            </button>
          </div>
        </div>
      )}
      <div className={saving ? "saving" : undefined} style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        {!resolved && (
          <>
            <button className="btn" type="button" disabled={saving} onClick={() => togglePanel("assign")}>
              <Icon name="users" size={15} />
              Phân công cán bộ
            </button>
            <button className="btn" type="button" disabled={saving} onClick={() => togglePanel("transfer")}>
              <Icon name="send" size={15} />
              Chuyển bộ phận
            </button>
          </>
        )}
        {item.status === "Đang xử lý" && (
          /* Khi xác nhận xử lý: backend tự động gửi kết quả cho công dân — chờ khách chốt (câu hỏi mở #9) */
          <button
            className="btn pri"
            type="button"
            style={{ marginLeft: "auto" }}
            disabled={saving}
            onClick={() => togglePanel("resolve")}
          >
            <Icon name="check" size={15} />
            Xác nhận đã xử lý
          </button>
        )}
        <button className="btn" type="button" onClick={onClose} style={item.status === "Đang xử lý" ? undefined : { marginLeft: "auto" }}>
          Đóng
        </button>
      </div>
    </div>
  );

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      title={item?.title ?? ""}
      meta={item ? `${item.code} · ${item.categoryLabel} · ${item.location}` : undefined}
      footer={footer}
    >
      {item && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <Chip color={cat.color}>{item.categoryLabel}</Chip>
            <Chip color={status.color} tint={status.tint}>
              {status.label}
            </Chip>
            <Chip color={sla.color}>{sla.text}</Chip>
          </div>

          {unassigned && (
            <div
              style={{
                background: "rgba(230,126,34,.08)",
                border: "1px solid rgba(230,126,34,.32)",
                borderRadius: 10,
                padding: "11px 13px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--orange)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Icon name="alert" size={15} />
              Phiếu chưa được phân công cán bộ xử lý — dùng nút &quot;Phân công cán bộ&quot; bên dưới.
            </div>
          )}

          <div className="fld">
            <div className="k">Nội dung phản ánh</div>
            <div className="v">{item.excerpt}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="fld">
              <div className="k">Người gửi</div>
              <div className="v">
                {item.senderName}
                <div className="tiny muted" style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                  <Icon name="phone" size={12} />
                  {item.senderPhone}
                </div>
              </div>
            </div>
            <div className="fld">
              <div className="k">Thời điểm gửi</div>
              <div className="v">{item.sentAt}</div>
            </div>
            <div className="fld">
              <div className="k">Thôn / Tổ dân phố</div>
              <div className="v" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <Icon name="pin" size={13} />
                {item.location}
              </div>
            </div>
            <div className="fld">
              <div className="k">Cán bộ xử lý</div>
              <div className="v">
                {unassigned ? (
                  <span style={{ color: "var(--orange)", fontWeight: 700, display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <Icon name="alert" size={13} />
                    {UNASSIGNED}
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <Avatar name={item.assignee} />
                    {item.assignee}
                  </span>
                )}
              </div>
            </div>
            <div className="fld">
              <div className="k">Bộ phận xử lý</div>
              <div className="v">{item.department}</div>
            </div>
            <div className="fld">
              <div className="k">SLA cam kết ({item.categoryLabel})</div>
              <div className="v">
                {slaRule
                  ? `Tiếp nhận ${slaRule.intakeDays} · xử lý ${slaRule.resolveDays} ${slaRule.unit}`
                  : "Chưa cấu hình SLA"}
                {slaRule && <div className="tiny muted" style={{ marginTop: 2 }}>Cảnh báo: {slaRule.warnBefore.toLowerCase()}</div>}
              </div>
            </div>
          </div>

          <div className="gsec">
            <h4>Hình ảnh trước và sau khi xử lý</h4>
            <div className="ba">
              <div className="b">
                <div className="h" style={{ background: "rgba(231,76,60,.10)", color: "var(--red)" }}>TRƯỚC XỬ LÝ</div>
                <ImagePanel
                  fileIds={item.imageFileIds ?? []}
                  alt="Ảnh hiện trường người dân gửi kèm"
                  emptyLabel="Người dân không gửi kèm ảnh"
                  emptyBackground={categoryCover(cat.color)}
                />
              </div>
              <div className="b">
                <div className="h" style={{ background: "rgba(39,174,96,.10)", color: "var(--green)" }}>SAU XỬ LÝ</div>
                <ImagePanel
                  fileIds={item.resultImageFileIds ?? []}
                  alt="Ảnh hiện trường sau khi xử lý"
                  emptyLabel={resolved ? "Không có ảnh nghiệm thu" : "Chưa có"}
                />
              </div>
            </div>
          </div>

          <div className="gsec">
            <h4>Vị trí phản ánh</h4>
            <MiniMap
              color={cat.color}
              label={item.location}
              x={pin.x}
              y={pin.y}
              onClick={() => showToast(`Đã mở bản đồ chi tiết vị trí ${item.location}`)}
            />
          </div>

          <div className="gsec">
            <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />
            {tab === "progress" ? (
              <Timeline items={item.timeline} />
            ) : item.rating > 0 ? (
              <div style={{ border: "1px solid var(--bd)", borderRadius: 11, padding: "14px 16px", background: "var(--bg2)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <StarRating value={item.rating} />
                  <b style={{ color: "var(--navy)", fontSize: 14 }}>{item.rating}/5</b>
                  <span className="tiny muted">· {item.senderName}</span>
                </div>
                {item.ratingComment && <div className="sm">&ldquo;{item.ratingComment}&rdquo;</div>}
              </div>
            ) : (
              <div className="note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Icon name="clock" size={15} />
                Người dân chưa đánh giá phiếu phản ánh này.
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
