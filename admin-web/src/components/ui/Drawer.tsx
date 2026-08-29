"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "@/lib/icons";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Drawer chi tiết trượt từ phải — dùng chung mọi phân hệ */
export function Drawer({ open, onClose, title, meta, footer, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`ovl ${open ? "on" : ""}`} onClick={onClose} />
      <aside className={`dw ${open ? "on" : ""}`} aria-hidden={!open}>
        <div className="dw-h">
          <div style={{ flex: 1 }}>
            <h3>{title}</h3>
            {meta && <div className="m">{meta}</div>}
          </div>
          <button className="icbtn" onClick={onClose} title="Đóng" type="button">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="dw-b">{children}</div>
        <div className="dw-f">
          {footer ?? (
            <button className="btn" onClick={onClose} type="button">
              Đóng
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
