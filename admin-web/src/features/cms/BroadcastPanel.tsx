"use client";

import { useState } from "react";
import type { BroadcastLog } from "@/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { Icon } from "@/lib/icons";

/* Gửi thật qua POST /notifications/broadcast (Notification service, WBS #23).
   Riêng kênh ZNS, template nội dung phải được Zalo duyệt trước khi gửi. */

/** Giới hạn ký tự nội dung thông báo (ràng buộc template ZNS) */
const BROADCAST_CONTENT_MAX = 200;

const CHANNEL_OPTIONS = [
  { key: "zns", label: "Zalo ZNS" },
  { key: "push", label: "Push Mini App" },
];

/**
 * Nhóm người nhận đúng bằng các nhóm backend giải được (`audience`).
 * Gửi theo thôn / tổ dân phố cần API phân nhóm người dùng Mini App — chưa có.
 */
const AUDIENCE_OPTIONS: { key: BroadcastLog["audience"]; label: string }[] = [
  { key: "citizen", label: "Toàn bộ công dân" },
  { key: "internal", label: "Cán bộ nội bộ" },
];

export interface BroadcastFormValue {
  channel: BroadcastLog["channel"];
  audience: BroadcastLog["audience"];
  title: string;
  body: string;
}

export function BroadcastPanel({
  sending,
  onSend,
}: {
  sending: boolean;
  onSend: (value: BroadcastFormValue) => void;
}) {
  const [channel, setChannel] = useState<BroadcastLog["channel"]>("zns");
  const [audience, setAudience] = useState<BroadcastLog["audience"]>(AUDIENCE_OPTIONS[0].key);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  const submit = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Vui lòng nhập tiêu đề thông báo";
    if (!content.trim()) next.content = "Vui lòng nhập nội dung thông báo";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSend({ channel, audience, title: title.trim(), body: content.trim() });
    setTitle("");
    setContent("");
  };

  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <Card>
        <CardHeader title="Soạn thông báo mới" />
        <CardBody>
          <div className="fgroup">
            <label>Kênh gửi</label>
            <SegmentControl options={CHANNEL_OPTIONS} value={channel} onChange={(k) => setChannel(k as BroadcastLog["channel"])} />
          </div>

          <div className="fgroup">
            <label>Đối tượng nhận</label>
            <select
              className="finp"
              value={audience}
              onChange={(e) => setAudience(e.target.value as BroadcastLog["audience"])}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="fhint">Số người nhận do máy chủ xác định tại thời điểm gửi.</div>
          </div>

          <div className="fgroup">
            <label>
              Tiêu đề <span className="req">*</span>
            </label>
            <input
              className={`finp ${errors.title ? "err" : ""}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Lịch cắt điện bảo trì trạm biến áp Thôn Đông"
            />
            {errors.title && <div className="ferr">{errors.title}</div>}
          </div>

          <div className="fgroup">
            <label>
              Nội dung <span className="req">*</span>
            </label>
            <textarea
              className={`finp ${errors.content ? "err" : ""}`}
              style={{ minHeight: 110 }}
              value={content}
              maxLength={BROADCAST_CONTENT_MAX}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nội dung ngắn gọn gửi tới người dân…"
            />
            {errors.content && <div className="ferr">{errors.content}</div>}
            <div className="fhint" style={{ textAlign: "right" }}>
              {content.length}/{BROADCAST_CONTENT_MAX} ký tự
            </div>
          </div>

          <button
            className={sending ? "btn pri saving" : "btn pri"}
            type="button"
            disabled={sending}
            onClick={submit}
          >
            <Icon name="send" size={15} />
            Gửi thông báo
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lưu ý khi gửi thông báo" />
        <CardBody>
          <div className="note" style={{ marginBottom: 12 }}>
            Thông báo được gửi thật qua <b>Notification service</b>; danh sách người nhận do máy chủ giải ra theo nhóm
            đối tượng đã chọn.
          </div>
          <div className="note" style={{ marginBottom: 12 }}>
            Kênh <b>Zalo ZNS</b>: nội dung phải khớp template đã được Zalo phê duyệt trước; thời gian duyệt template thường 1–3 ngày làm việc.
          </div>
          <div className="note">
            Kênh <b>Push Mini App</b> chỉ tới được công dân đã cài và cho phép nhận thông báo — nên dùng kèm ZNS với tin khẩn.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
