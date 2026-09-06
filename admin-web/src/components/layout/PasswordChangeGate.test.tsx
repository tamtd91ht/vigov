import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordChangeGate } from "./PasswordChangeGate";
import { authService, type Session } from "@/services/auth";

/**
 * Chốt chặn mật khẩu tạm (SECURITY.md T-10).
 *
 * VÌ SAO TEST: điều dễ hỏng nhất ở đây là chốt chặn "mở" sai chiều — cờ không
 * bật mà vẫn phủ kín màn hình (không ai vào được hệ thống), hoặc cờ bật mà vẫn
 * cho qua (người dùng bấm quanh rồi nhận 403 ở mọi trang, không hiểu vì sao).
 * Cả hai đều là lỗi nhìn thấy ngay nhưng chỉ xuất hiện với tài khoản mới tạo —
 * loại tài khoản mà lập trình viên gần như không bao giờ dùng để thử.
 */

const BASE: Session = {
  username: "tuan.lm",
  displayName: "Lê Minh Tuấn",
  title: "Chuyên viên",
  roleKey: "officer",
  loginAt: "2026-09-06T08:00:00.000Z",
  accessToken: "token",
};

function mockSession(session: Session | null) {
  vi.spyOn(authService, "getSession").mockReturnValue(session);
  vi.spyOn(authService, "subscribe").mockReturnValue(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PasswordChangeGate", () => {
  it("không có cờ thì cho qua, hiện đúng nội dung bên trong", () => {
    mockSession(BASE);

    render(
      <PasswordChangeGate>
        <div>Nội dung phân hệ</div>
      </PasswordChangeGate>,
    );

    expect(screen.getByText("Nội dung phân hệ")).toBeTruthy();
    expect(screen.queryByText("Đổi mật khẩu tạm")).toBeNull();
  });

  it("còn mật khẩu tạm thì chặn nội dung và bắt đổi mật khẩu", () => {
    mockSession({ ...BASE, mustChangePassword: true });

    render(
      <PasswordChangeGate>
        <div>Nội dung phân hệ</div>
      </PasswordChangeGate>,
    );

    expect(screen.queryByText("Nội dung phân hệ")).toBeNull();
    expect(screen.getByText("Đổi mật khẩu tạm")).toBeTruthy();
    // Nói rõ tài khoản nào, để người dùng biết mình đang ở đâu
    expect(screen.getByText(BASE.username)).toBeTruthy();
    // Luôn còn đường đăng xuất: không đổi được mật khẩu thì phải thoát ra được
    expect(screen.getByRole("button", { name: /Đăng xuất/ })).toBeTruthy();
  });

  it("chưa đăng nhập thì không phủ gì — việc điều hướng là của AuthGuard", () => {
    mockSession(null);

    render(
      <PasswordChangeGate>
        <div>Nội dung phân hệ</div>
      </PasswordChangeGate>,
    );

    expect(screen.getByText("Nội dung phân hệ")).toBeTruthy();
  });
});
