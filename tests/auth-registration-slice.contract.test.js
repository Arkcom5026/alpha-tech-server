const fs = require('fs');
const path = require('path');

describe('auth registration vertical slice', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  const routes = read('src/modules/auth/routes/authRoutes.js');
  const controller = read('src/modules/auth/registration/registrationController.js');
  const service = read('src/modules/auth/registration/registrationService.js');
  const repository = read('src/modules/auth/registration/registrationRepository.js');
  const mailService = read('src/modules/auth/registration/registrationMailService.js');

  test('canonical register route is owned by the registration slice', () => {
    expect(routes).toContain("require('../registration/registrationController')");
    expect(routes).toContain("router.post('/register', registrationController.register)");
    expect(routes).not.toContain("ensureLegacyFn('register')");
  });

  test('controller preserves validation, conflict and response semantics', () => {
    expect(controller).toContain('กรุณาระบุชื่อร้านค้า, Shop Slug และอีเมลติดต่อหลักให้ครบถ้วน');
    expect(controller).toContain('อีเมลติดต่อหลักนี้ถูกลงทะเบียนในระบบแพลตฟอร์มแล้ว');
    expect(controller).toContain('ชื่อย่อลิงก์สาขา (Shop Slug) นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น');
    expect(controller).toContain('return res.status(201).json(result.response)');
    expect(controller).toContain("ok: false");
  });

  test('repository owns the complete atomic registration aggregate', () => {
    expect(repository).toContain('prisma.$transaction');
    expect(repository).toContain('tx.branch.create');
    expect(repository).toContain('tx.user.create');
    expect(repository).toContain('tx.employeeProfile.create');
    expect(repository).toContain('tx.customerProfile.create');
    expect(repository).toContain('tx.passwordResetToken.create');
    expect(repository).toContain("role: 'ADMIN'");
    expect(repository).toContain("v2Role: 'OWNER'");
    expect(repository).toContain("type: 'ORGANIZATION'");
    expect(repository).toContain("businessType: 'GENERAL'");
  });

  test('service preserves password, reset-token, jwt and response contracts', () => {
    expect(service).toContain("Math.random().toString(36).slice(-10) + 'A1!'");
    expect(service).toContain('bcryptHash(rawPassword, 10)');
    expect(service).toContain('createPasswordResetToken()');
    expect(service).toContain('sha256(rawResetToken)');
    expect(service).toContain('getPasswordResetExpiresAt()');
    expect(service).toContain('buildAccessToken');
    expect(service).toContain('customerProfileId');
    expect(service).toContain("profileType: 'employee'");
  });

  test('welcome mail remains non-blocking and feature-owned', () => {
    expect(service).toContain('sendRegistrationWelcomeEmail');
    expect(service).toContain('.then(() => console.log');
    expect(service).toContain(".catch((error) => console.error('❌ [Register Mail Failed]'"
    );
    expect(mailService).toContain('รหัสผ่านชั่วคราวของคุณคือ');
    expect(mailService).toContain('ตั้งรหัสผ่านใหม่และเปิดใช้งานร้านค้า');
    expect(mailService).toContain('PASSWORD_RESET_TOKEN_EXPIRES_MINUTES');
    expect(mailService).toContain('sendMailAction');
  });
});
