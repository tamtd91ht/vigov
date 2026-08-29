/**
 * Khung phân quyền RBAC — Phase 1 phân quyền theo PHÂN HỆ.
 * (Câu hỏi mở #12: phân quyền theo hành động — chờ khách xác nhận.)
 */

export type Permission = "view" | "edit" | "approve" | "admin";

export interface Role {
  key: string;
  label: string;
  /** moduleKey (nav.config) -> quyền tối đa trên phân hệ đó */
  modules: Record<string, Permission>;
}

const ALL_VIEW: Record<string, Permission> = {
  overview: "view", tasks: "view", documents: "view", disbursement: "view",
  feedback: "view", map: "view", reports: "view", cms: "view", users: "view", settings: "view",
};

export const roles: Role[] = [
  {
    key: "admin",
    label: "Quản trị hệ thống",
    modules: { ...ALL_VIEW, overview: "admin", tasks: "admin", documents: "admin", disbursement: "admin", feedback: "admin", map: "admin", reports: "admin", cms: "admin", users: "admin", settings: "admin" },
  },
  {
    key: "leader",
    label: "Lãnh đạo phê duyệt",
    modules: { ...ALL_VIEW, tasks: "approve", documents: "approve", disbursement: "approve", feedback: "approve", reports: "view" },
  },
  {
    key: "officer",
    label: "Chuyên viên xử lý",
    modules: { ...ALL_VIEW, tasks: "edit", documents: "edit", feedback: "edit" },
  },
  {
    key: "accountant",
    label: "Kế toán – giải ngân",
    modules: { ...ALL_VIEW, disbursement: "edit", reports: "view" },
  },
  {
    key: "receptionist",
    label: "Tiếp nhận một cửa",
    modules: { ...ALL_VIEW, documents: "edit", feedback: "edit", users: "edit" },
  },
];

export function findRole(key: string): Role | undefined {
  return roles.find((r) => r.key === key);
}

export function canAccess(roleKey: string, moduleKey: string): boolean {
  const role = findRole(roleKey);
  return !!role && moduleKey in role.modules;
}
