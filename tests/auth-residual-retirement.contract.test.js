const fs = require('fs');
const path = require('path');

describe('auth residual retirement', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('server mounts only the canonical auth module route', () => {
    const server = read('server.js');
    expect(server).toContain("require('./src/modules/auth/routes/authRoutes')");
    expect(server).toContain("app.use('/api/auth', authRoutes)");
    expect(server).not.toContain("require('./routes/authRoutes')");
    expect(server).not.toContain("require('./routes/loginEmployee')");
    expect(server).not.toContain("require('./routes/currentEmployeeRoutes')");
  });

  test('obsolete root and tenant auth runtime files stay retired', () => {
    const retiredPaths = [
      'routes/authRoutes.js',
      'routes/loginEmployee.js',
      'routes/currentEmployeeRoutes.js',
      'controllers/authController.js',
      'controllers/employeeOnboardingController.js',
      'src/modules/auth/controllers/authController.js',
      'src/modules/auth/services/authService.js',
    ];

    for (const retiredPath of retiredPaths) {
      expect(exists(retiredPath)).toBe(false);
    }
  });

  test('canonical auth route owns every active auth endpoint', () => {
    const routes = read('src/modules/auth/routes/authRoutes.js');
    const expectedOwners = [
      '../login/loginController',
      '../registration/registrationController',
      '../session/sessionController',
      '../password/passwordController',
      '../current-user/currentUserController',
      '../user-lookup/userLookupController',
      '../employee-onboarding/employeeOnboardingController',
      '../tenant-login/tenantLoginController',
    ];

    for (const owner of expectedOwners) {
      expect(routes).toContain(`require('${owner}')`);
    }

    expect(routes).not.toContain('../../../../controllers/authController');
    expect(routes).not.toContain('../../../../controllers/employeeOnboardingController');
    expect(routes).not.toContain('../controllers/authController');
  });
});
