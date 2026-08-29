import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService, type IdentifyResult } from "@/services/auth.service";
import { SESSION_EXPIRED_EVENT, readStoredSession } from "@/services/api";
import type { CitizenSession } from "@/types";

interface SessionValue {
  session: CitizenSession | null;
  identified: boolean;
  /**
   * Thử định danh qua Zalo. Trả về `{kind:'ok'}` khi thành công, hoặc
   * `{kind:'otp'}` để màn onboarding mở ô nhập số điện thoại + mã xác thực.
   */
  identify: () => Promise<IdentifyResult>;
  /** Đường thay thế: xin mã OTP cho số điện thoại nhập tay */
  requestOtp: (phone: string) => Promise<void>;
  /** Đường thay thế: xác thực mã và mở phiên */
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Che giữa số điện thoại: 0987654321 -> 098•••321 */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}•••${phone.slice(-3)}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CitizenSession | null>(readStoredSession);

  /**
   * api.ts phát sự kiện này khi máy chủ trả 401 với token đang dùng (hết hạn,
   * bị thu hồi). Phiên trong localStorage đã bị xoá ở đó; ở đây chỉ cần đồng bộ
   * React state để router đưa người dùng về màn định danh.
   */
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const identify = useCallback(async () => {
    const result = await authService.identifyWithZalo();
    if (result.kind === "ok") setSession(result.session);
    return result;
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await authService.requestOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    setSession(await authService.verifyOtp(phone, otp));
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ session, identified: session !== null, identify, requestOtp, verifyOtp, logout }),
    [session, identify, requestOtp, verifyOtp, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession phải nằm trong SessionProvider");
  return ctx;
}
