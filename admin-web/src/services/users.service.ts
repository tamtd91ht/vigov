import { apiClient, buildQuery, type Paged } from "./api";
import { appConfig } from "@/config/app.config";
import { blacklistRecords, citizenUsers, loginSessions } from "@/mocks/users";
import { internalUsers } from "@/mocks/settings";
import { findRole, roles as staticRoles } from "@/config/roles.config";

/**
 * Phân hệ Người dùng Mini App & bảo mật (WBS #11) + tài khoản cán bộ phục vụ
 * tab "Tài khoản & phân quyền" của trang Cấu hình.
 *
 * Số điện thoại công dân do backend che sẵn ("098•••321"); phía web không bao
 * giờ nhận số đầy đủ.
 */

export type AccountStatus = "active" | "locked";

/** Tài khoản công dân dùng Mini App / app Flutter */
export interface CitizenAccount {
  id: string;
  /** Đã che theo quy định bảo vệ dữ liệu cá nhân */
  phone: string;
  displayName: string;
  area: string;
  channel: string;
  feedbackCount: number;
  status: AccountStatus;
  lockReason?: string;
}

export interface CitizenQuery {
  q?: string;
  area?: string;
  status?: AccountStatus;
  page?: number;
  limit?: number;
}

/** Kênh đăng nhập backend phân biệt: web (cán bộ), app / zalo (công dân) */
export type SessionKind = "web" | "app" | "zalo";

export interface SessionRecord {
  id: string;
  /** Tên đăng nhập cán bộ, hoặc số điện thoại đã che với phiên công dân */
  subject: string;
  kind: SessionKind;
  device: string;
  ip: string;
  startedAt: string;
  lastActiveAt: string;
}

export type BlacklistKind = "citizen" | "device" | "ip";

export interface BlacklistItem {
  id: string;
  subject: string;
  kind: BlacklistKind;
  reason: string;
  by: string;
  active: boolean;
}

export interface BlacklistQuery {
  active?: boolean;
  kind?: BlacklistKind;
}

/** Tài khoản cán bộ — backend không bao giờ trả passwordHash */
export interface StaffAccount {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  color: string;
  department: string;
  roleKey: string;
  roleLabel: string;
  status: AccountStatus;
  lastLoginAt?: string;
}

export interface CreateStaffInput {
  username: string;
  displayName: string;
  department: string;
  roleKey: string;
}

/** Mật khẩu tạm chỉ xuất hiện MỘT LẦN trong phản hồi tạo tài khoản */
export interface CreatedStaff extends StaffAccount {
  tempPassword: string;
}

export interface UpdateStaffInput {
  roleKey?: string;
  department?: string;
  status?: AccountStatus;
}

interface ListResponse<T> {
  items: T[];
  total: number;
}

function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

// ─── Công dân ──────────────────────────────────────────────────────────────

/** GET /users/citizens */
export async function listCitizens(query: CitizenQuery = {}): Promise<Paged<CitizenAccount>> {
  if (appConfig.api.useMocks) {
    const items = citizenUsers
      .filter((c) => (!query.area || c.area === query.area) && (!query.status || c.status === query.status))
      .filter((c) => !query.q || c.zaloName.toLowerCase().includes(query.q.toLowerCase()))
      .map<CitizenAccount>((c) => ({
        id: c.id,
        phone: c.phoneMasked,
        displayName: c.zaloName,
        area: c.area,
        channel: "zalo",
        feedbackCount: c.feedbackCount,
        status: c.status,
        lockReason: c.lockReason,
      }));
    return mockDelay({ items, total: items.length, page: query.page ?? 1, limit: query.limit ?? items.length });
  }
  return apiClient.get<Paged<CitizenAccount>>(`/users/citizens${buildQuery({ ...query })}`);
}

/** Thống kê tài khoản công dân cho 3 thẻ KPI đầu trang */
export interface CitizenStats {
  total: number;
  /** Số công dân có phiên hoạt động trong cửa sổ `windowDays` gần nhất */
  activeLast30Days: number;
  locked: number;
  /** Cửa sổ thống kê máy chủ đang áp dụng, để giao diện hiển thị đúng nhãn */
  windowDays: number;
}

