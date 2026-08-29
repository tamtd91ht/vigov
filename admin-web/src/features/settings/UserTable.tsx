"use client";

import { useState, type FormEvent } from "react";
import { fetchDepartments } from "@/services/catalogs.service";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { useCatalog } from "@/hooks/useCatalog";
import { generateTempPassword } from "./helpers";
import { ApiError } from "@/services/api";
import { fetchRoles } from "@/services/settings.service";
import {
  changeStaffPassword,
  createStaff,
  listStaff,
  updateStaff,
  type StaffAccount,
} from "@/services/users.service";

/**
 * Tab "Tài khoản & phân quyền" — danh sách cán bộ lấy từ GET /users/staff,
 * danh mục vai trò từ GET /settings/roles. Đổi vai trò / khoá / thêm tài khoản
 * đều gọi API rồi cập nhật bảng theo bản ghi máy chủ trả về.
 */

const EMAIL_DOMAIN = "daithang.gov.vn";
const STATUS_LABEL: Record<StaffAccount["status"], string> = {
  active: "Đang hoạt động",
  locked: "Tạm khoá",
};

/** Bộ phận để trống — mặc định là mục đầu danh mục sau khi tải xong */
const EMPTY_FORM = { displayName: "", username: "", department: "", roleKey: "" };

/** Mật khẩu tạm chỉ trả về một lần — giữ lại để quản trị viên kịp sao chép */
interface TempPasswordInfo {
  username: string;
  displayName: string;
  tempPassword: string;
}

