"use client";

import { useState } from "react";
import type { BroadcastLog } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { formatNumber } from "@/lib/format";
import { BROADCAST_CHANNELS, BROADCAST_STATUS } from "./config";

const AUDIENCE_SEGMENTS = [
  { key: "citizen", label: "Gửi công dân" },
  { key: "internal", label: "Gửi nội bộ" },
];

/**
 * Backend chưa có endpoint liệt kê các lượt broadcast đã gửi
 * (`/notifications` chỉ trả hộp thư của chính người đăng nhập), nên bảng này
 * vẫn dựng từ dữ liệu mẫu, cộng thêm các lượt vừa gửi trong phiên làm việc.
 */
const HISTORY_NOTE =
  "Bảng lịch sử còn dùng dữ liệu mẫu — backend chưa có endpoint danh sách lượt gửi hàng loạt. Các lượt gửi trong phiên làm việc này là số liệu thật do máy chủ trả về.";

export function BroadcastHistory({ logs }: { logs: BroadcastLog[] }) {
  const [audience, setAudience] = useState<BroadcastLog["audience"]>("citizen");

  const filtered = logs.filter((l) => l.audience === audience);

  return (
    <>
      <div style={{ marginBottom: 14, display: "inline-flex" }}>
        <SegmentControl options={AUDIENCE_SEGMENTS} value={audience} onChange={(k) => setAudience(k as BroadcastLog["audience"])} />
      </div>
      <Card>
        <CardBody style={{ paddingBottom: 12 }}>
          <div className="note">{HISTORY_NOTE}</div>
        </CardBody>
        <div className="tw">
          <table className="tb2">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Kênh</th>
                <th>Người gửi</th>
                <th>Thời điểm</th>
                <th>Đã nhận / Tổng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const channel = BROADCAST_CHANNELS[l.channel];
                const status = BROADCAST_STATUS[l.status];
                return (
                  <tr key={l.id} style={{ cursor: "default" }}>
                    <td style={{ minWidth: 260 }}>
                      <div className="tt">{l.title}</div>
                    </td>
                    <td>
                      <Chip color={channel.color} tint={channel.tint}>{channel.label}</Chip>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                        <Avatar name={l.sentBy} />
                        {l.sentBy}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{l.sentAt}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <b style={{ color: "var(--navy)" }}>{formatNumber(l.delivered)}</b>
                      <span className="muted">/{formatNumber(l.total)}</span>
                    </td>
                    <td>
                      <Chip color={status.color} tint={status.tint} dot>{status.label}</Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty">Chưa có lượt gửi nào cho nhóm này</div>}
      </Card>
    </>
  );
}
