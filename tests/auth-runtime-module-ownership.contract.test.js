const fs = require('fs');
const path = require('path');

describe('auth runtime module ownership', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const moduleRoutes = fs.readFileSync(
    path.join(root, 'src/modules/auth/routes/authRoutes.js'),
    'utf8',
  );

  test('server mounts /api/auth from the single canonical module route', () => {
    expect(server).toContain("require('./src/modules/auth/routes/authRoutes')");
    expect(server).not.toContain("require('./src/modules/auth/routes/authRuntimeRoutes')");
    expect(server).not.toContain("require('./routes/authRoutes')");
    expect(server).toContain("app.use('/api/auth', authRoutes)");
  });

  test('canonical module route preserves the current auth endpoint surface', () => {
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

  test('canonical route retains tenant-login responsibility', () => {
    expect(moduleRoutes).toContain("router.post('/:tenant_slug/auth/login'");
    expect(moduleRoutes).toContain("require('../../../middlewares/tenantContext')");
    expect(moduleRoutes).toContain("require('../controllers/authController')");
  });

  test('canonical module route preserves auth middleware and refresh-cookie transport', () => {
    expect(moduleRoutes).toContain("require('../../../../middlewares/verifyToken')");
    expect(moduleRoutes).toContain("require('../../../../middlewares/authTrace')");
    expect(moduleRoutes).toContain("path: '/api/auth'");
    expect(moduleRoutes).toContain("sameSite: isProduction ? 'none' : 'lax'");
    expect(moduleRoutes).toContain('httpOnly: true');
  });

  test('canonical route keeps the current controllers behind an explicit migration boundary', () => {
    expect(moduleRoutes).toContain("require('../../../../controllers/authController')");
    expect(moduleRoutes).toContain(
      "require('../../../../controllers/employeeOnboardingController')",
    );
  });

  test('duplicate module runtime route has been retired', () => {
    expect(
      fs.existsSync(path.join(root, 'src/modules/auth/routes/authRuntimeRoutes.js')),
    ).toBe(false);
  });
});
