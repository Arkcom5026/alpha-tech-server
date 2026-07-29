const fs = require('fs');
const path = require('path');

describe('auth employee onboarding slice', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  const routes = read('src/modules/auth/routes/authRoutes.js');
  const controller = read('src/modules/auth/employee-onboarding/employeeOnboardingController.js');
  const service = read('src/modules/auth/employee-onboarding/employeeOnboardingService.js');
  const repository = read('src/modules/auth/employee-onboarding/employeeOnboardingRepository.js');

  test('canonical route uses the feature-owned onboarding controller', () => {
    expect(routes).toContain("require('../employee-onboarding/employeeOnboardingController')");
    expect(routes).toContain(
      "router.post('/add-sub-employee', verifyToken, employeeOnboardingController.addSubEmployee)",
    );
    expect(routes).not.toContain("require('../../../../controllers/employeeOnboardingController')");
  });

  test('controller preserves actor authority, branch authority and validation contracts', () => {
    expect(controller).toContain("systemRole === 'SUPERADMIN'");
    expect(controller).toContain("systemRole === 'ADMIN'");
    expect(controller).toContain("employeeRole === 'OWNER'");
    expect(controller).toContain("employeeRole === 'MANAGER'");
    expect(controller).toContain("actor.branchId || actor.employeeProfile?.branchId");
    expect(controller).toContain("code: 'EMPLOYEE_ONBOARDING_FORBIDDEN'");
    expect(controller).toContain("code: 'EMPLOYEE_ONBOARDING_BRANCH_REQUIRED'");
    expect(controller).toContain("code: 'EMPLOYEE_ONBOARDING_FIELDS_REQUIRED'");
    expect(controller).toContain("code: 'EMPLOYEE_PASSWORD_TOO_SHORT'");
    expect(controller).toContain("code: 'EMPLOYEE_STORE_ROLE_INVALID'");
    expect(controller).toContain("code: 'EMPLOYEE_EMAIL_ALREADY_EXISTS'");
    expect(controller).toContain("code: 'EMPLOYEE_POSITION_NOT_FOUND'");
  });

  test('service preserves duplicate checks, password hashing and response projection', () => {
    expect(service).toContain('Promise.all');
    expect(service).toContain('bcryptHash(password, 10)');
    expect(service).toContain("return { conflict: 'EMAIL' }");
    expect(service).toContain("return { invalid: 'POSITION' }");
    expect(service).toContain('employeeId: created.employeeProfile.id');
    expect(service).toContain('position: created.employeeProfile.position');
    expect(service).toContain('branch: created.employeeProfile.branch');
    expect(service).toContain('approved: created.employeeProfile.approved');
    expect(service).toContain('active: created.employeeProfile.active');
    expect(service).toContain('enabled: created.user.enabled');
  });

  test('repository owns the complete atomic dual-profile creation', () => {
    expect(repository).toContain('prisma.$transaction');
    expect(repository).toContain('tx.user.create');
    expect(repository).toContain("role: 'EMPLOYEE'");
    expect(repository).toContain("loginType: 'EMAIL'");
    expect(repository).toContain('tx.employeeProfile.create');
    expect(repository).toContain('branchId');
    expect(repository).toContain('positionId');
    expect(repository).toContain('approved: true');
    expect(repository).toContain('active: true');
    expect(repository).toContain('include: { position: true, branch: true }');
    expect(repository).toContain('tx.customerProfile.create');
    expect(repository).toContain("type: 'INDIVIDUAL'");
  });
});
