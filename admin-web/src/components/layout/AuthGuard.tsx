"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { authService, getServerSession } from "@/services/auth";

/** Không có gì để lắng nghe — giá trị chỉ đổi đúng một lần khi hydrate xong */
const noSubscribe = () => () => {};

/**
 * `false` trong HTML dựng sẵn và ở lượt hydrate, `true` từ lượt render sau.
 * Cách này thay cho `useState` + `useEffect(setState)`: không có lượt render
 * thừa, và không vi phạm quy tắc cấm gọi setState trong effect.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Chặn truy cập khu vực quản trị khi chưa đăng nhập.
 *
 * VÌ SAO CẦN `useHydrated`:
 * Phiên nằm trong localStorage, mà localStorage chỉ đọc được ở trình duyệt.
 * Ở lượt hydrate, `useSyncExternalStore` bắt buộc dùng `getServerSession()` —
 * luôn trả `null` để khớp HTML máy chủ đã dựng.
 *
 * Nếu điều hướng ngay khi thấy `null`, mỗi lần F5 người dùng bị đá về trang
 * đăng nhập dù phiên còn nguyên: hiệu ứng chạy ngay sau lượt hydrate, trước
 * khi store kịp đọc lại localStorage. Đây là lỗi có thật, đã tái hiện được
 * bằng `hydrateRoot` trong AuthGuard.test.tsx.
 *
 * Vì vậy phải phân biệt hai trạng thái khác hẳn nhau:
 *   - CHƯA BIẾT (chưa hydrate xong) → chờ, không điều hướng
 *   - ĐÃ BIẾT là chưa đăng nhập     → mới đá về trang đăng nhập
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated && !session) router.replace(appConfig.auth.loginPath);
  }, [hydrated, session, router]);

  if (!hydrated || !session) return null;
  return <>{children}</>;
}
