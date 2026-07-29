const fs = require('fs');
const path = require('path');

describe('auth login vertical slice', () => {
  const root = path.resolve(__dirname, '..');
  const routes = fs.readFileSync(
    path.join(root, 'src/modules/auth/routes/authRoutes.js'),
    'utf8',
  );
  const controller = fs.readFileSync(
    path.join(root, 'src/modules/auth/login/loginController.js'),
    'utf8',
  );
  const service = fs.readFileSync(
    path.join(root, 'src/modules/auth/login/loginService.js'),
    'utf8',
  );
  const repository = fs.readFileSync(
    path.join(root, 'src/modules/auth/login/loginRepository.js'),
    'utf8',
  );

  test('canonical login route is owned by the login slice', () => {
    expect(routes).toContain("require('../login/loginController')");
    expect(routes).toContain("router.post('/login', loginController.login)");
    expect(routes).not.toContain("const login = ensureLegacyFn('login')");
  });

  test('login slice preserves the existing response contract', () => {
    for (const fragment of [
      'token: accessToken',
      'accessToken',
      'profileType: \'employee\'',
      'accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES',
      'refreshTokenExpiresIn: getRefreshTokenExpiresIn(rememberMe)',
    ]) {
      expect(controller).toContain(fragment);
    }
  });

  test('login service preserves employee access policies', () => {
    expect(service).toContain('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบจัดการหลังบ้าน');
    expect(service).toContain('บัญชีนี้ถูกปิดใช้งาน');
    expect(service).toContain('โปรไฟล์พนักงานของคุณถูกปิดใช้งาน');
    expect(service).toContain('โปรไฟล์พนักงานของคุณยังไม่ได้รับการอนุมัติ');
  });

  test('repository owns Prisma lookup details', () => {
    expect(repository).toContain("require('../../../lib/prisma')");
    expect(repository).toContain('prisma.user.findUnique');
    expect(repository).toContain('prisma.user.findFirst');
    expect(repository).toContain('prisma.employeeProfile.findFirst');
  });

  test('legacy controller remains bounded to unmigrated responsibilities', () => {
    expect(routes).toContain("require('../../../../controllers/authController')");
    expect(routes).toContain("ensureLegacyFn('register')");
    expect(routes).toContain("ensureLegacyFn('refreshSession')");
    expect(routes).not.toContain("ensureLegacyFn('login')");
  });
});
