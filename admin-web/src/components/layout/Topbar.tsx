"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { unreadNotifications } from "@/mocks/directory";
import { Icon } from "@/lib/icons";
import { authService, getServerSession } from "@/services/auth";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar() {
  const router = useRouter();
  const { showToast } = useToast();
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const logout = () => {
    authService.logout();
    router.replace(appConfig.auth.loginPath);
  };

  return (
    <header className="tb">
      <div className="tb-title">
        <b>UBND {appConfig.org.name.toUpperCase()}</b>
        <span>{appConfig.org.parent}</span>
      </div>
      <div className="tb-search">
        <Icon name="search" size={16} />
        <input
          type="text"
          placeholder="Tìm nhiệm vụ, văn bản, phản ánh…"
          onKeyDown={(e) => {
            // Tìm kiếm toàn cục nối API search (P3-28); phạm vi thật chờ khách chốt
            if (e.key === "Enter") showToast("Tìm kiếm toàn cục sẽ kết nối API ở giai đoạn backend");
          }}
        />
      </div>
      <div className="tb-right">
        <button
          className="icbtn"
          title="Thông báo"
          type="button"
          onClick={() => showToast("Trung tâm thông báo in-app đang chờ khách hàng xác nhận phạm vi")}
        >
          <Icon name="bell" size={18} />
          {unreadNotifications > 0 && <span className="badge">{unreadNotifications}</span>}
        </button>
        <button
          className="icbtn"
          title="Trợ giúp"
          type="button"
          onClick={() => showToast("Tài liệu hướng dẫn sử dụng sẽ bổ sung khi bàn giao")}
        >
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
              <button type="button" onClick={() => showToast("Trang hồ sơ cá nhân sẽ bổ sung cùng backend")}>
                <Icon name="users" size={16} /> Hồ sơ cá nhân
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
