"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { useApiResource } from "@/hooks/useApiResource";
import { useRealtime } from "@/hooks/useRealtime";
import { fetchInbox } from "@/services/notifications.service";
import { REALTIME_EVENTS } from "@/services/realtime.service";
import { Icon } from "@/lib/icons";
import { authService, getServerSession } from "@/services/auth";
import { Avatar } from "@/components/ui/Avatar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

/** Hộp thư rỗng dùng khi chưa có phiên — tránh gọi API lúc đang khôi phục phiên */
const EMPTY_INBOX = { items: [], total: 0, unread: 0, page: 1, limit: 0 };

export function Topbar() {
  const router = useRouter();
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Hộp thư của chính người đang đăng nhập (GET /notifications).
   * Chỉ tải khi đã có phiên — trang đăng nhập không dựng Topbar, nhưng lúc
   * khôi phục phiên từ bộ nhớ thì `session` rỗng trong một nhịp render đầu.
   */
  const inbox = useApiResource(async () => (session ? fetchInbox() : EMPTY_INBOX), [session?.username]);

  /*
   * Có thông báo mới thì tải lại hộp thư để chuông sáng ngay, không chờ người
   * dùng chuyển trang. Backend chỉ gửi mã thông báo nên bắt buộc phải gọi lại
   * API — payload không đủ dữ liệu (và không qua bộ lọc quyền) để vẽ.
   */
  useRealtime({ [REALTIME_EVENTS.notificationNew]: () => inbox.reload() });

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const logout = () => {
    authService.logout();
    router.replace(appConfig.auth.loginPath);
  };

  const goto = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  return (
    <header className="tb">
      <div className="tb-title">
        <b>UBND {appConfig.org.name.toUpperCase()}</b>
        <span>{appConfig.org.parent}</span>
      </div>

      <GlobalSearch />

      <div className="tb-right">
        <NotificationBell inbox={inbox} />
        <button className="icbtn" title="Trợ giúp" type="button" onClick={() => router.push("/help")}>
          <Icon name="help" size={18} />
        </button>
        <div style={{ position: "relative" }} ref={menuRef}>
          <div className="user" onClick={() => setMenuOpen((v) => !v)}>
            {session && <Avatar name={session.displayName} large />}
            <div>
              <b>{session?.displayName ?? "…"}</b>
              <span>{session?.title ?? ""}</span>
            </div>
          </div>
          {menuOpen && (
            <div className="usermenu">
              <button type="button" onClick={() => goto("/profile")}>
                <Icon name="users" size={16} /> Hồ sơ cá nhân
              </button>
              <button type="button" onClick={() => goto("/help")}>
                <Icon name="help" size={16} /> Trợ giúp
              </button>
              <button type="button" onClick={logout}>
                <Icon name="logout" size={16} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
