import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "@/config/app.config";

/**
 * Bảo vệ hành vi giữ phiên khi tải lại trang (F5).
 *
 * Lỗi từng gặp: `useSyncExternalStore` ở lượt hydrate bắt buộc dùng snapshot
 * phía máy chủ (luôn `null`), nên hiệu ứng điều hướng chạy trước khi
 * localStorage kịp đọc — người dùng bị đá về trang đăng nhập dù phiên còn
 * nguyên trong localStorage.
 *
 * `services/auth` giữ phiên trong biến cấp module, mà F5 thật thì nạp lại toàn
 * bộ module. Vì vậy mỗi test phải `resetModules()` rồi import động, nếu không
 * bộ nhớ đệm của test trước sẽ che mất đúng tình huống cần kiểm.
 */

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const SESSION = {
  username: "admin",
  displayName: "Quản trị hệ thống",
  title: "Quản trị",
  roleKey: "admin",
  loginAt: "2026-08-29T00:00:00.000Z",
  accessToken: "jwt-gia-lap",
};

/** Nạp lại AuthGuard với bộ nhớ đệm phiên sạch — tương đương một lần F5 */
async function loadGuardFresh() {
  vi.resetModules();
  const mod = await import("./AuthGuard");
  return mod.AuthGuard;
}

describe("AuthGuard", () => {
  beforeEach(() => {
    replace.mockClear();
    localStorage.clear();
  });

  it("giữ nguyên phiên đã lưu khi tải lại trang, không đá về trang đăng nhập", async () => {
    localStorage.setItem(appConfig.auth.storageKey, JSON.stringify(SESSION));
    const AuthGuard = await loadGuardFresh();

    render(
      <AuthGuard>
        <p>Khu vực quản trị</p>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Khu vực quản trị")).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("đá về trang đăng nhập khi thật sự chưa có phiên", async () => {
    const AuthGuard = await loadGuardFresh();

    render(
      <AuthGuard>
        <p>Khu vực quản trị</p>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(appConfig.auth.loginPath);
    });
    expect(screen.queryByText("Khu vực quản trị")).not.toBeInTheDocument();
  });

  it("bỏ qua phiên hỏng trong localStorage thay vì làm vỡ trang", async () => {
    localStorage.setItem(appConfig.auth.storageKey, "{ khong-phai-json");
    const AuthGuard = await loadGuardFresh();

    render(
      <AuthGuard>
        <p>Khu vực quản trị</p>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(appConfig.auth.loginPath);
    });
  });

  /**
   * Test QUAN TRỌNG NHẤT của tệp này.
   *
   * Ba test trên dùng `render()` — render phía client thuần, `useSyncExternalStore`
   * đọc localStorage ngay nên KHÔNG tái hiện được lỗi. Phải dựng HTML bằng
   * `renderToString` (lúc đó snapshot là `null`) rồi `hydrateRoot` lên đúng HTML
   * đó, giống hệt điều Next.js làm với trang tĩnh khi người dùng bấm F5.
   *
   * Đã kiểm ngược: bỏ cờ `mounted` trong AuthGuard thì test này đỏ với
   * `replace` được gọi 1 lần tới "/login".
   */
  it("không đá về đăng nhập khi hydrate trang tĩnh có phiên trong localStorage", async () => {
    localStorage.setItem(appConfig.auth.storageKey, JSON.stringify(SESSION));
    const AuthGuard = await loadGuardFresh();

    const element = (
      <AuthGuard>
        <p>Khu vực quản trị</p>
      </AuthGuard>
    );
    const container = document.createElement("div");
    // HTML máy chủ dựng ra khi chưa biết gì về localStorage
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, element);
    });

    expect(replace).not.toHaveBeenCalled();
  });
});
