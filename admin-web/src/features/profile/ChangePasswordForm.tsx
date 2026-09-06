"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/services/api";
import { authService } from "@/services/auth";
import { changeOwnPassword, MIN_PASSWORD_LENGTH } from "@/services/profile.service";

/**
 * Biểu mẫu tự đổi mật khẩu.
 *
 * VÌ SAO TÁCH RA: dùng ở HAI nơi — trang Hồ sơ cá nhân (đổi khi nào muốn) và
 * chốt chặn mật khẩu tạm (`PasswordChangeGate`, bắt buộc đổi trước khi vào hệ
 * thống). Hai bản sao của cùng một biểu mẫu là hai bộ luật kiểm tra sẽ lệch
 * nhau sau vài lần sửa.
 *
 * Sau khi đổi thành công, nếu máy chủ cấp cặp token mới (trường hợp vừa thoát
 * trạng thái mật khẩu tạm) thì phiên phía trình duyệt được cập nhật ngay tại
 * đây — cờ `mustChangePassword` nằm trong chữ ký JWT nên token cũ vẫn bị chặn.
 */

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/** Tiền tố id các ô nhập — hai nơi dùng cùng lúc thì id không được trùng */
export function ChangePasswordForm({
  idPrefix = "pf",
  onDone,
}: {
  idPrefix?: string;
  onDone?: () => void;
}) {
  const { showToast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [changing, setChanging] = useState(false);

  function validate(): PasswordErrors {
    const problems: PasswordErrors = {};
    if (!current.trim()) problems.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!next) problems.next = "Vui lòng nhập mật khẩu mới";
    else if (next.length < MIN_PASSWORD_LENGTH) {
      problems.next = `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
    } else if (next === current) problems.next = "Mật khẩu mới phải khác mật khẩu hiện tại";
    if (confirm !== next) problems.confirm = "Hai lần nhập mật khẩu mới không giống nhau";
    return problems;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changing) return;
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setChanging(true);
    try {
      const result = await changeOwnPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      // Token mới (nếu có) phải vào phiên trước khi lời gọi tiếp theo chạy
      authService.clearPasswordChangeRequirement(result.accessToken);
      showToast(
        result.revokedSessions > 0
          ? `Đã đổi mật khẩu · đã đăng xuất ${formatNumber(result.revokedSessions)} thiết bị khác`
          : "Đã đổi mật khẩu thành công",
      );
      onDone?.();
    } catch (err) {
      /* Máy chủ trả 400 riêng cho "mật khẩu hiện tại sai" (401 dành cho phiên hết
         hạn, và apiClient tự đăng xuất khi gặp 401). Báo ngay tại ô nhập để cán
         bộ sửa mà không mất nội dung đã gõ. Các luật độ mạnh cũng về 400 kèm
         thông báo của máy chủ — hiện ở ô mật khẩu mới. */
      if (err instanceof ApiError && err.status === 400) {
        const wrongCurrent = err.message.toLowerCase().includes("hiện tại");
        setErrors(wrongCurrent ? { current: err.message } : { next: err.message });
        return;
      }
      showToast(err instanceof ApiError ? err.message : "Không đổi được mật khẩu");
    } finally {
      setChanging(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={changing ? "saving" : undefined}>
      <div className="fgroup">
        <label htmlFor={`${idPrefix}-current`}>
          Mật khẩu hiện tại <span className="req">*</span>
        </label>
        <input
          id={`${idPrefix}-current`}
          type="password"
          autoComplete="current-password"
          className={errors.current ? "finp err" : "finp"}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        {errors.current && <div className="ferr">{errors.current}</div>}
      </div>
      <div className="fgroup">
        <label htmlFor={`${idPrefix}-next`}>
          Mật khẩu mới <span className="req">*</span>
        </label>
        <input
          id={`${idPrefix}-next`}
          type="password"
          autoComplete="new-password"
          className={errors.next ? "finp err" : "finp"}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        {errors.next ? (
          <div className="ferr">{errors.next}</div>
        ) : (
          <div className="fhint">
            Ít nhất {MIN_PASSWORD_LENGTH} ký tự, phải có cả chữ và số, không chứa tên đăng nhập.
          </div>
        )}
      </div>
      <div className="fgroup">
        <label htmlFor={`${idPrefix}-confirm`}>
          Nhập lại mật khẩu mới <span className="req">*</span>
        </label>
        <input
          id={`${idPrefix}-confirm`}
          type="password"
          autoComplete="new-password"
          className={errors.confirm ? "finp err" : "finp"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {errors.confirm && <div className="ferr">{errors.confirm}</div>}
      </div>
      <button className="btn pri" type="submit" disabled={changing}>
        <Icon name="lock" size={15} />
        {changing ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
      <div className="fhint">
        Đổi mật khẩu xong, các thiết bị khác đang dùng tài khoản này sẽ bị đăng xuất.
      </div>
    </form>
  );
}
