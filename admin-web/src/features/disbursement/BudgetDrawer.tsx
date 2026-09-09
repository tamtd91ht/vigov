"use client";

import { useState } from "react";
import type { BudgetItem } from "@/types";
import { appConfig } from "@/config/app.config";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { Chip } from "@/components/ui/Chip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CommentList } from "@/components/ui/CommentList";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/lib/icons";
import type { CreateEntryInput, CreateObstacleInput } from "@/services/disbursement.service";
import { itemColor, itemPercent } from "./percent";
import { findRequestStatus } from "./requestStatus";
import { DisburseRequestForm, DISBURSE_REQUEST_FORM_ID, type DisburseRequestValues } from "./DisburseRequestForm";
import { AddEntryForm } from "./AddEntryForm";
import { AddObstacleForm } from "./AddObstacleForm";

const TAB_ITEMS = [
  { key: "requests", label: "Đề nghị giải ngân" },
  { key: "history", label: "Lịch sử giải ngân" },
  { key: "obstacles", label: "Vướng mắc" },
  { key: "discussion", label: "Thảo luận" },
];

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
  /** Khôi phục hạng mục đã xoá mềm */
  onRestore: (item: BudgetItem) => void;
  /** true khi đang gửi yêu cầu lên máy chủ — khoá các nút thao tác */
  saving?: boolean;
}

/** Số tiền kèm đơn vị cấu hình: 3.7 -> "3,7 tỷ đồng" */
function moneyWithUnit(n: number): string {
  return `${n.toLocaleString(appConfig.locale, { maximumFractionDigits: 1 })} ${appConfig.currencyUnit}`;
}

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
  saving = false,
}: BudgetDrawerProps) {
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
            {item.delayed ? (
              <Chip color="var(--red)" tint="rgba(231,76,60,.10)">
                Chậm so với tiến độ
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
              <div className="k">Kế hoạch vốn</div>
              <div className="v" style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)" }}>{moneyWithUnit(item.planned)}</div>
            </div>
            <div className="fld">
              <div className="k">Đã giải ngân</div>
              <div className="v" style={{ fontSize: 16, fontWeight: 800, color }}>{moneyWithUnit(item.actual)}</div>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <ProgressBar percent={pct} color={color} thick />
          </div>
          <div className="tiny muted" style={{ marginBottom: 10 }}>
            Đạt {pct}% kế hoạch vốn giao · Cán bộ phụ trách: {item.owner}
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
                          <span style={{ marginLeft: "auto", fontWeight: 700 }}>{r.amount}</span>
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
                        <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: "var(--navy)" }}>{e.amount}</td>
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
