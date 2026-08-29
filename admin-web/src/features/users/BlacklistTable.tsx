"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import { deactivateBlacklist, listBlacklist, type BlacklistItem } from "@/services/users.service";

/** ===== Cấu hình nhãn / màu cục bộ ===== */
const KIND_CHIP: Record<BlacklistItem["kind"], { label: string; color: string; tint: string }> = {
  citizen: { label: "Công dân", color: "var(--blue)", tint: "rgba(59,130,196,.10)" },
  device: { label: "Thiết bị", color: "var(--purple)", tint: "rgba(142,68,173,.10)" },
  ip: { label: "IP", color: "var(--teal)", tint: "rgba(23,162,162,.10)" },
};

const STATE_CHIP = {
  active: { label: "Đang chặn", color: "var(--red)", tint: "rgba(231,76,60,.10)" },
  removed: { label: "Đã gỡ", color: "var(--mut)", tint: "rgba(136,150,166,.12)" },
} as const;

const AUTO_BLOCK_NOTE = "Chặn tự động theo tần suất spam sẽ cấu hình ở dịch vụ Bảo mật API (P3-31).";

/** Tab "Blacklist" — đối tượng bị chặn khỏi Mini App (công dân / thiết bị / IP) */
export function BlacklistTable() {
  const { showToast } = useToast();
  const blacklist = useApiResource(() => listBlacklist(), []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const records = blacklist.data?.items ?? [];
  const activeCount = records.filter((r) => r.active).length;

  const handleRemove = async (record: BlacklistItem) => {
    if (!window.confirm(`Gỡ chặn "${record.subject}"?`)) return;
    setBusyId(record.id);
    try {
      await deactivateBlacklist(record.id);
      showToast(`Đã gỡ chặn ${record.subject}`);
      blacklist.reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không gỡ được bản ghi chặn");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Danh sách chặn"
        extra={
          <span>
            {formatNumber(activeCount)} đang chặn / {formatNumber(records.length)} bản ghi
          </span>
        }
      />
      <CardBody style={{ paddingBottom: 12 }}>
        <div className="note">{AUTO_BLOCK_NOTE}</div>
      </CardBody>
      <DataState
        loading={blacklist.loading}
        error={blacklist.error}
        onRetry={blacklist.reload}
        empty={records.length === 0}
        emptyMessage="Chưa có đối tượng nào trong blacklist"
      >
        <div className="tw">
          <table className="tb2">
            <thead>
              <tr>
                <th>Đối tượng</th>
                <th>Loại</th>
                <th>Lý do chặn</th>
                <th>Người thao tác</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const kind = KIND_CHIP[r.kind];
                const state = r.active ? STATE_CHIP.active : STATE_CHIP.removed;
                return (
                  <tr key={r.id} style={{ cursor: "default" }} className={busyId === r.id ? "saving" : undefined}>
                    <td className="tt">{r.subject}</td>
                    <td>
                      <Chip color={kind.color} tint={kind.tint}>
                        {kind.label}
                      </Chip>
                    </td>
                    <td style={{ maxWidth: 320 }}>{r.reason}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={r.by} />
                        {r.by}
                      </span>
                    </td>
                    <td>
                      <Chip color={state.color} tint={state.tint} dot>
                        {state.label}
                      </Chip>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.active && (
                        <button
                          type="button"
                          className="btn sm"
                          disabled={busyId === r.id}
                          onClick={() => handleRemove(r)}
                        >
                          <Icon name="trash" size={13} />
                          Gỡ chặn
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>
    </Card>
  );
}
