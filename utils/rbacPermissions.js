// ✅ utils/rbacPermissions.js

export const permissionsByPosition = {
    'ผู้จัดการ': ['dashboard', 'sales', 'purchases', 'stock', 'reports', 'employees'],
    'พนักงานขาย': ['dashboard', 'sales'],
    'พนักงานคลัง': ['dashboard', 'stock'],
    'ช่างเทคนิค': ['dashboard', 'services'],
    'บัญชี': ['dashboard', 'reports'],
  };
  