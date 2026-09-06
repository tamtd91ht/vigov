import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { PasswordChangeGate } from "@/components/layout/PasswordChangeGate";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      {/* Đang giữ mật khẩu tạm thì phủ kín màn hình bằng ô đổi mật khẩu:
          máy chủ đã chặn mọi endpoint khác, để người dùng bấm quanh chỉ nhận
          403 ở mọi trang mà không biết vì sao. */}
      <PasswordChangeGate>
        <Sidebar />
        <div className="main">
          <Topbar />
          <main>{children}</main>
        </div>
      </PasswordChangeGate>
    </AuthGuard>
  );
}
