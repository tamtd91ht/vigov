"use client";

import { useState, useSyncExternalStore } from "react";
import { findRole } from "@/config/roles.config";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useApiResource } from "@/hooks/useApiResource";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { ApiError } from "@/services/api";
import { authService, getServerSession } from "@/services/auth";
import { changeOwnPassword, listOwnSessions, MIN_PASSWORD_LENGTH } from "@/services/profile.service";
import { revokeOtherSessions } from "@/services/users.service";

const PAGE_SUB = "Thông tin tài khoản, thiết bị đang đăng nhập và đổi mật khẩu của chính bạn";

const REVOKE_CONFIRM =
  "Đăng xuất mọi thiết bị khác đang dùng tài khoản của bạn? Thiết bị này vẫn giữ nguyên phiên.";

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/** Ô thông tin chỉ đọc — dùng lại lối trình bày của các ngăn chi tiết */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fld">
      <div className="k">{label}</div>
      <div className="v">{children}</div>
    </div>
  );
}

/**
 * Trang Hồ sơ cá nhân (WBS #1).
 *
 * Ba việc cán bộ tự làm được mà không cần quản trị viên: xem mình là ai và có
 * quyền gì, xem những thiết bị nào đang mở tài khoản của mình, và tự đổi mật khẩu.
 */
