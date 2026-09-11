"use client";

import { useState } from "react";
import type { BudgetItem } from "@/types";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { Chip } from "@/components/ui/Chip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CommentList } from "@/components/ui/CommentList";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/lib/icons";
import type { CreateEntryInput, CreateObstacleInput } from "@/services/disbursement.service";
import { itemColor, itemPercent, percentLabel } from "./percent";
import { formatVnd } from "@/lib/money";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { findRequestStatus } from "./requestStatus";
import { DisburseRequestForm, DISBURSE_REQUEST_FORM_ID, type DisburseRequestValues } from "./DisburseRequestForm";
import { AddEntryForm } from "./AddEntryForm";
import { AddObstacleForm } from "./AddObstacleForm";

const TAB_ITEMS = [
  { key: "requests", label: "Đề nghị giải ngân" },
  { key: "history", label: "Lịch sử giải ngân" },
  { key: "plan", label: "Dự toán & tiến độ" },
  { key: "obstacles", label: "Vướng mắc" },
  { key: "discussion", label: "Thảo luận" },
];

/**
 * Bước chuyển trạng thái hiện thành nút, theo trạng thái hiện tại.
 *
 * Bảng này PHẢI khớp `STATUS_TRANSITIONS` ở backend. Máy chủ vẫn là nơi chặn
 * thật — ở đây chỉ ẩn nút cho gọn, vì hiện một nút bấm vào là nhận lỗi thì tệ
 * hơn không hiện.
 */
const NEXT_STATUSES: Record<string, { to: string; label: string; level: "edit" | "approve" | "admin"; danger?: boolean }[]> = {
  nhap: [
    { to: "cho-duyet", label: "Trình duyệt", level: "edit" },
    { to: "huy", label: "Huỷ hạng mục", level: "admin", danger: true },
  ],
  "cho-duyet": [
    { to: "da-duyet", label: "Phê duyệt", level: "approve" },
    { to: "tu-choi", label: "Từ chối", level: "approve", danger: true },
  ],
  "tu-choi": [{ to: "nhap", label: "Sửa lại (về Nháp)", level: "edit" }],
  "da-duyet": [
    { to: "tam-dung", label: "Tạm dừng", level: "approve", danger: true },
    { to: "quyet-toan", label: "Quyết toán", level: "approve" },
  ],
  "tam-dung": [{ to: "da-duyet", label: "Tiếp tục thực hiện", level: "approve" }],
  huy: [],
  "quyet-toan": [],
};

/** Chuyển sang các trạng thái này thì bắt buộc nêu lý do — khớp backend */
const NEEDS_REASON = ["tu-choi", "tam-dung", "huy"];

const REJECT_REASON_ERROR = "Vui lòng nhập lý do từ chối đề nghị";
const VOUCHER_ERROR = "Vui lòng nhập số chứng từ của lần chi";
const DELETE_NOTE =
  "Xoá mềm: hạng mục biến mất khỏi danh sách và khỏi mọi số liệu tổng hợp, nhưng các lần " +
  'giải ngân và chứng từ đã ghi vẫn được giữ nguyên trong hệ thống. Khôi phục ở bộ lọc "Đã xoá".';

