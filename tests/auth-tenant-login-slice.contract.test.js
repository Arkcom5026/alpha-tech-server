const fs = require('fs');
const path = require('path');

describe('auth tenant-login slice', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  const routes = read('src/modules/auth/routes/authRoutes.js');
  const controller = read('src/modules/auth/tenant-login/tenantLoginController.js');
  const service = read('src/modules/auth/tenant-login/tenantLoginService.js');
  const repository = read('src/modules/auth/tenant-login/tenantLoginRepository.js');

  test('tenant route uses feature-owned controller and tenant context', () => {
    expect(routes).toContain("require('../tenant-login/tenantLoginController')");
    expect(routes).toContain("router.post('/:tenant_slug/auth/login', tenantContext, tenantLoginController.login)");
    expect(routes).not.toContain("require('../controllers/authController')");
  });

  test('tenant identity is reconciled to User and EmployeeProfile', () => {
    expect(repository).toContain('prisma.user.findUnique');
    expect(repository).toContain('employeeProfile:');
    expect(repository).toContain('branch: true');
    expect(service).not.toContain('prisma.employee');
    expect(service).not.toContain('passwordHash');
    expect(service).toContain('bcryptCompare(password, user.password)');
  });

  test('tenant isolation and account policies remain explicit', () => {
    expect(service).toContain('profile.branch.slug !== tenantSlug');
    expect(service).toContain("error: 'TENANT_FORBIDDEN'");
    expect(service).toContain('!user.enabled');
    expect(service).toContain('profile.active === false');
    expect(controller).toContain('status(401)');
    expect(controller).toContain('status(403)');
  });

  test('tenant response and token contract remain available', () => {
    expect(controller).toContain("message: 'การเข้าสู่ระบบและระบุสาขาสำเร็จ'");
    expect(controller).toContain('success: true');
    expect(service).toContain('buildAccessToken(user');
    expect(service).toContain('tenantSlug: profile.branch.slug');
    expect(service).toContain('employee: {');
    expect(service).toContain('branch: {');
  });
});
