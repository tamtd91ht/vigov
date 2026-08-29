import { MODULES, ROLES, findRole, hasPermission, type ModuleKey, type Permission } from './roles';

/**
 * Bảng phân quyền RBAC là nơi một sai sót nhỏ mở toang cả phân hệ, nên test ở
 * đây liệt kê tường minh từng cặp (vai trò × phân hệ) thay vì suy ra từ chính
 * bảng ROLES — nếu ai đó sửa bảng, test phải đỏ chứ không được "tự đúng theo".
 */
describe('roles — hasPermission', () => {
  it('có đủ 5 vai trò nghiệp vụ và khoá vai trò là duy nhất', () => {
    const keys = ROLES.map((r) => r.key);
    expect(keys).toEqual(['admin', 'leader', 'officer', 'accountant', 'receptionist']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe('admin — quản trị hệ thống', () => {
    it.each(MODULES)('có quyền admin trên phân hệ %s', (module) => {
      expect(hasPermission('admin', module, 'admin')).toBe(true);
      expect(hasPermission('admin', module, 'approve')).toBe(true);
      expect(hasPermission('admin', module, 'edit')).toBe(true);
      expect(hasPermission('admin', module, 'view')).toBe(true);
    });
  });

  describe('leader — lãnh đạo phê duyệt', () => {
    it('duyệt được nhiệm vụ, văn bản, giải ngân, phản ánh', () => {
      expect(hasPermission('leader', 'tasks', 'approve')).toBe(true);
      expect(hasPermission('leader', 'documents', 'approve')).toBe(true);
      expect(hasPermission('leader', 'disbursement', 'approve')).toBe(true);
      expect(hasPermission('leader', 'feedback', 'approve')).toBe(true);
    });

    it('không có quyền quản trị dù được duyệt', () => {
      expect(hasPermission('leader', 'tasks', 'admin')).toBe(false);
      expect(hasPermission('leader', 'settings', 'admin')).toBe(false);
    });

    it('chỉ xem được phân hệ Người dùng và Cấu hình', () => {
      expect(hasPermission('leader', 'users', 'view')).toBe(true);
      expect(hasPermission('leader', 'users', 'edit')).toBe(false);
      expect(hasPermission('leader', 'settings', 'view')).toBe(true);
      expect(hasPermission('leader', 'settings', 'edit')).toBe(false);
    });
  });

  describe('officer — chuyên viên xử lý', () => {
    it('sửa được nhiệm vụ, văn bản, phản ánh', () => {
      expect(hasPermission('officer', 'tasks', 'edit')).toBe(true);
      expect(hasPermission('officer', 'documents', 'edit')).toBe(true);
      expect(hasPermission('officer', 'feedback', 'edit')).toBe(true);
    });

    it('KHÔNG được phê duyệt — quyền đó dành cho lãnh đạo', () => {
      expect(hasPermission('officer', 'tasks', 'approve')).toBe(false);
      expect(hasPermission('officer', 'documents', 'approve')).toBe(false);
      expect(hasPermission('officer', 'feedback', 'approve')).toBe(false);
    });

    it('KHÔNG được ghi vào phân hệ Giải ngân và Người dùng', () => {
      expect(hasPermission('officer', 'disbursement', 'view')).toBe(true);
      expect(hasPermission('officer', 'disbursement', 'edit')).toBe(false);
      expect(hasPermission('officer', 'users', 'edit')).toBe(false);
    });
  });

  describe('accountant — kế toán giải ngân', () => {
    it('sửa được phân hệ Giải ngân', () => {
      expect(hasPermission('accountant', 'disbursement', 'edit')).toBe(true);
      expect(hasPermission('accountant', 'disbursement', 'view')).toBe(true);
    });

    it('KHÔNG tạo/sửa được nhiệm vụ, văn bản, phản ánh (chỉ xem)', () => {
      expect(hasPermission('accountant', 'tasks', 'view')).toBe(true);
      expect(hasPermission('accountant', 'tasks', 'edit')).toBe(false);
      expect(hasPermission('accountant', 'documents', 'edit')).toBe(false);
      expect(hasPermission('accountant', 'feedback', 'edit')).toBe(false);
    });

    it('KHÔNG được duyệt giải ngân dù được sửa', () => {
      expect(hasPermission('accountant', 'disbursement', 'approve')).toBe(false);
      expect(hasPermission('accountant', 'disbursement', 'admin')).toBe(false);
    });
  });

  describe('receptionist — tiếp nhận một cửa', () => {
    it('sửa được văn bản, phản ánh và hồ sơ người dùng', () => {
      expect(hasPermission('receptionist', 'documents', 'edit')).toBe(true);
      expect(hasPermission('receptionist', 'feedback', 'edit')).toBe(true);
      expect(hasPermission('receptionist', 'users', 'edit')).toBe(true);
    });

    it('KHÔNG sửa được nhiệm vụ và giải ngân', () => {
      expect(hasPermission('receptionist', 'tasks', 'edit')).toBe(false);
      expect(hasPermission('receptionist', 'disbursement', 'edit')).toBe(false);
    });
  });

  describe('thứ bậc quyền view < edit < approve < admin', () => {
    const lowerLevels: Record<Permission, Permission[]> = {
      view: [],
      edit: ['view'],
      approve: ['view', 'edit'],
      admin: ['view', 'edit', 'approve'],
    };

    it('quyền cao luôn bao hàm mọi quyền thấp hơn trên cùng phân hệ', () => {
      for (const role of ROLES) {
        for (const [module, granted] of Object.entries(role.modules) as [ModuleKey, Permission][]) {
          for (const lower of lowerLevels[granted]) {
            expect(hasPermission(role.key, module, lower)).toBe(true);
          }
        }
      }
    });
  });

  describe('vai trò lạ / không tồn tại', () => {
    it.each(['citizen', '', 'ADMIN', 'super-admin'])('vai trò "%s" không có quyền nào', (roleKey) => {
      for (const module of MODULES) {
        expect(hasPermission(roleKey, module, 'view')).toBe(false);
        expect(hasPermission(roleKey, module, 'edit')).toBe(false);
      }
    });
  });

  describe('findRole', () => {
    it('trả về đúng bản ghi vai trò theo khoá', () => {
      expect(findRole('accountant')?.label).toBe('Kế toán – giải ngân');
    });

    it('trả undefined khi không có vai trò', () => {
      expect(findRole('khong-ton-tai')).toBeUndefined();
    });
  });
});
