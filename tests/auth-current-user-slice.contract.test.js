const fs = require('fs');
const path = require('path');

describe('auth current-user and user-lookup slices', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  const routes = read('src/modules/auth/routes/authRoutes.js');
  const currentUserController = read('src/modules/auth/current-user/currentUserController.js');
  const currentUserService = read('src/modules/auth/current-user/currentUserService.js');
  const currentUserRepository = read('src/modules/auth/current-user/currentUserRepository.js');
  const userLookupController = read('src/modules/auth/user-lookup/userLookupController.js');
  const userLookupService = read('src/modules/auth/user-lookup/userLookupService.js');
  const userLookupRepository = read('src/modules/auth/user-lookup/userLookupRepository.js');

  test('canonical routes use feature-owned handlers and no longer import root authController', () => {
    expect(routes).toContain("require('../current-user/currentUserController')");
    expect(routes).toContain("require('../user-lookup/userLookupController')");
    expect(routes).toContain("router.get('/me', verifyToken, currentUserController.getMe)");
    expect(routes).toContain("router.get('/users/find', verifyToken, userLookupController.findUserByEmail)");
    expect(routes).not.toContain("require('../../../../controllers/authController')");
    expect(routes).not.toContain('ensureLegacyFn');
    expect(routes).not.toContain('resolveLegacyHandler');
  });

  test('current-user slice preserves authorization and response projection', () => {
    expect(currentUserController).toContain("req.user?.id");
    expect(currentUserController).toContain("status(401).json({ message: 'Unauthorized' })");
    expect(currentUserController).toContain("status(404).json({ message: 'User or EmployeeProfile not found' })");
    expect(currentUserController).toContain("status(500).json({ message: 'Failed to verify session' })");
    expect(currentUserService).toContain("profileType: 'employee'");
    expect(currentUserService).toContain('branchId: profile.branchId || null');
    expect(currentUserService).toContain('position: profile.position || null');
    expect(currentUserRepository).toContain('employeeProfile: { include: { branch: true, position: true } }');
  });

  test('user lookup preserves validation, not-found behavior and projection', () => {
    expect(userLookupController).toContain("normalizeEmail(req.query?.email)");
    expect(userLookupController).toContain("status(400).json({ message: 'กรุณาระบุอีเมล' })");
    expect(userLookupController).toContain("status(404).json({ message: 'ไม่พบผู้ใช้อีเมลนี้' })");
    expect(userLookupController).toContain("status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' })");
    expect(userLookupService).toContain("name: user.customerProfile?.name || ''");
    expect(userLookupService).toContain("phone: user.customerProfile?.phone || ''");
    expect(userLookupService).toContain('alreadyEmployee: !!user.employeeProfile');
    expect(userLookupRepository).toContain('include: { customerProfile: true, employeeProfile: true }');
  });
});
