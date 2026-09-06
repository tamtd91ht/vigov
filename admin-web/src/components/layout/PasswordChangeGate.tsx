"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { authService, getServerSession } from "@/services/auth";
import { ChangePasswordForm } from "@/features/profile/ChangePasswordForm";

/**
 * Chốt chặn "phải đổi mật khẩu tạm trước khi dùng hệ thống" (SECURITY.md T-10).
 *
 * Tài khoản mới tạo và tài khoản vừa được quản trị viên đặt lại mật khẩu đều
 * đang giữ một mật khẩu ĐÃ ĐI QUA TAY NGƯỜI KHÁC (đọc trên màn hình, gửi qua
 * tin nhắn). Máy chủ chặn mọi endpoint trừ đường đổi mật khẩu, nên nếu giao
 * diện cứ để người dùng bấm quanh thì họ nhận 403 ở mọi trang mà không hiểu vì
 * sao. Màn này nói thẳng lý do và đưa đúng một việc cần làm.
 *
 * ĐÂY KHÔNG PHẢI LỚP BẢO MẬT — nó chỉ là lớp giải thích. Việc chặn thật do
 * `JwtAuthGuard` ở backend làm, nên gỡ component này ra cũng không mở được gì.
 */
export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);

  if (!session?.mustChangePassword) return <>{children}</>;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(27,58,92,.55)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          background: "#fff",
          border: "1px solid var(--bd)",
          borderRadius: 14,
          boxShadow: "0 18px 48px rgba(27,58,92,.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bd)", display: "flex", gap: 10 }}>
          <Icon name="lock" size={20} />
          <div>
            <b style={{ color: "var(--navy)", fontSize: 15 }}>Đổi mật khẩu tạm</b>
            <div className="tiny muted">Bắt buộc trước khi sử dụng hệ thống</div>
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div className="note" style={{ marginBottom: 16 }}>
            Tài khoản <b>{session.username}</b> đang dùng mật khẩu do quản trị viên đặt. Mật khẩu đó đã đi
            qua tay người khác nên phải đổi trước khi truy cập các phân hệ. Đổi xong, các thiết bị khác
            đang mở tài khoản này sẽ bị đăng xuất.
          </div>
          <ChangePasswordForm idPrefix="gate" />
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bd)" }}>
            <button type="button" className="btn" onClick={() => authService.logout()}>
              <Icon name="logout" size={15} />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
