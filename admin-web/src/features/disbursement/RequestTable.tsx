"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { FilterChips } from "@/components/ui/FilterChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { Icon } from "@/lib/icons";
import { formatVnd, formatVndShort } from "@/lib/money";
import type { DisbursementRequestStatus } from "@/types";
import type { DisbursementRequestRow, RequestSummary } from "@/services/disbursement.service";
import { findRequestStatus, requestStatuses } from "./requestStatus";

const REJECT_REASON_ERROR = "Vui lòng nhập lý do từ chối đề nghị";
const VOUCHER_ERROR = "Vui lòng nhập số chứng từ của lần chi";

/** Chip lọc: "Tất cả" đứng đầu, rồi 4 trạng thái theo đúng thứ tự vòng đời */
const FILTER_CHIPS = requestStatuses.map((s) => ({ key: s.key, label: s.label }));

export interface RequestTableProps {
  rows: DisbursementRequestRow[];
  summary: RequestSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  status: DisbursementRequestStatus | "all";
  onStatusChange: (status: DisbursementRequestStatus | "all") => void;
  /** Vai trò có quyền `approve` mới thấy nút Duyệt / Từ chối */
  canApprove: boolean;
  /** Vai trò có quyền `edit` mới thấy nút Ghi nhận đã chi */
  canDisburse: boolean;
  onApprove: (row: DisbursementRequestRow) => void;
  onReject: (row: DisbursementRequestRow, reason: string) => void;
  onDisburse: (row: DisbursementRequestRow, voucherNo: string) => void;
  /** Mở ngăn chi tiết hạng mục chứa đề nghị này */
  onOpenBudget: (budgetCode: string) => void;
  saving: boolean;
}

/**
 * Màn hình quản lý đề nghị giải ngân toàn xã.
 *
 * Gộp đề nghị của mọi hạng mục về một chỗ để lãnh đạo duyệt theo lô, thay vì
 * phải mở từng hạng mục mới thấy có gì đang chờ.
 */