interface BudgetDrawerProps {
  item: BudgetItem | null;
  open: boolean;
  onClose: () => void;
  /** Gửi bình luận mới vào hạng mục đang mở */
  onAddComment: (content: string) => void;
  /** Gửi đề nghị giải ngân đợt tiếp theo */
  onSubmitRequest: (values: DisburseRequestValues) => void;
  /** Nhắc người phụ trách tháo gỡ vướng mắc */
  onRemindObstacles: () => void;
  /** Ghi nhận một lần giải ngân của hạng mục */
  onAddEntry: (values: CreateEntryInput) => void;
  /** Thêm vướng mắc cần tháo gỡ */
  onAddObstacle: (values: CreateObstacleInput) => void;
  /** Đánh dấu vướng mắc thứ `index` đã tháo gỡ */
  onResolveObstacle: (index: number) => void;
  /** Vai trò có quyền `approve` — thấy nút Duyệt / Từ chối đề nghị */
  canApprove?: boolean;
  /** Vai trò có quyền `edit` — gửi đề nghị và ghi nhận đã chi */
  canEdit?: boolean;
  /** Vai trò có quyền `admin` — xoá mềm và khôi phục hạng mục */
  canDelete?: boolean;
  onApproveRequest: (budgetCode: string, requestCode: string) => void;
  onRejectRequest: (budgetCode: string, requestCode: string, reason: string) => void;
  onDisburseRequest: (budgetCode: string, requestCode: string, voucherNo: string) => void;
  /** Xoá mềm hạng mục kèm lý do (tuỳ chọn) */
  onSoftDelete: (item: BudgetItem, reason: string) => void;
  /** Đổi trạng thái hồ sơ theo workflow */
  onChangeStatus?: (status: string, note: string) => void;
  /** Ghi một lần điều chỉnh dự toán */
  onAddAdjustment?: (values: {
    decisionNo: string;
    decidedAt: string;
    deltaDong: number;
    reason: string;
  }) => void;
  /** Khôi phục hạng mục đã xoá mềm */
  onRestore: (item: BudgetItem) => void;
  /** true khi đang gửi yêu cầu lên máy chủ — khoá các nút thao tác */
  saving?: boolean;
}

/**
 * Số tiền ở ngăn chi tiết hiện ĐẦY ĐỦ tới đồng.
 *
 * Đây là màn hình cán bộ đối chiếu với chứng từ, nên không được rút gọn —
 * `formatVndShort` chỉ dùng ở thẻ tổng quan. Xem `lib/money.ts`.
 */