/**
 * GET /users/citizens/stats — máy chủ đếm sẵn cả ba con số.
 * Trước đây giao diện gọi `listCitizens` hai lần chỉ để lấy `total`, và không
 * có cách nào đếm người hoạt động vì thông tin phiên không nằm trong danh sách.
 */
export async function fetchCitizenStats(): Promise<CitizenStats> {
  return apiClient.get<CitizenStats>("/users/citizens/stats");
}

/**
 * PATCH /users/citizens/id/:id/lock
 *
 * Tra theo `id`, KHÔNG theo số điện thoại: danh sách trả SĐT đã che
 * ("098•••321") theo quy định bảo vệ dữ liệu cá nhân, nên số đó không tra
 * ngược được — gửi lên sẽ nhận 404. Số đã che cũng có thể trùng nhau giữa hai
 * công dân khác nhau.
 */
export async function lockCitizen(id: string, reason: string): Promise<CitizenAccount> {
  if (appConfig.api.useMocks) {
    const found = citizenUsers.find((c) => c.id === id);
    return mockDelay({
      id,
      phone: found?.phoneMasked ?? "",
      displayName: found?.zaloName ?? "",
      area: found?.area ?? "",
      channel: "zalo",
      feedbackCount: found?.feedbackCount ?? 0,
      status: "locked",
      lockReason: reason,
    });
  }
  return apiClient.patch<CitizenAccount>(`/users/citizens/id/${encodeURIComponent(id)}/lock`, {
    reason,
  });
}

/** PATCH /users/citizens/id/:id/unlock — gỡ luôn bản ghi chặn tương ứng */
export async function unlockCitizen(id: string): Promise<CitizenAccount> {
  if (appConfig.api.useMocks) {
    const found = citizenUsers.find((c) => c.id === id);
    return mockDelay({
      id,
      phone: found?.phoneMasked ?? "",
      displayName: found?.zaloName ?? "",
      area: found?.area ?? "",
      channel: "zalo",
      feedbackCount: found?.feedbackCount ?? 0,
      status: "active",
    });
  }
  return apiClient.patch<CitizenAccount>(`/users/citizens/id/${encodeURIComponent(id)}/unlock`);
}

// ─── Phiên đăng nhập ───────────────────────────────────────────────────────

/** GET /users/sessions?kind= */
export async function listSessions(kind: SessionKind): Promise<ListResponse<SessionRecord>> {
  if (appConfig.api.useMocks) {
    const items = loginSessions
      .filter((s) => (kind === "web" ? s.kind === "web" : s.kind === "miniapp"))
      .map<SessionRecord>((s) => ({
        id: s.id,
        subject: s.userName,
        kind,
        device: s.device,
        ip: s.ip,
        startedAt: s.startedAt,
        lastActiveAt: s.lastActiveAt,
      }));
    return mockDelay({ items, total: items.length });
  }
  return apiClient.get<ListResponse<SessionRecord>>(`/users/sessions${buildQuery({ kind })}`);
}

/** Kênh công dân gồm cả app Flutter và Zalo Mini App — gộp hai lời gọi */
export async function listCitizenSessions(): Promise<ListResponse<SessionRecord>> {
  const [app, zalo] = await Promise.all([listSessions("app"), listSessions("zalo")]);
  const items = [...app.items, ...zalo.items].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  return { items, total: items.length };
}

/** DELETE /users/sessions/:id */
export async function revokeSession(id: string): Promise<void> {
  if (appConfig.api.useMocks) {
    await mockDelay(null);
    return;
  }
  await apiClient.delete<{ id: string; revoked: boolean }>(`/users/sessions/${encodeURIComponent(id)}`);
}

/** DELETE /users/sessions/revoke-others — chỉ thu hồi phiên của CHÍNH người đang đăng nhập */
export async function revokeOtherSessions(except?: string): Promise<{ revoked: number }> {
  if (appConfig.api.useMocks) return mockDelay({ revoked: 0 });
  return apiClient.delete<{ revoked: number }>(`/users/sessions/revoke-others${buildQuery({ except })}`);
}

// ─── Danh sách chặn ────────────────────────────────────────────────────────

