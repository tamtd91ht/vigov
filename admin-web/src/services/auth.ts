"use client";

import { appConfig } from "@/config/app.config";
import { findStaff } from "@/mocks/directory";

/** Phiên đăng nhập phía client — token do backend cấp (JWT) */
export interface Session {
  username: string;
  displayName: string;
  title: string;
  roleKey: string;
  loginAt: string;
  /** JWT gửi kèm mọi lời gọi API; rỗng khi chạy chế độ mock */
  accessToken: string;
}

/** Kết quả trả về từ POST /auth/staff/login */
interface StaffLoginResponse {
  accessToken: string;
  user: {
    username: string;
    displayName: string;
    initials: string;
    color: string;
    department: string;
    roleKey: string;
  };
}

/**
 * Auth service cho Web Quản trị.
 *
 * Mặc định gọi backend thật (`POST {API_BASE_URL}/auth/staff/login`) — xác thực
 * và phân quyền do máy chủ quyết định, phía client chỉ giữ token.
 *
 * Chế độ mock (`NEXT_PUBLIC_USE_MOCKS=true`) chỉ dành cho demo giao diện khi
 * chưa dựng backend: KHÔNG bật ở môi trường thật vì mật khẩu demo nằm trong
 * mã nguồn tải về trình duyệt.
 */

let cachedSession: Session | null = null;
let cacheLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function persist(session: Session) {
  localStorage.setItem(appConfig.auth.storageKey, JSON.stringify(session));
  cachedSession = session;
  cacheLoaded = true;
  notifyListeners();
}

export const authService = {
  async login(username: string, password: string): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
    if (appConfig.api.useMocks) {
      if (username === appConfig.auth.demoUsername && password === appConfig.auth.demoPassword) {
        const staff = findStaff("Nguyễn Văn Bình");
        persist({
          username,
          displayName: staff?.name ?? username,
          title: staff?.title ?? "Cán bộ",
          roleKey: "admin",
          loginAt: new Date().toISOString(),
          accessToken: "",
        });
        return { ok: true, session: cachedSession as Session };
      }
      return { ok: false, error: "Tài khoản hoặc mật khẩu không đúng" };
    }

    try {
      const res = await fetch(`${appConfig.api.baseUrl}/auth/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.status === 401) return { ok: false, error: "Tài khoản hoặc mật khẩu không đúng" };
      if (res.status === 429) {
        return { ok: false, error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ một phút rồi thử lại." };
      }
      if (!res.ok) return { ok: false, error: `Máy chủ trả về lỗi ${res.status}. Vui lòng thử lại sau.` };

      const data = (await res.json()) as StaffLoginResponse;
      // Chức danh hiển thị lấy từ danh bạ; backend trả bộ phận và vai trò
      const staff = findStaff(data.user.displayName);
      persist({
        username: data.user.username,
        displayName: data.user.displayName,
        title: staff?.title ?? data.user.department,
        roleKey: data.user.roleKey,
        loginAt: new Date().toISOString(),
        accessToken: data.accessToken,
      });
      return { ok: true, session: cachedSession as Session };
    } catch {
      return { ok: false, error: "Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại." };
    }
  },

  getSession(): Session | null {
    if (typeof window === "undefined") return null;
    if (!cacheLoaded) {
      try {
        const raw = localStorage.getItem(appConfig.auth.storageKey);
        cachedSession = raw ? (JSON.parse(raw) as Session) : null;
      } catch {
        cachedSession = null;
      }
      cacheLoaded = true;
    }
    return cachedSession;
  },

  /** Token gửi kèm header Authorization của các lời gọi API */
  getAccessToken(): string | null {
    return this.getSession()?.accessToken || null;
  },

  /** Đăng ký lắng nghe thay đổi phiên (dùng cho useSyncExternalStore) */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  logout() {
    localStorage.removeItem(appConfig.auth.storageKey);
    cachedSession = null;
    cacheLoaded = true;
    notifyListeners();
  },
};

/** Snapshot phía server — luôn chưa đăng nhập */
export function getServerSession(): Session | null {
  return null;
}
