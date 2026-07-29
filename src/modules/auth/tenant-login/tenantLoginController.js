const { normalize, normalizeEmail } = require('../shared/authNormalization');
const tenantLoginService = require('./tenantLoginService');

const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = normalize(req.body?.password);
    const tenantSlug = req.tenant?.slug;

    const result = await tenantLoginService.login({ email, password, tenantSlug });

    if (result.error === 'INVALID_ACCOUNT') {
      return res.status(401).json({
        message: 'ระบุข้อมูลบัญชีใช้งานผู้ใช้ไม่ถูกต้องหรือพนักงานถูกระงับสิทธิ์',
      });
    }

    if (result.error === 'TENANT_FORBIDDEN') {
      return res.status(403).json({
        message: 'บัญชีผู้ใช้ของคุณไม่มีระดับขอบเขตการทำงานร่วมกับสาขานี้',
      });
    }

    if (result.error === 'INVALID_PASSWORD') {
      return res.status(401).json({
        message: 'ระบุข้อมูลบัญชีใช้งานผู้ใช้ไม่ถูกต้อง (รหัสผ่านผิดพลาด)',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'การเข้าสู่ระบบและระบุสาขาสำเร็จ',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { login };
