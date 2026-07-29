const fs = require('fs');
const path = require('path');

describe('auth runtime module ownership', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const moduleRoutes = fs.readFileSync(
    path.join(root, 'src/modules/auth/routes/authRuntimeRoutes.js'),
    'utf8',
  );

  test('server mounts /api/auth from the module-owned runtime route', () => {
    expect(server).toContain("require('./src/modules/auth/routes/authRuntimeRoutes')");
    expect(server).not.toContain("require('./routes/authRoutes')");
    expect(server).toContain("app.use('/api/auth', authRoutes)");
  });

  test('module route preserves the existing auth endpoint surface', () => {
    const expectedRoutes = [
      "router.post('/login'",
      "router.post('/register'",
      "router.post('/refresh'",
      "router.post('/logout'",
      "router.post('/add-sub-employee'",
      "router.post('/logout-all'",
      "router.get('/users/find'",
      "router.get('/me'",
      "router.post('/forgot-password'",
      "router.post('/reset-password'",
    ];

    for (const route of expectedRoutes) {
      expect(moduleRoutes).toContain(route);
    }
  });

  test('module route preserves auth middleware and refresh-cookie transport', () => {
    expect(moduleRoutes).toContain("require('../../../../middlewares/verifyToken')");
    expect(moduleRoutes).toContain("require('../../../../middlewares/authTrace')");
    expect(moduleRoutes).toContain("path: '/api/auth'");
    expect(moduleRoutes).toContain("sameSite: isProduction ? 'none' : 'lax'");
    expect(moduleRoutes).toContain('httpOnly: true');
  });

  test('module route remains a compatibility adapter over the current controllers', () => {
    expect(moduleRoutes).toContain("require('../../../../controllers/authController')");
    expect(moduleRoutes).toContain(
      "require('../../../../controllers/employeeOnboardingController')",
    );
  });
});
