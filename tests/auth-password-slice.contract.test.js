const fs = require('fs');
const path = require('path');

describe('auth password lifecycle slice', () => {
  const root = path.resolve(__dirname, '..');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

  const routes = read('src/modules/auth/routes/authRoutes.js');
  const controller = read('src/modules/auth/password/passwordController.js');
  const service = read('src/modules/auth/password/passwordService.js');
  const repository = read('src/modules/auth/password/passwordRepository.js');
  const tokenService = read('src/modules/auth/password/passwordTokenService.js');
  const mailService = read('src/modules/auth/password/passwordResetMailService.js');

  test('canonical routes use the password slice', () => {
    expect(routes).toContain("require('../password/passwordController')");
    expect(routes).toContain("router.post('/forgot-password', passwordController.forgotPassword)");
    expect(routes).toContain("router.post('/reset-password', passwordController.resetPassword)");
    expect(routes).not.toContain("ensureLegacyFn('forgotPassword')");
    expect(routes).not.toContain("ensureLegacyFn('resetPassword')");
  });

  test('forgot-password preserves anti-enumeration and mail errors', () => {
    expect(service).toContain('GENERIC_SUCCESS_MESSAGE');
    expect(service).toContain('if (!user || !user.enabled)');
    expect(controller).toContain('กรุณากรอกอีเมล');
    expect(controller).toContain('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้');
    expect(mailService).toContain('PASSWORD_RESET_TOKEN_EXPIRES_MINUTES');
  });

  test('reset-password preserves validation and invalid-link semantics', () => {
    expect(controller).toContain('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือไม่ครบถ้วน');
    expect(controller).toContain('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
    expect(controller).toContain('ยืนยันรหัสผ่านไม่ตรงกัน');
    expect(controller).toContain('ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว');
  });

  test('repository owns atomic reset-token lifecycle', () => {
    expect(repository).toContain('prisma.$transaction');
    expect(repository).toContain('passwordResetToken.updateMany');
    expect(repository).toContain('passwordResetToken.create');
    expect(repository).toContain('tx.user.update');
    expect(repository).toContain('expiresAt: { gt: new Date() }');
  });

  test('token generation and URL resolution remain bounded', () => {
    expect(tokenService).toContain("crypto.randomBytes(32).toString('hex')");
    expect(tokenService).toContain("createHash('sha256')");
    expect(tokenService).toContain('APP_BASE_URL');
    expect(tokenService).toContain('CLIENT_URL');
    expect(tokenService).toContain('/reset-password?token=');
  });
});
