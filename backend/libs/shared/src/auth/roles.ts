/**
 * Khung phân quyền RBAC — Phase 1 phân quyền theo PHÂN HỆ.
 * Đồng bộ với admin-web/src/config/roles.config.ts (câu hỏi mở #12).
 */
export type Permission = 'view' | 'edit' | 'approve' | 'admin';

export const MODULES = [
  'overview',
  'tasks',
  'documents',
  'disbursement',
  'feedback',
  'map',
  'reports',
  'cms',
  'users',
  'settings',
] as const;

export type ModuleKey = (typeof MODULES)[number];

export interface Role {
  key: string;
  label: string;
  modules: Partial<Record<ModuleKey, Permission>>;
}

const ALL_VIEW = MODULES.reduce<Partial<Record<ModuleKey, Permission>>>((acc, m) => {
  acc[m] = 'view';
  return acc;
}, {});

export const ROLES: Role[] = [
  {
    key: 'admin',
    label: 'Quản trị hệ thống',
    modules: MODULES.reduce<Partial<Record<ModuleKey, Permission>>>((acc, m) => {
      acc[m] = 'admin';
      return acc;
    }, {}),
  },
  {
    key: 'leader',
    label: 'Lãnh đạo phê duyệt',
    modules: { ...ALL_VIEW, tasks: 'approve', documents: 'approve', disbursement: 'approve', feedback: 'approve' },
  },
  {
    key: 'officer',
    label: 'Chuyên viên xử lý',
    modules: { ...ALL_VIEW, tasks: 'edit', documents: 'edit', feedback: 'edit' },
  },
  {
    key: 'accountant',
    label: 'Kế toán – giải ngân',
    modules: { ...ALL_VIEW, disbursement: 'edit' },
  },
  {
    key: 'receptionist',
    label: 'Tiếp nhận một cửa',
    modules: { ...ALL_VIEW, documents: 'edit', feedback: 'edit', users: 'edit' },
  },
];

const PERMISSION_RANK: Record<Permission, number> = { view: 1, edit: 2, approve: 3, admin: 4 };

export function findRole(key: string): Role | undefined {
  return ROLES.find((r) => r.key === key);
}

/** Vai trò có đủ quyền [required] trên phân hệ [module] hay không */
export function hasPermission(roleKey: string, module: ModuleKey, required: Permission): boolean {
  const granted = findRole(roleKey)?.modules[module];
  return !!granted && PERMISSION_RANK[granted] >= PERMISSION_RANK[required];
}