export function UserTable() {
  const { showToast } = useToast();
  // Danh mục bộ phận lấy từ API (GET /catalogs/departments)
  const departments = useCatalog(fetchDepartments);
  const staff = useApiResource(() => listStaff(), []);
  const rolesRes = useApiResource(() => fetchRoles(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<{ displayName?: string; username?: string }>({});
  const [saving, setSaving] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<TempPasswordInfo | null>(null);
  /** Tài khoản đang mở hộp thoại đặt lại mật khẩu */
  const [resetting, setResetting] = useState<StaffAccount | null>(null);

  const users = staff.data ?? [];
  /** Chưa chọn thì lấy bộ phận đầu danh mục làm mặc định */
  const department = form.department || departments[0] || "";
  const roles = rolesRes.data ?? [];

  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  /** Thay bản ghi đã cập nhật ngay tại chỗ, khỏi tải lại cả bảng */
  const replaceUser = (updated: StaffAccount) =>
    staff.setData((prev) => (prev ?? []).map((u) => (u.username === updated.username ? updated : u)));

  const changeRole = async (user: StaffAccount, roleKey: string) => {
    if (roleKey === user.roleKey) return;
    setPendingUser(user.username);
    try {
      const updated = await updateStaff(user.username, { roleKey });
      replaceUser(updated);
      showToast(`Đã đổi vai trò của ${user.displayName} thành "${updated.roleLabel}"`);
    } catch (err) {
      failed(err, "Không đổi được vai trò tài khoản");
    } finally {
      setPendingUser(null);
    }
  };

  const toggleLock = async (user: StaffAccount) => {
    const locking = user.status === "active";
    if (locking && !window.confirm(`Tạm khoá tài khoản ${user.displayName} (${user.username})?`)) return;
    setPendingUser(user.username);
    try {
      const updated = await updateStaff(user.username, { status: locking ? "locked" : "active" });
      replaceUser(updated);
      showToast(
        locking
          ? `Đã tạm khoá tài khoản ${user.displayName} (${user.username})`
          : `Đã mở khoá tài khoản ${user.displayName} (${user.username})`,
      );
    } catch (err) {
      failed(err, "Không đổi được trạng thái tài khoản");
    } finally {
      setPendingUser(null);
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, roleKey: roles[0]?.key ?? "" });
    setErrors({});
    setTempPassword(null);
    setDrawerOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const displayName = form.displayName.trim();
    const username = form.username.trim().toLowerCase();
    const errs: { displayName?: string; username?: string } = {};
    if (!displayName) errs.displayName = "Vui lòng nhập họ tên";
    if (!username) errs.username = "Vui lòng nhập tên tài khoản";
    else if (users.some((u) => u.username === username)) errs.username = "Tên tài khoản đã tồn tại";
    setErrors(errs);
    if (errs.displayName || errs.username) return;

    setSaving(true);
    try {
      const created = await createStaff({
        username,
        displayName,
        department,
        roleKey: form.roleKey || (roles[0]?.key ?? ""),
      });
      const { tempPassword: password, ...account } = created;
      staff.setData((prev) => [...(prev ?? []), account]);
      setTempPassword({ username: account.username, displayName: account.displayName, tempPassword: password });
      showToast(`Đã thêm tài khoản ${displayName} (${username})`);
    } catch (err) {
      failed(err, "Không tạo được tài khoản cán bộ");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Đặt lại mật khẩu cho cán bộ. Mật khẩu mới sinh tại máy khách rồi gửi lên,
   * hiển thị đúng một lần trong hộp thoại để cán bộ quản trị chuyển tận tay —
   * máy chủ chỉ lưu bản băm nên không có cách nào xem lại.
   */
  const resetPassword = async (user: StaffAccount) => {
    const newPassword = generateTempPassword();
    setPendingUser(user.username);
    try {
      await changeStaffPassword(user.username, newPassword);
      setResetting(null);
      setDrawerOpen(true);
      setTempPassword({
        username: user.username,
        displayName: user.displayName,
        tempPassword: newPassword,
      });
      showToast(`Đã đặt lại mật khẩu cho ${user.displayName}`);
    } catch (err) {
      failed(err, "Không đặt lại được mật khẩu");
    } finally {
      setPendingUser(null);
    }
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword.tempPassword);
      showToast("Đã sao chép mật khẩu tạm vào bộ nhớ đệm");
    } catch {
      showToast("Trình duyệt chặn sao chép — vui lòng chọn và sao chép thủ công");
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Tài khoản người dùng"
          extra={
            <button className="btn sm pri" type="button" onClick={openAdd}>
              <Icon name="plus" size={14} />
              Thêm tài khoản
            </button>
          }
        />
        <DataState
          loading={staff.loading}
          error={staff.error}
          onRetry={staff.reload}
          empty={users.length === 0}
          emptyMessage="Chưa có tài khoản cán bộ nào"
        >
          <div className="tw">
            <table className="tb2">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Tài khoản</th>
                  <th>Bộ phận</th>
                  <th>Vai trò</th>
                  <th>Đăng nhập gần nhất</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const active = u.status === "active";
                  const busy = pendingUser === u.username;
                  return (
                    <tr key={u.username} style={{ cursor: "default" }} className={busy ? "saving" : undefined}>
                      <td>
                        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                          <span className="av" style={{ background: u.color }} title={u.displayName}>
                            {u.initials}
                          </span>
                          <span className="tt">{u.displayName}</span>
                        </div>
                      </td>
                      <td>
                        <div>{u.username}</div>
                        <div className="tiny muted">
                          {u.username}@{EMAIL_DOMAIN}
                        </div>
                      </td>
                      <td>{u.department}</td>
                      <td>
                        <select
                          className="finp"
                          style={{ width: 178, padding: "6px 9px", fontSize: 12.5 }}
                          value={u.roleKey}
                          disabled={busy || rolesRes.loading}
                          onChange={(e) => changeRole(u, e.target.value)}
                          aria-label={`Vai trò của ${u.displayName}`}
                        >
                          {roles.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{formatLastLogin(u.lastLoginAt)}</td>
                      <td>
                        {active ? (
                          <Chip color="var(--green)" tint="rgba(39,174,96,.12)">
                            {STATUS_LABEL.active}
                          </Chip>
                        ) : (
                          <Chip color="var(--mut)" tint="rgba(136,150,166,.14)">
                            {STATUS_LABEL.locked}
                          </Chip>
                        )}
                      </td>
                      <td>
                        <button
                          className={active ? "btn sm danger" : "btn sm"}
                          type="button"
                          disabled={busy}
                          title={active ? "Tạm khoá tài khoản" : "Mở khoá tài khoản"}
                          onClick={() => toggleLock(u)}
                        >
                          <Icon name={active ? "lock" : "unlock"} size={13} />
                          {active ? "Khoá" : "Mở khoá"}
                        </button>
                        <button
                          className="btn sm"
                          type="button"
                          disabled={busy}
                          title="Đặt lại mật khẩu và cấp mật khẩu tạm"
                          style={{ marginLeft: 6 }}
                          onClick={() => setResetting(u)}
                        >
                          <Icon name="edit" size={13} />
                          Đặt lại mật khẩu
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      <Drawer
        open={drawerOpen || !!resetting}
        onClose={() => {
          setDrawerOpen(false);
          setResetting(null);
        }}
        title={
          resetting
            ? "Đặt lại mật khẩu"
            : tempPassword
              ? "Mật khẩu tạm"
              : "Thêm tài khoản người dùng"
        }
        meta={
          resetting
            ? `Tài khoản ${resetting.username} sẽ không đăng nhập được bằng mật khẩu cũ`
            : tempPassword
              ? "Mật khẩu tạm chỉ hiển thị một lần duy nhất"
              : "Tài khoản nội bộ dành cho cán bộ, công chức UBND xã"
        }
        footer={
          resetting ? (
            <>
              <button className="btn" type="button" onClick={() => setResetting(null)}>
                Huỷ
              </button>
              <button
                className={pendingUser ? "btn pri saving" : "btn pri danger"}
                type="button"
                disabled={!!pendingUser}
                onClick={() => resetPassword(resetting)}
              >
                <Icon name="edit" size={14} />
                Đặt lại mật khẩu
              </button>
            </>
          ) : tempPassword ? (
            <button className="btn pri" type="button" onClick={() => setDrawerOpen(false)}>
              <Icon name="ok" size={14} />
              Tôi đã lưu mật khẩu
            </button>
          ) : (
            <>
              <button className="btn" type="button" onClick={() => setDrawerOpen(false)}>
                Huỷ
              </button>
              <button
                className={saving ? "btn pri saving" : "btn pri"}
                type="submit"
                form="user-add-form"
                disabled={saving}
              >
                <Icon name="plus" size={14} />
                Thêm tài khoản
              </button>
            </>
          )
        }
      >
        {resetting ? (
          <div className="note">
            Đặt lại mật khẩu cho <b>{resetting.displayName}</b> ({resetting.username}). Mật khẩu cũ
            mất hiệu lực ngay, và mật khẩu mới chỉ hiển thị đúng một lần ở bước sau — hãy chuẩn bị
            sẵn cách bàn giao trực tiếp cho cán bộ trước khi bấm xác nhận.
          </div>
        ) : tempPassword ? (
          <>
            <div className="note" style={{ marginBottom: 16 }}>
              Mật khẩu tạm của <b>{tempPassword.displayName}</b> ({tempPassword.username}) chỉ hiển thị đúng một lần.
              Hãy sao chép và bàn giao trực tiếp cho cán bộ, sau đó yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
            </div>
            <div className="fgroup">
              <label>Mật khẩu tạm</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input className="finp" readOnly value={tempPassword.tempPassword} style={{ flex: 1 }} />
                <button className="btn" type="button" onClick={copyPassword}>
                  <Icon name="file" size={14} />
                  Sao chép
                </button>
              </div>
            </div>
          </>
        ) : (
          <form id="user-add-form" onSubmit={submit}>
            <div className="fgroup">
              <label>
                Họ và tên <span className="req">*</span>
              </label>
              <input
                className={errors.displayName ? "finp err" : "finp"}
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="vd: Nguyễn Văn An"
              />
              {errors.displayName && (
                <div className="tiny" style={{ color: "var(--red)", marginTop: 5 }}>
                  {errors.displayName}
                </div>
              )}
            </div>
            <div className="fgroup">
              <label>
                Tài khoản <span className="req">*</span>
              </label>
              <input
                className={errors.username ? "finp err" : "finp"}
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="vd: an.nv"
              />
              {errors.username && (
                <div className="tiny" style={{ color: "var(--red)", marginTop: 5 }}>
                  {errors.username}
                </div>
              )}
            </div>
            <div className="fgroup">
              <label>Bộ phận</label>
              <select
                className="finp"
                value={department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="fgroup">
              <label>Vai trò</label>
              <select
                className="finp"
                value={form.roleKey}
                onChange={(e) => setForm((f) => ({ ...f, roleKey: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </form>
        )}
      </Drawer>
    </>
  );
}

/** "2026-08-28T03:06:52.077Z" → "28/08/2026 10:06"; chưa đăng nhập lần nào → nhãn rõ ràng */
function formatLastLogin(value?: string): string {
  if (!value) return "Chưa đăng nhập";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
