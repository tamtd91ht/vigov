import { apiClient } from "./api";
import { appConfig } from "@/config/app.config";
import { defaultSlaRules, type SlaRule } from "@/config/sla.config";
import { roles as mockRoles } from "@/config/roles.config";
import { orgTree as mockOrgTree } from "@/mocks/settings";
import type { OrgNode } from "@/types";

/**
 * Phân hệ Cấu hình (WBS #9) — SLA, cây tổ chức, danh mục vai trò.
 * Đường lui mock đặt tại đây; component chỉ gọi hàm, không biết nguồn dữ liệu.
 */

/** Bảng SLA hiện hành; `isDefault` = chưa lưu lần nào, đang dùng bộ mặc định */
export interface SlaSettings {
  rules: SlaRule[];
  isDefault: boolean;
}

/** Một đơn vị trong cây tổ chức (backend trả cây lồng nhau qua parentId) */
export interface OrgTreeNode {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  parentId?: string;
  order: number;
  children: OrgTreeNode[];
}

export interface OrgTreeResponse {
  tree: OrgTreeNode[];
  total: number;
}

/** Trường được phép gửi khi thêm / sửa một đơn vị */
export interface OrgNodeInput {
  name?: string;
  subtitle?: string;
  color?: string;
  parentId?: string;
  order?: number;
}

/** Vai trò RBAC phục vụ dropdown phân quyền */
export interface RoleOption {
  key: string;
  label: string;
  modules: Record<string, string>;
}

/** Độ trễ giả lập cho chế độ mock để giao diện thể hiện trạng thái tải */
function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

/** Dựng cây mock có id để thao tác sửa/xoá vẫn chạy khi chưa nối backend */
function toMockTree(node: OrgNode, path: string, order: number, parentId?: string): OrgTreeNode {
  return {
    id: path,
    name: node.name,
    subtitle: node.subtitle,
    color: node.color,
    parentId,
    order,
    children: (node.children ?? []).map((child, i) => toMockTree(child, `${path}.${i}`, i, path)),
  };
}

// ─── SLA ───────────────────────────────────────────────────────────────────

/** GET /settings/sla */
export async function fetchSlaSettings(): Promise<SlaSettings> {
  if (appConfig.api.useMocks) {
    return mockDelay({ rules: defaultSlaRules.map((r) => ({ ...r })), isDefault: true });
  }
  return apiClient.get<SlaSettings>("/settings/sla");
}

/** PUT /settings/sla — lưu cả bảng, backend upsert theo categoryKey */
export async function saveSlaSettings(rules: SlaRule[]): Promise<SlaSettings> {
  if (appConfig.api.useMocks) {
    return mockDelay({ rules: rules.map((r) => ({ ...r })), isDefault: false });
  }
  return apiClient.put<SlaSettings>("/settings/sla", { rules });
}

/** POST /settings/sla/reset — khôi phục bộ SLA mặc định */
export async function resetSlaSettings(): Promise<SlaSettings> {
  if (appConfig.api.useMocks) {
    return mockDelay({ rules: defaultSlaRules.map((r) => ({ ...r })), isDefault: true });
  }
  return apiClient.post<SlaSettings>("/settings/sla/reset");
}

// ─── Cây tổ chức ───────────────────────────────────────────────────────────

/** GET /settings/org */
export async function fetchOrgTree(): Promise<OrgTreeResponse> {
  if (appConfig.api.useMocks) {
    const tree = [toMockTree(mockOrgTree, "org-0", 0)];
    const count = (nodes: OrgTreeNode[]): number =>
      nodes.reduce((sum, n) => sum + 1 + count(n.children), 0);
    return mockDelay({ tree, total: count(tree) });
  }
  return apiClient.get<OrgTreeResponse>("/settings/org");
}

/** POST /settings/org */
export async function createOrgNode(input: OrgNodeInput): Promise<Omit<OrgTreeNode, "children">> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      id: `org-new-${Date.now()}`,
      name: input.name ?? "",
      subtitle: input.subtitle ?? "",
      color: input.color ?? "var(--blue)",
      parentId: input.parentId,
      order: input.order ?? 0,
    });
  }
  return apiClient.post<Omit<OrgTreeNode, "children">>("/settings/org", input);
}

/** PATCH /settings/org/:id */
export async function updateOrgNode(id: string, input: OrgNodeInput): Promise<Omit<OrgTreeNode, "children">> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      id,
      name: input.name ?? "",
      subtitle: input.subtitle ?? "",
      color: input.color ?? "var(--blue)",
      parentId: input.parentId,
      order: input.order ?? 0,
    });
  }
  return apiClient.patch<Omit<OrgTreeNode, "children">>(`/settings/org/${encodeURIComponent(id)}`, input);
}

/** DELETE /settings/org/:id — backend chặn xoá khi còn đơn vị trực thuộc */
export async function deleteOrgNode(id: string): Promise<{ id: string; deleted: boolean }> {
  if (appConfig.api.useMocks) return mockDelay({ id, deleted: true });
  return apiClient.delete<{ id: string; deleted: boolean }>(`/settings/org/${encodeURIComponent(id)}`);
}

// ─── Vai trò ───────────────────────────────────────────────────────────────

/** GET /settings/roles — danh mục vai trò cho dropdown phân quyền */
export async function fetchRoles(): Promise<RoleOption[]> {
  if (appConfig.api.useMocks) {
    return mockDelay(mockRoles.map((r) => ({ key: r.key, label: r.label, modules: { ...r.modules } })));
  }
  const res = await apiClient.get<{ roles: RoleOption[] }>("/settings/roles");
  return res.roles;
}
