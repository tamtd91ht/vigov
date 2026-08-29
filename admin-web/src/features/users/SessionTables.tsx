"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataState } from "@/components/ui/DataState";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { formatNumber, nameInitials } from "@/lib/format";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  listCitizenSessions,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type SessionRecord,
} from "@/services/users.service";

/** Hai nhóm kênh hiển thị: cán bộ (web) và công dân (app Flutter + Zalo Mini App) */
type SessionGroup = "web" | "citizen";

const KIND_OPTIONS: { key: SessionGroup; label: string }[] = [
  { key: "web", label: "Cán bộ (web)" },
  { key: "citizen", label: "Công dân (Mini App)" },
];

const REVOKE_OTHERS_CONFIRM =
  "Thu hồi mọi phiên đăng nhập khác của chính tài khoản bạn đang dùng?";

/** Tab "Phiên đăng nhập" — phiên web quản trị và phiên Mini App của công dân */
export function SessionTables() {
  const { showToast } = useToast();
  const [group, setGroup] = useState<SessionGroup>("web");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const sessions = useApiResource(
    () => (group === "web" ? listSessions("web") : listCitizenSessions()),
    [group],
  );
  const rows = sessions.data?.items ?? [];

  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  const handleRevoke = async (session: SessionRecord) => {
    if (!window.confirm(`Thu hồi phiên đăng nhập của ${session.subject}?`)) return;
    setBusyId(session.id);
    try {
      await revokeSession(session.id);
      showToast(`Đã thu hồi phiên đăng nhập của ${session.subject}`);
      sessions.reload();
    } catch (err) {
      failed(err, "Không thu hồi được phiên đăng nhập");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm(REVOKE_OTHERS_CONFIRM)) return;
    setRevoking(true);
    try {
      const result = await revokeOtherSessions();
      showToast(
        result.revoked > 0
          ? `Đã thu hồi ${formatNumber(result.revoked)} phiên đăng nhập khác`
          : "Không còn phiên nào khác để thu hồi",
      );
      sessions.reload();
    } catch (err) {
      failed(err, "Không thu hồi được các phiên khác");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Phiên đăng nhập đang hoạt động"
        extra={
          <>
            <span>{formatNumber(sessions.data?.total ?? 0)} phiên</span>
            <button
              type="button"
              className={revoking ? "btn sm danger saving" : "btn sm danger"}
              disabled={revoking}
              onClick={handleRevokeOthers}
            >
              <Icon name="logout" size={13} />
              Thu hồi tất cả phiên khác
            </button>
          </>
        }
      />
      <CardBody style={{ paddingBottom: 12 }}>
        <SegmentControl
          options={KIND_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          value={group}
          onChange={(k) => setGroup(k as SessionGroup)}
        />
      </CardBody>
      <DataState
        loading={sessions.loading}
        error={sessions.error}
        onRetry={sessions.reload}
        empty={rows.length === 0}
        emptyMessage="Không còn phiên đăng nhập nào đang hoạt động"
      >
        <div className="tw">
          <table className="tb2">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Thiết bị</th>
                <th>Địa chỉ IP</th>
                <th>Bắt đầu</th>
                <th>Hoạt động cuối</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={{ cursor: "default" }} className={busyId === s.id ? "saving" : undefined}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                      {s.kind === "web" ? (
                        <Avatar name={s.subject} />
                      ) : (
                        <span className="av" style={{ background: "var(--blue)" }} title={s.subject}>
                          {nameInitials(s.subject)}
                        </span>
                      )}
                      <span className="tt">{s.subject}</span>
                    </span>
                  </td>
                  <td style={{ maxWidth: 280 }}>{s.device}</td>
                  <td>{s.ip}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatStamp(s.startedAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatStamp(s.lastActiveAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn sm danger"
                      disabled={busyId === s.id}
                      onClick={() => handleRevoke(s)}
                    >
                      <Icon name="logout" size={13} />
                      Thu hồi phiên
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Card>
  );
}

/** ISO 8601 → "28/08/2026 10:06" */
function formatStamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