export function ProfilePage() {
  const { showToast } = useToast();
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const role = findRole(session?.roleKey ?? "");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [changing, setChanging] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const sessions = useApiResource(
    async () => (session ? listOwnSessions(session.username) : []),
    [session?.username],
  );
  const rows = sessions.data ?? [];

  const failed = (err: unknown, fallback: string) =>
    showToast(err instanceof ApiError ? err.message : fallback);

  function validate(): PasswordErrors {
    const problems: PasswordErrors = {};
    if (!current.trim()) problems.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!next) problems.next = "Vui lòng nhập mật khẩu mới";
    else if (next.length < MIN_PASSWORD_LENGTH) {
      problems.next = `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
    } else if (next === current) problems.next = "Mật khẩu mới phải khác mật khẩu hiện tại";
    if (confirm !== next) problems.confirm = "Hai lần nhập mật khẩu mới không giống nhau";
    return problems;
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changing) return;
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setChanging(true);
    try {
      const result = await changeOwnPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      showToast(
        result.revokedSessions > 0
          ? `Đã đổi mật khẩu · đã đăng xuất ${formatNumber(result.revokedSessions)} thiết bị khác`
          : "Đã đổi mật khẩu thành công",
      );
      sessions.reload();
    } catch (err) {
      /* Máy chủ trả 400 riêng cho "mật khẩu hiện tại sai" (401 dành cho phiên hết
         hạn, và apiClient tự đăng xuất khi gặp 401). Báo ngay tại ô nhập để cán
         bộ sửa mà không mất nội dung đã gõ. */
      if (err instanceof ApiError && err.status === 400) {
        setErrors({ current: err.message });
        return;
      }
      failed(err, "Không đổi được mật khẩu");
    } finally {
      setChanging(false);
    }
  };

  const revokeOthers = async () => {
    if (!window.confirm(REVOKE_CONFIRM)) return;
    setRevoking(true);
    try {
      const result = await revokeOtherSessions(rows.find((s) => s.current)?.id);
      showToast(
        result.revoked > 0
          ? `Đã đăng xuất ${formatNumber(result.revoked)} thiết bị khác`
          : "Không còn thiết bị nào khác đang đăng nhập",
      );
      sessions.reload();
    } catch (err) {
      failed(err, "Không đăng xuất được các thiết bị khác");
    } finally {
      setRevoking(false);
    }
  };

  /** Số phiên KHÁC thiết bị này — chỉ những phiên này bị thu hồi */
  const otherCount = rows.filter((s) => !s.current).length;

  return (
    <div className="pg">
      <PageHead title="Hồ sơ cá nhân" sub={PAGE_SUB} />

      <div className="grid2" style={{ marginBottom: 20 }}>
        <Card>
          <CardHeader title="Tài khoản đang đăng nhập" />
          <CardBody>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              {session && <Avatar name={session.displayName} large />}
              <div>
                <b style={{ color: "var(--navy)", fontSize: 15 }}>{session?.displayName ?? "…"}</b>
                <div className="tiny muted">{session?.title ?? ""}</div>
              </div>
            </div>
            <Field label="Tên đăng nhập">{session?.username ?? "—"}</Field>
            <Field label="Vai trò">
              {role ? role.label : <span className="muted">Không xác định</span>}
            </Field>
            <Field label="Đăng nhập lúc">
              {session?.loginAt ? formatStamp(session.loginAt) : <span className="muted">—</span>}
            </Field>
            <div className="fhint">
              Vai trò và quyền trên từng phân hệ do quản trị viên đặt ở trang Cấu hình · Tài khoản &amp;
              phân quyền. Giải thích 5 vai trò và 4 mức quyền xem ở trang Trợ giúp.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Đổi mật khẩu" />
          <CardBody>
            <form onSubmit={submitPassword} noValidate className={changing ? "saving" : undefined}>
              <div className="fgroup">
                <label htmlFor="pf-current">
                  Mật khẩu hiện tại <span className="req">*</span>
                </label>
                <input
                  id="pf-current"
                  type="password"
                  autoComplete="current-password"
                  className={errors.current ? "finp err" : "finp"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
                {errors.current && <div className="ferr">{errors.current}</div>}
              </div>
              <div className="fgroup">
                <label htmlFor="pf-next">
                  Mật khẩu mới <span className="req">*</span>
                </label>
                <input
                  id="pf-next"
                  type="password"
                  autoComplete="new-password"
                  className={errors.next ? "finp err" : "finp"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                {errors.next ? (
                  <div className="ferr">{errors.next}</div>
                ) : (
                  <div className="fhint">Ít nhất {MIN_PASSWORD_LENGTH} ký tự, nên có cả chữ và số.</div>
                )}
              </div>
              <div className="fgroup">
                <label htmlFor="pf-confirm">
                  Nhập lại mật khẩu mới <span className="req">*</span>
                </label>
                <input
                  id="pf-confirm"
                  type="password"
                  autoComplete="new-password"
                  className={errors.confirm ? "finp err" : "finp"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {errors.confirm && <div className="ferr">{errors.confirm}</div>}
              </div>
              <button className="btn pri" type="submit" disabled={changing}>
                <Icon name="lock" size={15} />
                {changing ? "Đang lưu…" : "Đổi mật khẩu"}
              </button>
              <div className="fhint">
                Đổi mật khẩu xong, các thiết bị khác đang dùng tài khoản này sẽ bị đăng xuất.
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Thiết bị đang đăng nhập tài khoản của bạn"
          extra={
            <>
              <span>{formatNumber(rows.length)} phiên</span>
              <button
                type="button"
                className={revoking ? "btn sm danger saving" : "btn sm danger"}
                disabled={revoking || otherCount === 0}
                onClick={() => void revokeOthers()}
              >
                <Icon name="logout" size={13} />
                Đăng xuất các thiết bị khác
              </button>
            </>
          }
        />
        <DataState
          loading={sessions.loading}
          error={sessions.error}
          onRetry={sessions.reload}
          empty={rows.length === 0}
          emptyMessage="Không tìm thấy phiên đăng nhập nào của tài khoản này"
        >
          <div className="tw">
            <table className="tb2">
              <thead>
                <tr>
                  <th>Thiết bị</th>
                  <th>Địa chỉ IP</th>
                  <th>Bắt đầu</th>
                  <th>Hoạt động cuối</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} style={{ cursor: "default" }}>
                    <td style={{ maxWidth: 340 }}>
                      {s.device}
                      {s.current && (
                        <span className="tiny" style={{ color: "var(--green)", fontWeight: 700, marginLeft: 8 }}>
                          · Thiết bị này
                        </span>
                      )}
                    </td>
                    <td>{s.ip}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatStamp(s.startedAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatStamp(s.lastActiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
        <CardBody>
          <div className="fhint">
            Thu hồi một phiên cụ thể của người khác là việc của quản trị viên, làm ở trang Người dùng Mini
            App · tab Phiên đăng nhập.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** ISO 8601 → "28/08/2026 10:06" */
function formatStamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
