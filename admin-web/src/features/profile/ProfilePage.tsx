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
import { listOwnSessions, revokeOwnSession } from "@/services/profile.service";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { revokeOtherSessions } from "@/services/users.service";

const PAGE_SUB = "Thông tin tài khoản, thiết bị đang đăng nhập và đổi mật khẩu của chính bạn";

const REVOKE_CONFIRM =
  "Đăng xuất mọi thiết bị khác đang dùng tài khoản của bạn? Thiết bị này vẫn giữ nguyên phiên.";

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

  const sessions = useApiResource(async () => (session ? listOwnSessions() : []), [session?.username]);
  const rows = sessions.data ?? [];

  const failed = (err: unknown, fallback: string) =>
    showToast(err instanceof ApiError ? err.message : fallback);

  /** Đang thu hồi TẤT CẢ thiết bị khác */
  const [revoking, setRevoking] = useState(false);
  /** Id phiên đang thu hồi — khoá đúng dòng đó, các dòng khác vẫn bấm được */
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revokeOne = async (id: string, device: string) => {
    if (!window.confirm(`Đăng xuất thiết bị "${device}"? Thiết bị đó sẽ phải đăng nhập lại.`)) return;
    setRevokingId(id);
    try {
      await revokeOwnSession(id);
      showToast("Đã đăng xuất thiết bị đó");
      sessions.reload();
    } catch (err) {
      failed(err, "Không đăng xuất được thiết bị");
    } finally {
      setRevokingId(null);
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
            <ChangePasswordForm onDone={() => sessions.reload()} />
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
                  <th style={{ textAlign: "right" }}>Thao tác</th>
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
                    <td style={{ textAlign: "right" }}>
                      {s.current ? (
                        /* Không cho tự thu hồi phiên đang dùng: bấm vào là tự đăng xuất
                           giữa lúc đang thao tác, mà nút Đăng xuất ở thanh trên cùng
                           làm đúng việc đó một cách rõ ràng hơn. */
                        <span className="tiny muted">Đang dùng</span>
                      ) : (
                        <button
                          type="button"
                          className="btn sm danger"
                          disabled={revokingId === s.id}
                          onClick={() => void revokeOne(s.id, s.device)}
                        >
                          <Icon name="logout" size={13} />
                          Đăng xuất
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
        <CardBody>
          <div className="fhint">
            Danh sách chỉ gồm phiên của chính bạn. Thu hồi phiên của người khác là việc của quản trị viên,
            làm ở trang Người dùng Mini App · tab Phiên đăng nhập.
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