export function RequestTable({
  rows,
  summary,
  loading,
  error,
  onRetry,
  status,
  onStatusChange,
  canApprove,
  canDisburse,
  onApprove,
  onReject,
  onDisburse,
  onOpenBudget,
  saving,
}: RequestTableProps) {
  /** Đề nghị đang mở hộp thoại từ chối / ghi nhận chi */
  const [rejecting, setRejecting] = useState<DisbursementRequestRow | null>(null);
  const [disbursing, setDisbursing] = useState<DisbursementRequestRow | null>(null);
  const [reason, setReason] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [formError, setFormError] = useState("");

  function openReject(row: DisbursementRequestRow) {
    setRejecting(row);
    setReason("");
    setFormError("");
  }

  function openDisburse(row: DisbursementRequestRow) {
    setDisbursing(row);
    setVoucherNo("");
    setFormError("");
  }

  function submitReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setFormError(REJECT_REASON_ERROR);
      return;
    }
    if (rejecting) onReject(rejecting, trimmed);
    setRejecting(null);
  }

  function submitDisburse() {
    const trimmed = voucherNo.trim();
    if (!trimmed) {
      setFormError(VOUCHER_ERROR);
      return;
    }
    if (disbursing) onDisburse(disbursing, trimmed);
    setDisbursing(null);
  }

  return (
    <>
      {summary && (
        <div className="kpis" style={{ marginBottom: 16 }}>
          <KpiCard
            label="Chờ duyệt"
            value={String(summary.pending)}
            sub={
              summary.pendingAmountDong > 0
                ? `${formatVndShort(summary.pendingAmountDong)} đang chờ quyết`
                : "Không có đề nghị chờ"
            }
            color="var(--orange)"
            tint="rgba(230,126,34,.08)"
            icon="clock"
          />
          <KpiCard
            label="Đã duyệt, chờ chi"
            value={String(summary.approved)}
            sub="Chờ kho bạc chuyển tiền"
            color="var(--blue)"
            tint="rgba(59,130,196,.08)"
            icon="check"
          />
          <KpiCard
            label="Đã giải ngân"
            value={String(summary.disbursed)}
            sub="Đã cộng vào luỹ kế"
            color="var(--green)"
            tint="rgba(39,174,96,.08)"
            icon="wallet"
          />
          <KpiCard
            label="Từ chối"
            value={String(summary.rejected)}
            sub="Cần sửa hồ sơ, trình lại"
            color="var(--red)"
            tint="rgba(231,76,60,.08)"
            icon="alert"
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <FilterChips
          chips={FILTER_CHIPS}
          active={status}
          onChange={(key) => onStatusChange(key as DisbursementRequestStatus | "all")}
          allLabel="Tất cả trạng thái"
        />
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty={rows.length === 0}
        emptyMessage="Không có đề nghị giải ngân nào khớp bộ lọc hiện tại"
      >
        <Card>
          <CardHeader title="Đề nghị giải ngân" extra={`${rows.length} đề nghị`} />
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th style={{ minWidth: 200 }}>Hạng mục</th>
                  <th style={{ minWidth: 200 }}>Nội dung chi</th>
                  <th>Số tiền</th>
                  <th>Người gửi</th>
                  <th>Thời điểm gửi</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const meta = findRequestStatus(row.status);
                  return (
                    <tr key={`${row.budgetCode}-${row.code}`}>
                      <td style={{ fontWeight: 600, color: "var(--navy)" }}>{row.code}</td>
                      <td>
                        <button
                          type="button"
                          className="lnk"
                          onClick={() => onOpenBudget(row.budgetCode)}
                          title="Mở hạng mục ngân sách"
                        >
                          {row.budgetName}
                        </button>
                        <div className="sub">
                          {row.budgetCode} · {row.owner}
                        </div>
                      </td>
                      <td>
                        {row.content}
                        {row.vendor && <div className="sub">Thụ hưởng: {row.vendor}</div>}
                        {row.status === "rejected" && row.rejectReason && (
                          <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 3 }}>
                            Lý do từ chối: {row.rejectReason}
                          </div>
                        )}
                        {row.status === "disbursed" && row.voucherNo && (
                          <div className="sub">
                            Chứng từ {row.voucherNo} · chi ngày {row.disbursedAt}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{formatVnd(row.amountDong)}</td>
                      <td>{row.requestedBy}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{row.requestedAt}</td>
                      <td>
                        <Chip color={meta.color} tint={meta.tint} dot>
                          {meta.label}
                        </Chip>
                        {row.decidedBy && (
                          <div className="sub">
                            {row.status === "rejected" ? "Từ chối bởi " : "Duyệt bởi "}
                            {row.decidedBy}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {row.status === "pending" && canApprove && (
                            <>
                              <button
                                className="btn sm pri"
                                type="button"
                                disabled={saving}
                                onClick={() => onApprove(row)}
                              >
                                <Icon name="check" size={13} />
                                Duyệt
                              </button>
                              <button
                                className="btn sm danger"
                                type="button"
                                disabled={saving}
                                onClick={() => openReject(row)}
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {row.status === "approved" && canDisburse && (
                            <button
                              className="btn sm pri"
                              type="button"
                              disabled={saving}
                              onClick={() => openDisburse(row)}
                              title="Ghi nhận tiền đã chuyển thật, cộng vào luỹ kế"
                            >
                              <Icon name="wallet" size={13} />
                              Ghi nhận đã chi
                            </button>
                          )}
                          {row.status === "pending" && !canApprove && (
                            <span className="sub">Chờ lãnh đạo duyệt</span>
                          )}
                          {(row.status === "disbursed" || row.status === "rejected") && (
                            <span className="sub">Đã kết thúc</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>

      {/* Từ chối — bắt buộc nêu lý do để người gửi biết phải sửa gì */}
      <Drawer
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Từ chối đề nghị giải ngân"
        meta={rejecting ? `${rejecting.code} · ${rejecting.budgetName} · ${formatVnd(rejecting.amountDong)}` : ""}
        footer={
          <>
            <button className="btn pri danger" type="button" onClick={submitReject} disabled={saving}>
              Xác nhận từ chối
            </button>
            <button className="btn" type="button" onClick={() => setRejecting(null)} disabled={saving}>
              Huỷ
            </button>
          </>
        }
      >
        <div className="fgroup">
          <label>
            Lý do từ chối <span className="req">*</span>
          </label>
          <textarea
            className={`finp ${formError ? "err" : ""}`}
            placeholder="Ví dụ: Hồ sơ điều chỉnh thiết kế chưa được thẩm định, bổ sung rồi trình lại"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (formError) setFormError("");
            }}
          />
          {formError && <div className="ferr">{formError}</div>}
          <div className="fhint">
            Lý do hiển thị cho người gửi ở màn hình đề nghị và ghi vào phần thảo luận của hạng mục.
          </div>
        </div>
      </Drawer>

      {/* Ghi nhận đã chi — bước cộng tiền vào luỹ kế nên bắt buộc có chứng từ */}
      <Drawer
        open={disbursing !== null}
        onClose={() => setDisbursing(null)}
        title="Ghi nhận đã giải ngân"
        meta={disbursing ? `${disbursing.code} · ${disbursing.budgetName} · ${formatVnd(disbursing.amountDong)}` : ""}
        footer={
          <>
            <button className="btn pri" type="button" onClick={submitDisburse} disabled={saving}>
              Xác nhận đã chi
            </button>
            <button className="btn" type="button" onClick={() => setDisbursing(null)} disabled={saving}>
              Huỷ
            </button>
          </>
        }
      >
        <div className="note" style={{ marginBottom: 14 }}>
          Xác nhận tiền đã thực sự chuyển cho đơn vị thụ hưởng. Thao tác này cộng{" "}
          <b>{formatVnd(disbursing?.amountDong ?? 0)}</b> vào luỹ kế giải ngân của hạng mục và thêm một dòng vào Lịch sử
          giải ngân — không hoàn tác được.
        </div>
        <div className="fgroup">
          <label>
            Số chứng từ <span className="req">*</span>
          </label>
          <input
            className={`finp ${formError ? "err" : ""}`}
            placeholder="Ví dụ: UNC 118/2026"
            value={voucherNo}
            onChange={(e) => {
              setVoucherNo(e.target.value);
              if (formError) setFormError("");
            }}
          />
          {formError && <div className="ferr">{formError}</div>}
          <div className="fhint">Số chứng từ dùng để đối chiếu với sổ kế toán khi quyết toán.</div>
        </div>
      </Drawer>
    </>
  );
}