/** GET /users/blacklist */
export async function listBlacklist(query: BlacklistQuery = {}): Promise<ListResponse<BlacklistItem>> {
  if (appConfig.api.useMocks) {
    const items = blacklistRecords
      .filter((r) => (query.active === undefined || r.active === query.active) && (!query.kind || r.kind === query.kind))
      .map<BlacklistItem>((r) => ({
        id: r.id,
        subject: r.subject,
        kind: r.kind,
        reason: r.reason,
        by: r.by,
        active: r.active,
      }));
    return mockDelay({ items, total: items.length });
  }
  return apiClient.get<ListResponse<BlacklistItem>>(
    `/users/blacklist${buildQuery({ active: query.active, kind: query.kind })}`,
  );
}

/** POST /users/blacklist */
export async function createBlacklist(input: {
  subject: string;
  kind: BlacklistKind;
  reason: string;
}): Promise<BlacklistItem> {
  if (appConfig.api.useMocks) {
    return mockDelay({ id: `BL-NEW-${Date.now()}`, by: "", active: true, ...input });
  }
  return apiClient.post<BlacklistItem>("/users/blacklist", input);
}

/** PATCH /users/blacklist/:id/deactivate — gỡ hiệu lực bản ghi chặn */
export async function deactivateBlacklist(id: string): Promise<{ id: string; active: boolean }> {
  if (appConfig.api.useMocks) return mockDelay({ id, active: false });
  return apiClient.patch<{ id: string; active: boolean }>(
    `/users/blacklist/${encodeURIComponent(id)}/deactivate`,
  );
}

// ─── Tài khoản cán bộ ──────────────────────────────────────────────────────

/** GET /users/staff — nguồn dữ liệu tab "Tài khoản & phân quyền" */
export async function listStaff(): Promise<StaffAccount[]> {
  if (appConfig.api.useMocks) {
    const items = internalUsers.map<StaffAccount>((u) => ({
      id: u.username,
      username: u.username,
      displayName: u.name,
      initials: u.initials,
      color: u.color,
      department: u.department,
      roleKey: staticRoles.find((r) => r.label === u.roleLabel)?.key ?? "officer",
      roleLabel: u.roleLabel,
      status: u.status === "Tạm khoá" ? "locked" : "active",
      lastLoginAt: u.lastLogin,
    }));
    return mockDelay(items);
  }
  const res = await apiClient.get<ListResponse<StaffAccount>>("/users/staff");
  return res.items;
}

/** POST /users/staff — `tempPassword` trong phản hồi chỉ hiện đúng một lần */
export async function createStaff(input: CreateStaffInput): Promise<CreatedStaff> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      id: input.username,
      username: input.username,
      displayName: input.displayName,
      initials: input.displayName.slice(0, 2).toUpperCase(),
      color: "var(--blue)",
      department: input.department,
      roleKey: input.roleKey,
      roleLabel: findRole(input.roleKey)?.label ?? input.roleKey,
      status: "active",
      tempPassword: "MatKhauTam123",
    });
  }
  return apiClient.post<CreatedStaff>("/users/staff", input);
}

/** PATCH /users/staff/:username — đổi vai trò / đơn vị / trạng thái */
export async function updateStaff(username: string, input: UpdateStaffInput): Promise<StaffAccount> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      id: username,
      username,
      displayName: username,
      initials: username.slice(0, 2).toUpperCase(),
      color: "var(--blue)",
      department: input.department ?? "",
      roleKey: input.roleKey ?? "officer",
      roleLabel: findRole(input.roleKey ?? "officer")?.label ?? "",
      status: input.status ?? "active",
    });
  }
  return apiClient.patch<StaffAccount>(`/users/staff/${encodeURIComponent(username)}`, input);
}

/** PATCH /users/staff/:username/password — đặt lại mật khẩu cán bộ */
export async function changeStaffPassword(username: string, newPassword: string): Promise<void> {
  if (appConfig.api.useMocks) {
    await mockDelay(null);
    return;
  }
  await apiClient.patch<{ username: string; updated: boolean }>(
    `/users/staff/${encodeURIComponent(username)}/password`,
    { newPassword },
  );
}
