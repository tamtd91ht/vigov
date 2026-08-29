"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { authService, getServerSession } from "@/services/auth";

/** Chặn truy cập khu vực quản trị khi chưa đăng nhập (mock phía client — thay bằng middleware khi có JWT thật) */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);

  useEffect(() => {
    if (!session) router.replace(appConfig.auth.loginPath);
  }, [session, router]);

  if (!session) return null;
  return <>{children}</>;
}
