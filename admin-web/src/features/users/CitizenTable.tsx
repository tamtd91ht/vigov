"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/lib/icons";
import { formatNumber, nameInitials } from "@/lib/format";
import { fetchCitizenAreas } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import type { CitizenAccount } from "@/services/users.service";

/** ===== Cấu hình nhãn / màu cục bộ ===== */
const STATUS_CHIP: Record<CitizenAccount["status"], { label: string; color: string; tint: string }> = {
  active: { label: "Hoạt động", color: "var(--green)", tint: "rgba(39,174,96,.10)" },
  locked: { label: "Đã khoá", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
};

const CHANNEL_LABEL: Record<string, string> = {
  zalo: "Zalo Mini App",
  app: "App công dân",
};

const SEARCH_PLACEHOLDER = "Tìm theo tên Zalo hoặc số điện thoại…";
const LOCK_REASON_ERROR = "Vui lòng nhập lý do khoá tài khoản";

/** Chip trạng thái của tài khoản đã xoá mềm — không nằm trong STATUS_CHIP vì `status` vẫn là active/locked */
const DELETED_CHIP = { label: "Đã xoá", color: "var(--mut)", tint: "rgba(136,150,166,.12)" };

/** Hai chế độ xem danh sách: đang dùng (mặc định) và thùng tài khoản đã xoá */
const VIEW_CHIPS = [
  { key: "active", label: "Đang dùng" },
  { key: "deleted", label: "Đã xoá" },
];

const DELETE_NOTE =
  "Xoá mềm: tài khoản biến mất khỏi danh sách và không đăng nhập được vào Mini App nữa, " +
  "nhưng dữ liệu vẫn được giữ trong hệ thống (hồ sơ và phản ánh đã gửi không bị ảnh hưởng). " +
  'Có thể khôi phục lại ở bộ lọc "Đã xoá".';

/**
 * Lịch sử phản ánh rút gọn của công dân cần endpoint riêng
 * (dạng GET /users/citizens/:phone/feedback) — backend chưa cung cấp.
 */
const FEEDBACK_HISTORY_NOTE =
  "Lịch sử phản ánh chi tiết của công dân cần endpoint riêng ở phân hệ Người dùng — backend chưa có.";

/** Avatar chữ cái đầu của công dân — nền xanh đồng nhất (không thuộc danh bạ cán bộ) */
function CitizenAvatar({ name }: { name: string }) {
  return (
    <span className="av" style={{ background: "var(--blue)" }} title={name}>
      {nameInitials(name)}
    </span>
  );
}

export interface CitizenTableProps {
  citizens: CitizenAccount[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  areaKey: string;
  onAreaChange: (key: string) => void;
  /** Số điện thoại của dòng đang có thao tác khoá/mở dở dang */
  busyId: string | null;
  onLock: (user: CitizenAccount, reason: string) => void;
  onUnlock: (user: CitizenAccount) => void;
  /** Đang xem thùng tài khoản đã xoá thay vì danh sách đang dùng */
  deletedView: boolean;
  onDeletedViewChange: (deleted: boolean) => void;
  /** Chỉ vai trò có quyền `users:admin` mới thấy nút Xoá / Khôi phục */
  canDelete: boolean;
  onDelete: (user: CitizenAccount, reason: string) => void;
  onRestore: (user: CitizenAccount) => void;
}

/** Tab "Công dân" — danh sách tài khoản Mini App, khoá/mở và xem chi tiết */
export function CitizenTable({
  citizens,
  loading,
  error,
  onRetry,
  total,
  page,
  limit,
  onPageChange,
  search,
  onSearchChange,
  areaKey,
  onAreaChange,
  busyId,
  onLock,
  onUnlock,
  deletedView,
  onDeletedViewChange,
  canDelete,
  onDelete,
  onRestore,
}: CitizenTableProps) {
  // Danh mục thôn / tổ dân phố lấy từ API (GET /catalogs/areas)
  const citizenAreas = useCatalog(fetchCitizenAreas);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [lockTargetId, setLockTargetId] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [lockError, setLockError] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const detail = citizens.find((c) => c.id === detailId) ?? null;
  const lockTarget = citizens.find((c) => c.id === lockTargetId) ?? null;
  const deleteTarget = citizens.find((c) => c.id === deleteTargetId) ?? null;

  const openLockForm = (user: CitizenAccount) => {
    setDetailId(null);
    setLockReason("");
    setLockError("");
    setLockTargetId(user.id);
  };

  const submitLock = () => {
    if (!lockTarget) return;
    const reason = lockReason.trim();
    if (!reason) {
      setLockError(LOCK_REASON_ERROR);
      return;
    }
    onLock(lockTarget, reason);
    setLockTargetId(null);
  };

  const handleUnlock = (user: CitizenAccount) => {
    setDetailId(null);
    onUnlock(user);
  };

  const openDeleteForm = (user: CitizenAccount) => {
    setDetailId(null);
    setDeleteReason("");
    setDeleteTargetId(user.id);
  };

  const submitDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget, deleteReason.trim());
    setDeleteTargetId(null);
  };

  const handleRestore = (user: CitizenAccount) => {
    setDetailId(null);
    onRestore(user);
  };

  /** Bản ghi đã xoá mềm hiển thị chip riêng, không phải chip active/locked */
  const chipOf = (user: CitizenAccount) => (user.isDeleted ? DELETED_CHIP : STATUS_CHIP[user.status]);

  return (
    <>
      <Card>
        <CardHeader
          title={deletedView ? "Tài khoản đã xoá" : "Danh sách công dân"}
          extra={<span>{formatNumber(total)} tài khoản</span>}
        />
        <CardBody style={{ paddingBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div className="tb-search" style={{ margin: 0, flex: "0 1 320px" }}>
              <Icon name="search" size={15} />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={SEARCH_PLACEHOLDER}
                aria-label="Tìm công dân"
              />
            </div>
            <FilterChips
              chips={citizenAreas.map((a) => ({ key: a, label: a }))}
              active={areaKey}
              onChange={onAreaChange}
            />
            {/* Chỉ quản trị viên mới xoá được nên cũng chỉ họ cần xem thùng đã xoá */}
            {canDelete && (
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                {VIEW_CHIPS.map((v) => {
                  const on = (v.key === "deleted") === deletedView;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      className={`fchip ${on ? "on" : ""}`}
                      onClick={() => onDeletedViewChange(v.key === "deleted")}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardBody>
        <DataState
          loading={loading}
          error={error}
          onRetry={onRetry}
          empty={citizens.length === 0}
          emptyMessage={
            deletedView ? "Chưa có tài khoản nào bị xoá" : "Không có công dân nào khớp bộ lọc hiện tại"
          }
        >
          <div className="tw">
            <table className="tb2">
              <thead>
                <tr>
                  <th>Tên Zalo</th>
                  <th>Số điện thoại</th>
                  <th>Thôn / Tổ dân phố</th>
                  <th>Phản ánh đã gửi</th>
                  <th>Ngày đăng ký</th>
                  <th>Kênh định danh</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {citizens.map((c) => {
                  const st = chipOf(c);
                  // So theo id: SĐT đã che có thể trùng nhau giữa hai công dân
                  const busy = busyId === c.id;
                  return (
                    <tr key={c.id} className={busy ? "saving" : undefined} onClick={() => setDetailId(c.id)}>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                          <CitizenAvatar name={c.displayName} />
                          <span className="tt">{c.displayName}</span>
                        </span>
                      </td>
                      <td>{c.phone}</td>
                      <td>{c.area || <span className="muted">—</span>}</td>
                      <td>{formatNumber(c.feedbackCount)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.createdAt ? formatDateTime(c.createdAt) : <span className="muted">—</span>}
                      </td>
                      <td>{CHANNEL_LABEL[c.channel] ?? c.channel}</td>
                      <td>
                        <Chip color={st.color} tint={st.tint} dot>
                          {st.label}
                        </Chip>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                          {c.isDeleted ? (
                            <button
                              type="button"
                              className="btn sm"
                              disabled={busy || !canDelete}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(c);
                              }}
                            >
                              <Icon name="ok" size={13} />
                              Khôi phục
                            </button>
                          ) : (
                            <>
                              {c.status === "active" ? (
                                <button
                                  type="button"
                                  className="btn sm danger"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLockForm(c);
                                  }}
                                >
                                  <Icon name="lock" size={13} />
                                  Khoá
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn sm"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnlock(c);
                                  }}
                                >
                                  <Icon name="unlock" size={13} />
                                  Mở khoá
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="btn sm danger"
                                  disabled={busy}
                                  title="Xoá mềm — dữ liệu vẫn được giữ lại"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteForm(c);
                                  }}
                                >
                                  <Icon name="trash" size={13} />
                                  Xoá
                                </button>
                              )}
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
        {totalPages > 1 && (
          <CardBody style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="sm muted">
              Trang {page}/{totalPages}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn sm" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Trang trước
              </button>
              <button
                className="btn sm"
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Trang sau
              </button>
            </span>
          </CardBody>
        )}
      </Card>

      {/* Drawer chi tiết công dân */}
      <Drawer
        open={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail?.displayName ?? ""}
        meta={detail ? `Mã tài khoản ${detail.id}` : undefined}
        footer={
          detail && (
            <>
              {detail.isDeleted ? (
                canDelete && (
                  <button type="button" className="btn" onClick={() => handleRestore(detail)}>
                    <Icon name="ok" size={15} />
                    Khôi phục tài khoản
                  </button>
                )
              ) : (
                <>
                  {detail.status === "active" ? (
                    <button type="button" className="btn danger" onClick={() => openLockForm(detail)}>
                      <Icon name="lock" size={15} />
                      Khoá tài khoản
                    </button>
                  ) : (
                    <button type="button" className="btn" onClick={() => handleUnlock(detail)}>
                      <Icon name="unlock" size={15} />
                      Mở khoá tài khoản
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className="btn danger" onClick={() => openDeleteForm(detail)}>
                      <Icon name="trash" size={15} />
                      Xoá tài khoản
                    </button>
                  )}
                </>
              )}
              <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={() => setDetailId(null)}>
                Đóng
              </button>
            </>
          )
        }
      >
        {detail && (
          <>
            <div className="fld">
              <div className="k">Trạng thái</div>
              <div className="v">
                <Chip color={chipOf(detail).color} tint={chipOf(detail).tint} dot>
                  {chipOf(detail).label}
                </Chip>
              </div>
            </div>
            {detail.deletedAt && (
              <>
                <div className="fld">
                  <div className="k">
                    <Icon name="trash" size={13} />
                    Đã xoá lúc
                  </div>
                  <div className="v">
                    {formatDateTime(detail.deletedAt)}
                    {detail.deletedBy && <span className="muted tiny"> · bởi {detail.deletedBy}</span>}
                  </div>
                </div>
                {detail.deleteReason && (
                  <div className="fld">
                    <div className="k">Lý do xoá</div>
                    <div className="v">{detail.deleteReason}</div>
                  </div>
                )}
              </>
            )}
            {detail.status === "locked" && detail.lockReason && (
              <div className="fld">
                <div className="k">
                  <Icon name="alert" size={13} />
                  Lý do khoá
                </div>
                <div className="v" style={{ color: "var(--red)" }}>{detail.lockReason}</div>
              </div>
            )}
            <div className="fld">
              <div className="k">
                <Icon name="phone" size={13} />
                Số điện thoại
              </div>
              <div className="v">
                {detail.phone} <span className="muted tiny">(đã che theo quy định bảo vệ dữ liệu cá nhân)</span>
              </div>
            </div>
            <div className="fld">
              <div className="k">
                <Icon name="pin" size={13} />
                Thôn / Tổ dân phố
              </div>
              <div className="v">{detail.area || "—"}</div>
            </div>
            <div className="fld">
              <div className="k">
                <Icon name="msg" size={13} />
                Phản ánh đã gửi
              </div>
              <div className="v">{formatNumber(detail.feedbackCount)} lượt</div>
            </div>
            <div className="fld">
              <div className="k">
                <Icon name="cal" size={13} />
                Ngày đăng ký
              </div>
              <div className="v">
                {detail.createdAt ? formatDateTime(detail.createdAt) : <span className="muted">Không rõ</span>}
              </div>
            </div>
            <div className="fld">
              <div className="k">
                <Icon name="clock" size={13} />
                Hoạt động gần nhất
              </div>
              <div className="v">
                {detail.lastActiveAt ? (
                  formatDateTime(detail.lastActiveAt)
                ) : (
                  /* Backend suy mốc này từ bảng phiên đăng nhập — chưa đăng nhập lần nào thì không có */
                  <span className="muted">Chưa ghi nhận phiên đăng nhập nào</span>
                )}
              </div>
            </div>

            <div className="gsec">
              <h4>Lịch sử phản ánh gần đây</h4>
              <div className="note">{FEEDBACK_HISTORY_NOTE}</div>
            </div>
          </>
        )}
      </Drawer>

      {/* Drawer xác nhận xoá mềm tài khoản */}
      <Drawer
        open={deleteTarget !== null}
        onClose={() => setDeleteTargetId(null)}
        title="Xoá tài khoản công dân"
        meta={deleteTarget ? `${deleteTarget.displayName} · ${deleteTarget.phone} · ${deleteTarget.area}` : undefined}
        footer={
          <>
            <button type="button" className="btn danger" onClick={submitDelete}>
              <Icon name="trash" size={15} />
              Xác nhận xoá
            </button>
            <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={() => setDeleteTargetId(null)}>
              Huỷ
            </button>
          </>
        }
      >
        <div className="note" style={{ marginBottom: 16 }}>
          {DELETE_NOTE}
        </div>
        <div className="fgroup">
          <label htmlFor="delete-reason">Lý do xoá</label>
          <textarea
            id="delete-reason"
            className="finp"
            value={deleteReason}
            placeholder="Ví dụ: Tài khoản kiểm thử, trùng lặp…"
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <div className="fhint">Không bắt buộc. Lý do được lưu lại để truy vết, không hiển thị cho công dân.</div>
        </div>
      </Drawer>

      {/* Drawer form khoá tài khoản */}
      <Drawer
        open={lockTarget !== null}
        onClose={() => setLockTargetId(null)}
        title="Khoá tài khoản công dân"
        meta={lockTarget ? `${lockTarget.displayName} · ${lockTarget.phone} · ${lockTarget.area}` : undefined}
        footer={
          <>
            <button type="button" className="btn danger" onClick={submitLock}>
              <Icon name="lock" size={15} />
              Xác nhận khoá
            </button>
            <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={() => setLockTargetId(null)}>
              Huỷ
            </button>
          </>
        }
      >
        <div className="note" style={{ marginBottom: 16 }}>
          Tài khoản bị khoá sẽ không thể đăng nhập Mini App và được tự động đưa vào danh sách blacklist.
        </div>
        <div className="fgroup">
          <label htmlFor="lock-reason">
            Lý do khoá <span className="req">*</span>
          </label>
          <textarea
            id="lock-reason"
            className={lockError ? "finp err" : "finp"}
            value={lockReason}
            placeholder="Ví dụ: Gửi phản ánh sai sự thật nhiều lần…"
            onChange={(e) => {
              setLockReason(e.target.value);
              if (lockError && e.target.value.trim()) setLockError("");
            }}
          />
          {lockError ? (
            <div className="ferr">{lockError}</div>
          ) : (
            <div className="fhint">Lý do sẽ hiển thị cho công dân khi họ mở Mini App.</div>
          )}
        </div>
      </Drawer>
    </>
  );
}

/** "2026-09-06T03:06:52.077Z" → "06/09/2026 10:06" */
function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