/** Drawer chi tiết hạng mục giải ngân */
export function BudgetDrawer({
  item,
  open,
  onClose,
  onAddComment,
  onSubmitRequest,
  onRemindObstacles,
  onAddEntry,
  onAddObstacle,
  onResolveObstacle,
  canApprove = false,
  canEdit = false,
  canDelete = false,
  onApproveRequest,
  onRejectRequest,
  onDisburseRequest,
  onSoftDelete,
  onRestore,
  onChangeStatus,
  onAddAdjustment,
  saving = false,
}: BudgetDrawerProps) {
  /** Bước chuyển trạng thái đang chờ nhập lý do */
  const [statusTarget, setStatusTarget] = useState<{ to: string; label: string } | null>(null);
  const [statusNote, setStatusNote] = useState("");
  /** Biểu mẫu điều chỉnh dự toán */
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjDecision, setAdjDecision] = useState("");
  const [adjDate, setAdjDate] = useState("");
  const [adjDelta, setAdjDelta] = useState<number | null>(null);
  const [adjReason, setAdjReason] = useState("");
  const [tab, setTab] = useState("requests");
  const [formOpen, setFormOpen] = useState(false);
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [obstacleFormOpen, setObstacleFormOpen] = useState(false);
  const [draft, setDraft] = useState("");
  /** Mã đề nghị đang mở ô nhập lý do từ chối / số chứng từ, và nội dung đang gõ */
  const [acting, setActing] = useState<{ code: string; kind: "reject" | "disburse" } | null>(null);
  const [actingText, setActingText] = useState("");
  const [actingError, setActingError] = useState("");
  /** Hộp xác nhận xoá mềm */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Đổi hạng mục / đóng-mở drawer: quay về tab đầu, đóng form, xoá nháp (điều chỉnh state trong render)
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = `${item?.id ?? ""}:${open}`;
  if (currentKey !== loadedKey) {
    setLoadedKey(currentKey);
    setTab("requests");
    setFormOpen(false);
    setEntryFormOpen(false);
    setObstacleFormOpen(false);
    setDraft("");
    setActing(null);
    setActingText("");
    setActingError("");
    setDeleteOpen(false);
    setDeleteReason("");
  }

  if (!item) return null;

  const pct = itemPercent(item);
  const color = itemColor(item);

  function sendComment() {
    const content = draft.trim();
    if (!content) return;
    onAddComment(content);
    setDraft("");
  }

  /**
   * Hạng mục đã xoá mềm: chỉ xem và khôi phục, không cho ghi thêm gì.
   * Đọc cờ `isDeleted`; ngoặc `?? Boolean(deletedAt)` đỡ bản ghi cũ chưa backfill.
   */
  const isDeleted = item.isDeleted ?? Boolean(item.deletedAt);

  const footer = formOpen ? (
    <>
      <button className="btn pri" type="submit" form={DISBURSE_REQUEST_FORM_ID} disabled={saving}>
        <Icon name="send" size={15} />
        Gửi đề nghị
      </button>
      <button className="btn" type="button" onClick={() => setFormOpen(false)} disabled={saving}>
        Huỷ
      </button>
    </>
  ) : deleteOpen ? (
    <>
      <button
        className="btn pri danger"
        type="button"
        onClick={() => {
          onSoftDelete(item, deleteReason.trim());
          setDeleteOpen(false);
        }}
        disabled={saving}
      >
        <Icon name="trash" size={15} />
        Xác nhận xoá
      </button>
      <button className="btn" type="button" onClick={() => setDeleteOpen(false)} disabled={saving}>
        Huỷ
      </button>
    </>
  ) : isDeleted ? (
    <>
      {canDelete && (
        <button className="btn pri" type="button" onClick={() => onRestore(item)} disabled={saving}>
          <Icon name="ok" size={15} />
          Khôi phục hạng mục
        </button>
      )}
      <button className="btn" type="button" onClick={onClose}>
        Đóng
      </button>
    </>
  ) : (
    <>
      {canEdit && (
        <button className="btn pri" type="button" onClick={() => setFormOpen(true)} disabled={saving}>
          <Icon name="send" size={15} />
          Đề nghị giải ngân
        </button>
      )}
      <button className="btn" type="button" onClick={onRemindObstacles} disabled={saving || item.obstacles.length === 0}>
        <Icon name="alert" size={15} />
        Nhắc tháo gỡ vướng mắc
      </button>
      {canDelete && (
        <button className="btn danger" type="button" onClick={() => setDeleteOpen(true)} disabled={saving}>
          <Icon name="trash" size={15} />
          Xoá hạng mục
        </button>
      )}
      <button className="btn" type="button" onClick={onClose}>
        Đóng
      </button>
    </>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item.name}
      meta={`${item.id} · ${item.fundingSource} · Phụ trách: ${item.owner}`}
      footer={footer}
    >
      {formOpen ? (
        <DisburseRequestForm
          item={item}
          onSubmit={(values) => {
            onSubmitRequest(values);
            setFormOpen(false);
          }}
        />
      ) : deleteOpen ? (
        <div>
          <div className="note" style={{ marginBottom: 14 }}>{DELETE_NOTE}</div>
          <div className="fgroup">
            <label>Lý do xoá</label>
            <textarea
              className="finp"
              placeholder="Ví dụ: Hạng mục nhập trùng, đã có ở HM-04"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
            <div className="fhint">
              Không bắt buộc. Lý do được lưu lại để truy vết, hiển thị ở bộ lọc &quot;Đã xoá&quot;.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <Chip color={item.fundingColor}>{item.fundingSource}</Chip>
            {/* Trạng thái hồ sơ và tình trạng tiến độ là HAI chiều khác nhau,
                hiện riêng chứ không gộp một nhãn */}
            {item.approvalLabel && <Chip color="var(--navy)">{item.approvalLabel}</Chip>}
            {item.scheduleState === "cham" ? (
              <Chip color="var(--red)" tint="rgba(231,76,60,.10)">
                {item.scheduleLabel ?? "Chậm tiến độ"}
              </Chip>
            ) : (
              <Chip color="var(--green)" tint="rgba(39,174,96,.10)">
                Đúng tiến độ
              </Chip>
            )}
            {isDeleted && (
              <Chip color="var(--mut)" tint="rgba(136,150,166,.12)">
                Đã xoá
              </Chip>
            )}
          </div>

          {isDeleted && (
            <div className="note" style={{ marginBottom: 14 }}>
              Hạng mục đã bị xoá{item.deletedBy ? ` bởi ${item.deletedBy}` : ""}. Không ghi thêm được
              lần chi hay đề nghị mới.
              {item.deleteReason && (
                <>
                  <br />
                  Lý do: {item.deleteReason}
                </>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="fld">
              <div className="k">Kế hoạch vốn hiện hành</div>
              <div className="v" style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)" }}>
                {formatVnd(item.plannedDong)}
              </div>
              {item.adjustments && item.adjustments.length > 0 && (
                <div className="tiny muted">
                  Dự toán đầu năm {formatVnd(item.initialPlannedDong)} · đã điều chỉnh{" "}
                  {item.adjustments.length} lần
                </div>
              )}
            </div>
            <div className="fld">
              <div className="k">Đã giải ngân</div>
              <div className="v" style={{ fontSize: 16, fontWeight: 800, color }}>
                {formatVnd(item.actualDong)}
              </div>
              <div className="tiny muted">
                Còn lại {formatVnd(item.remainingDong ?? item.plannedDong - item.actualDong)}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <ProgressBar percent={pct ?? 0} color={color} thick />
          </div>
          <div className="tiny muted" style={{ marginBottom: 10 }}>
            Đạt {percentLabel(item)} kế hoạch vốn giao · Cán bộ phụ trách: {item.owner}
            {item.scheduleLabel ? ` · ${item.scheduleLabel}` : ""}
          </div>

          <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />

          {tab === "requests" && (
            <div>
              <h4 style={{ fontSize: 12.5, marginBottom: 12 }}>
                Tiến trình đề nghị giải ngân ({item.requests.length})
              </h4>
              {item.requests.length === 0 ? (
                <div className="empty">Hạng mục chưa có đề nghị giải ngân nào</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {item.requests.map((r) => {
                    const meta = findRequestStatus(r.status);
                    const openHere = acting?.code === r.code;
                    return (
                      <div
                        key={r.code}
                        style={{
                          border: "1px solid var(--bd)",
                          borderLeft: `3px solid ${meta.color}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <b style={{ fontSize: 12.5 }}>{r.code}</b>
                          <Chip color={meta.color} tint={meta.tint} dot>
                            {meta.label}
                          </Chip>
                          <span style={{ marginLeft: "auto", fontWeight: 700 }}>
                            {formatVnd(r.amountDong)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, marginBottom: 4 }}>{r.content}</div>
                        {r.vendor && <div className="tiny muted">Đơn vị thụ hưởng: {r.vendor}</div>}

                        {/* Bốn mốc của vòng đời — mốc nào đã qua thì hiện thời điểm và người thực hiện */}
                        <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
                          <div>
                            Gửi: {r.requestedBy} · {r.requestedAt}
                          </div>
                          {r.decidedAt && (
                            <div style={{ color: r.status === "rejected" ? "var(--red)" : undefined }}>
                              {r.status === "rejected" ? "Từ chối" : "Duyệt"}: {r.decidedBy} · {r.decidedAt}
                            </div>
                          )}
                          {r.rejectReason && (
                            <div style={{ color: "var(--red)" }}>Lý do: {r.rejectReason}</div>
                          )}
                          {r.disbursedAt && (
                            <div style={{ color: "var(--green)" }}>
                              Đã chi ngày {r.disbursedAt} · chứng từ {r.voucherNo}
                            </div>
                          )}
                        </div>

                        {/* Ô nhập tại chỗ cho từ chối / ghi nhận chi */}
                        {openHere ? (
                          <div style={{ marginTop: 8 }}>
                            <input
                              className={`finp ${actingError ? "err" : ""}`}
                              placeholder={
                                acting?.kind === "reject"
                                  ? "Lý do từ chối đề nghị"
                                  : "Số chứng từ, ví dụ UNC 118/2026"
                              }
                              value={actingText}
                              onChange={(e) => {
                                setActingText(e.target.value);
                                if (actingError) setActingError("");
                              }}
                            />
                            {actingError && <div className="ferr">{actingError}</div>}
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <button
                                className={acting?.kind === "reject" ? "btn sm pri danger" : "btn sm pri"}
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  const text = actingText.trim();
                                  if (!text) {
                                    setActingError(
                                      acting?.kind === "reject" ? REJECT_REASON_ERROR : VOUCHER_ERROR,
                                    );
                                    return;
                                  }
                                  if (acting?.kind === "reject") {
                                    onRejectRequest(item.id, r.code, text);
                                  } else {
                                    onDisburseRequest(item.id, r.code, text);
                                  }
                                  setActing(null);
                                  setActingText("");
                                }}
                              >
                                Xác nhận
                              </button>
                              <button
                                className="btn sm"
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setActing(null);
                                  setActingText("");
                                  setActingError("");
                                }}
                              >
                                Huỷ
                              </button>
                            </div>
                          </div>
                        ) : (
                          !isDeleted && (
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                              {r.status === "pending" && canApprove && (
                                <>
                                  <button
                                    className="btn sm pri"
                                    type="button"
                                    disabled={saving}
                                    onClick={() => onApproveRequest(item.id, r.code)}
                                  >
                                    <Icon name="check" size={13} />
                                    Duyệt
                                  </button>
                                  <button
                                    className="btn sm danger"
                                    type="button"
                                    disabled={saving}
                                    onClick={() => {
                                      setActing({ code: r.code, kind: "reject" });
                                      setActingText("");
                                      setActingError("");
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                              {r.status === "approved" && canEdit && (
                                <button
                                  className="btn sm pri"
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    setActing({ code: r.code, kind: "disburse" });
                                    setActingText("");
                                    setActingError("");
                                  }}
                                  title="Xác nhận tiền đã chuyển, cộng vào luỹ kế"
                                >
                                  <Icon name="wallet" size={13} />
                                  Ghi nhận đã chi
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h4 style={{ fontSize: 12.5 }}>Các lần giải ngân ({item.entries.length} lần)</h4>
                {!entryFormOpen && (
                  <button
                    className="btn sm"
                    type="button"
                    style={{ marginLeft: "auto" }}
                    disabled={saving}
                    onClick={() => setEntryFormOpen(true)}
                  >
                    <Icon name="plus" size={14} />
                    Ghi nhận giải ngân
                  </button>
                )}
              </div>
              <div className="tw" style={{ border: "1px solid var(--bd)", borderRadius: 10 }}>
                <table className="tb2">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Nội dung chi</th>
                      <th>Số tiền</th>
                      <th>Đơn vị thụ hưởng</th>
                      <th>Người thực hiện</th>
                      <th>Chứng từ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.entries.map((e, i) => (
                      <tr key={`${e.voucherNo}-${i}`} style={{ cursor: "default" }}>
                        <td style={{ whiteSpace: "nowrap" }}>{e.date}</td>
                        <td className="tt">{e.content}</td>
                        {/* Hoàn trả hiện dấu trừ và màu đỏ — nhìn là biết dòng
                            này TRỪ khỏi luỹ kế, không phải một khoản chi nữa */}
                        <td
                          style={{
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                            color: e.type === "hoan-tra" ? "var(--red)" : "var(--navy)",
                          }}
                        >
                          {e.type === "hoan-tra" ? "−" : ""}
                          {formatVnd(e.amountDong)}
                        </td>
                        <td>{e.vendor}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{e.by}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{e.voucherNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {entryFormOpen && (
                <AddEntryForm
                  saving={saving}
                  onSubmit={(values) => {
                    onAddEntry(values);
                    setEntryFormOpen(false);
                  }}
                  onCancel={() => setEntryFormOpen(false)}
                />
              )}
            </div>
          )}

          {tab === "plan" && (
            <div>
              {/* ── Workflow trạng thái hồ sơ ── */}
              <h4 style={{ fontSize: 12.5, marginBottom: 8 }}>Trạng thái hồ sơ</h4>
              <div className="note" style={{ marginBottom: 12 }}>
                Hạng mục đang ở trạng thái <b>{item.approvalLabel ?? item.approvalStatus}</b>.
                {item.statusNote ? ` ${item.statusNote}` : ""}
                {item.approvalStatus !== "da-duyet" && (
                  <> Chỉ hạng mục <b>Đã phê duyệt</b> mới ghi nhận được giao dịch giải ngân.</>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {(NEXT_STATUSES[item.approvalStatus] ?? [])
                  .filter((step) =>
                    step.level === "admin"
                      ? canDelete
                      : step.level === "approve"
                        ? canApprove
                        : canEdit,
                  )
                  .map((step) => (
                    <button
                      key={step.to}
                      type="button"
                      className={step.danger ? "btn danger" : "btn pri"}
                      disabled={saving}
                      onClick={() => {
                        if (NEEDS_REASON.includes(step.to)) {
                          setStatusNote("");
                          setStatusTarget(step);
                          return;
                        }
                        onChangeStatus?.(step.to, "");
                      }}
                    >
                      {step.label}
                    </button>
                  ))}
                {(NEXT_STATUSES[item.approvalStatus] ?? []).length === 0 && (
                  <span className="tiny muted">
                    Hồ sơ đã chốt — không còn bước chuyển nào và mọi đường ghi đã khoá.
                  </span>
                )}
              </div>

              {statusTarget && (
                <div className="fgroup" style={{ marginBottom: 18 }}>
                  <label htmlFor="bd-status-note">
                    Lý do {statusTarget.label.toLowerCase()} <span className="req">*</span>
                  </label>
                  <textarea
                    id="bd-status-note"
                    className="finp"
                    style={{ minHeight: 60 }}
                    value={statusNote}
                    placeholder="Nêu rõ lý do để người sau truy được vì sao"
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn pri"
                      disabled={!statusNote.trim() || saving}
                      onClick={() => {
                        onChangeStatus?.(statusTarget.to, statusNote.trim());
                        setStatusTarget(null);
                      }}
                    >
                      Xác nhận
                    </button>
                    <button type="button" className="btn" onClick={() => setStatusTarget(null)}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}

              {/* ── Kế hoạch theo quý ── */}
              {item.quarterPlans && item.quarterPlans.length > 0 && (
                <>
                  <h4 style={{ fontSize: 12.5, marginBottom: 8 }}>Kế hoạch giải ngân theo quý</h4>
                  <div className="tw" style={{ marginBottom: 18 }}>
                    <table className="tb2">
                      <thead>
                        <tr>
                          <th>Quý</th>
                          <th>Kế hoạch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.quarterPlans.map((q) => (
                          <tr key={q.quarter} style={{ cursor: "default" }}>
                            <td>Quý {q.quarter}</td>
                            <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                              {formatVnd(q.amountDong)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── Điều chỉnh dự toán ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <h4 style={{ fontSize: 12.5 }}>Điều chỉnh dự toán</h4>
                {canApprove &&
                  item.approvalStatus !== "quyet-toan" &&
                  item.approvalStatus !== "huy" && (
                    <button className="btn sm" type="button" onClick={() => setAdjOpen((v) => !v)}>
                      <Icon name="plus" size={14} />
                      Thêm điều chỉnh
                    </button>
                  )}
              </div>
              <div className="note" style={{ marginBottom: 10 }}>
                Kế hoạch vốn hiện hành {formatVnd(item.plannedDong)} = dự toán giao đầu năm{" "}
                {formatVnd(item.initialPlannedDong)} cộng các lần điều chỉnh dưới đây. Đây là đường
                DUY NHẤT đổi kế hoạch vốn — mỗi lần đều phải có số quyết định làm căn cứ.
              </div>

              {adjOpen && (
                <div
                  style={{
                    border: "1px solid var(--bd)",
                    borderRadius: 10,
                    padding: "13px 15px",
                    marginBottom: 14,
                  }}
                >
                  <div className="grid2">
                    <div className="fgroup">
                      <label htmlFor="adj-no">
                        Số quyết định <span className="req">*</span>
                      </label>
                      <input
                        id="adj-no"
                        className="finp"
                        value={adjDecision}
                        placeholder="VD: 45/QĐ-UBND"
                        onChange={(e) => setAdjDecision(e.target.value)}
                      />
                    </div>
                    <div className="fgroup">
                      <label htmlFor="adj-date">
                        Ngày quyết định <span className="req">*</span>
                      </label>
                      <input
                        id="adj-date"
                        className="finp"
                        value={adjDate}
                        placeholder="dd/MM/yyyy"
                        onChange={(e) => setAdjDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="fgroup">
                    <label htmlFor="adj-delta">
                      Mức điều chỉnh <span className="req">*</span>
                    </label>
                    <MoneyInput
                      id="adj-delta"
                      value={adjDelta}
                      onChange={setAdjDelta}
                      allowNegative
                    />
                  </div>
                  <div className="fgroup">
                    <label htmlFor="adj-reason">
                      Lý do điều chỉnh <span className="req">*</span>
                    </label>
                    <textarea
                      id="adj-reason"
                      className="finp"
                      style={{ minHeight: 56 }}
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn pri"
                      disabled={
                        saving ||
                        !adjDecision.trim() ||
                        !adjDate.trim() ||
                        !adjDelta ||
                        !adjReason.trim()
                      }
                      onClick={() => {
                        onAddAdjustment?.({
                          decisionNo: adjDecision.trim(),
                          decidedAt: adjDate.trim(),
                          deltaDong: adjDelta ?? 0,
                          reason: adjReason.trim(),
                        });
                        setAdjOpen(false);
                        setAdjDecision("");
                        setAdjDate("");
                        setAdjDelta(null);
                        setAdjReason("");
                      }}
                    >
                      Lưu điều chỉnh
                    </button>
                    <button type="button" className="btn" onClick={() => setAdjOpen(false)}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}

              {item.adjustments && item.adjustments.length > 0 ? (
                <div className="tw" style={{ marginBottom: 18 }}>
                  <table className="tb2">
                    <thead>
                      <tr>
                        <th>Số quyết định</th>
                        <th>Ngày</th>
                        <th>Mức điều chỉnh</th>
                        <th>Lý do</th>
                        <th>Người ghi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.adjustments.map((adj, i) => (
                        <tr key={`${adj.decisionNo}-${i}`} style={{ cursor: "default" }}>
                          <td style={{ whiteSpace: "nowrap" }}>{adj.decisionNo}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{adj.decidedAt}</td>
                          <td
                            style={{
                              whiteSpace: "nowrap",
                              fontWeight: 700,
                              color: adj.deltaDong < 0 ? "var(--red)" : "var(--green)",
                            }}
                          >
                            {adj.deltaDong < 0 ? "−" : "+"}
                            {formatVnd(Math.abs(adj.deltaDong))}
                          </td>
                          <td>{adj.reason}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{adj.by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="tiny muted" style={{ marginBottom: 18 }}>
                  Chưa có lần điều chỉnh nào — kế hoạch vốn đúng bằng dự toán giao đầu năm.
                </div>
              )}

              {/* ── Lịch sử tiến độ ── */}
              <h4 style={{ fontSize: 12.5, marginBottom: 8 }}>Lịch sử tiến độ</h4>
              {item.progressLogs && item.progressLogs.length > 0 ? (
                <div className="tw">
                  <table className="tb2">
                    <thead>
                      <tr>
                        <th>Thời điểm</th>
                        <th>Hành động</th>
                        <th>Kế hoạch</th>
                        <th>Đã giải ngân</th>
                        <th>Ghi chú</th>
                        <th>Người ghi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Mới nhất lên đầu — cán bộ quan tâm việc vừa xảy ra */}
                      {[...item.progressLogs].reverse().map((log, i) => (
                        <tr key={`${log.at}-${i}`} style={{ cursor: "default" }}>
                          <td style={{ whiteSpace: "nowrap" }} className="tiny">
                            {new Date(log.at).toLocaleString("vi-VN")}
                          </td>
                          <td className="tt">{log.action}</td>
                          <td style={{ whiteSpace: "nowrap" }} className="tiny">
                            {formatVnd(log.plannedDong)}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }} className="tiny">
                            {formatVnd(log.actualDong)}
                          </td>
                          <td className="tiny">
                            {log.note}
                            {log.lateReason ? ` · Lý do chậm: ${log.lateReason}` : ""}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }} className="tiny">
                            {log.by}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="tiny muted">Chưa có mốc nào trong lịch sử tiến độ.</div>
              )}
            </div>
          )}

          {tab === "obstacles" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h4 style={{ fontSize: 12.5 }}>Vướng mắc đang theo dõi ({item.obstacles.length})</h4>
                {!obstacleFormOpen && (
                  <button
                    className="btn sm"
                    type="button"
                    style={{ marginLeft: "auto" }}
                    disabled={saving}
                    onClick={() => setObstacleFormOpen(true)}
                  >
                    <Icon name="plus" size={14} />
                    Thêm vướng mắc
                  </button>
                )}
              </div>
              {item.obstacles.length === 0 && <div className="empty">Không có vướng mắc nào</div>}
              {item.obstacles.map((o, i) => (
                <div
                  key={i}
                  className="note"
                  style={{
                    display: "flex",
                    gap: 11,
                    alignItems: "flex-start",
                    borderLeft: "3px solid var(--orange)",
                    marginBottom: 9,
                  }}
                >
                  <span style={{ color: "var(--orange)", marginTop: 1 }}>
                    <Icon name="alert" size={16} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 600, color: "var(--navy)" }}>{o.content}</div>
                    <div className="tiny muted" style={{ marginTop: 5, display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                      <Avatar name={o.owner} /> Phụ trách tháo gỡ: {o.owner} · Hạn: {o.deadline}
                      <Chip color="var(--orange)" tint="rgba(230,126,34,.12)">
                        Đang theo dõi
                      </Chip>
                      <button
                        className="btn sm"
                        type="button"
                        style={{ marginLeft: "auto" }}
                        disabled={saving}
                        onClick={() => onResolveObstacle(i)}
                      >
                        <Icon name="check" size={13} />
                        Đã tháo gỡ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {obstacleFormOpen && (
                <AddObstacleForm
                  saving={saving}
                  onSubmit={(values) => {
                    onAddObstacle(values);
                    setObstacleFormOpen(false);
                  }}
                  onCancel={() => setObstacleFormOpen(false)}
                />
              )}
            </div>
          )}

          {tab === "discussion" && (
            <div>
              <h4 style={{ fontSize: 12.5, marginBottom: 12 }}>Trao đổi của các bộ phận</h4>
              <CommentList comments={item.comments} />
              <div
                className={saving ? "saving" : undefined}
                style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 4 }}
              >
                <textarea
                  className="finp"
                  style={{ minHeight: 60 }}
                  placeholder="Nhập nội dung trao đổi…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button className="btn pri" type="button" onClick={sendComment} disabled={!draft.trim() || saving}>
                  <Icon name="send" size={15} />
                  Gửi
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
