"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/lib/icons";
import { DataState } from "@/components/ui/DataState";
import { useToast } from "@/components/ui/Toast";
import type { ApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  markNotificationRead,
  markNotificationsRead,
  notificationLink,
  type InboxNotification,
  type InboxPage,
} from "@/services/notifications.service";

/**
 * Trung tâm thông báo (WBS #1) — chuông trên thanh trên cùng.
 *
 * Hộp thư do Topbar tải (nó cũng cần con số chưa đọc cho badge), truyền xuống
 * đây dưới dạng `ApiResource` để hai nơi dùng CHUNG một lượt gọi API thay vì mỗi
 * nơi tự gọi `/notifications` một lần.
 *
 * Đánh dấu đã đọc cập nhật ngay tại chỗ (`setData`) rồi mới gọi lại máy chủ:
 * badge phải tắt liền dưới ngón tay, không chờ vòng gọi API thứ hai.
 */
export function NotificationBell({ inbox }: { inbox: ApiResource<InboxPage> }) {
  const router = useRouter();
  const { showToast } = useToast();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Trừ số chưa đọc và đánh dấu các mã đã đọc ngay trong dữ liệu đang hiển thị */
  const applyRead = (ids: string[]) => {
    const set = new Set(ids);
    inbox.setData((prev) => {
      if (!prev) return prev;
      const stillUnread = prev.items.filter((n) => set.has(n.id) && !n.read).length;
      return {
        ...prev,
        unread: Math.max(0, prev.unread - stillUnread),
        items: prev.items.map((n) => (set.has(n.id) ? { ...n, read: true } : n)),
      };
    });
  };

  const failed = (err: unknown, fallback: string) =>
    showToast(err instanceof ApiError ? err.message : fallback);

  /** Bấm một thông báo: đánh dấu đã đọc rồi mở bản ghi liên quan nếu suy ra được */
  const openItem = async (item: InboxNotification) => {
    setOpen(false);
    const href = notificationLink(item);
    if (href) router.push(href);

    if (item.read) return;
    applyRead([item.id]);
    try {
      await markNotificationRead(item.id);
    } catch (err) {
      // Cập nhật tại chỗ đã sai với máy chủ — tải lại để con số về đúng thực tế
      inbox.reload();
      failed(err, "Không đánh dấu được thông báo đã đọc");
    }
  };

  /**
   * "Đánh dấu tất cả đã đọc" — backend chưa có endpoint gộp nên gọi lần lượt
   * từng thông báo CHƯA ĐỌC đang hiển thị trong khay (tối đa 10 mã).
   */
  const markAll = async () => {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const done = await markNotificationsRead(ids);
      applyRead(ids.slice(0, done));
      if (done < ids.length) {
        showToast(`Đã đánh dấu ${done}/${ids.length} thông báo — số còn lại thử lại sau`);
        inbox.reload();
      } else {
        showToast(`Đã đánh dấu ${done} thông báo là đã đọc`);
      }
    } catch (err) {
      inbox.reload();
      failed(err, "Không đánh dấu được thông báo đã đọc");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={boxRef}>
      <button
        className="icbtn"
        title="Thông báo"
        type="button"
        aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>

      {open && (
        <div className="notimenu">
          <div className="notimenu-h">
            <b>Thông báo</b>
            <span className="tiny muted">{unread > 0 ? `${unread} chưa đọc` : "Đã đọc hết"}</span>
            <button
              type="button"
              className="btn sm"
              disabled={busy || unread === 0 || items.every((n) => n.read)}
              onClick={() => void markAll()}
            >
              <Icon name="ok" size={13} />
              Đánh dấu đã đọc
            </button>
          </div>

          <div className={busy ? "notimenu-b saving" : "notimenu-b"}>
            <DataState
              loading={inbox.loading}
              error={inbox.error}
              onRetry={inbox.reload}
              empty={items.length === 0}
              emptyMessage="Chưa có thông báo nào"
            >
              {items.map((item) => {
                const href = notificationLink(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={item.read ? "noti" : "noti unread"}
                    onClick={() => void openItem(item)}
                  >
                    <span className="dot" aria-hidden />
                    <span className="tx">
                      <b>{item.title}</b>
                      {item.body && <span className="bd">{item.body}</span>}
                      <span className="tm">
                        {formatNotifiedAt(item.createdAt)}
                        {href ? " · bấm để mở bản ghi liên quan" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </DataState>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ISO 8601 → "10:06 · 06/09/2026"; hôm nay thì chỉ hiện giờ.
 * Khay thông báo hẹp nên bớt được chữ nào là dễ đọc thêm chữ đó.
 */
function formatNotifiedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return sameDay ? time : `${time} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
