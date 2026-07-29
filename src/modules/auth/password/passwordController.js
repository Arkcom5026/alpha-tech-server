const { normalize, normalizeEmail } = require('../shared/authNormalization');
const passwordService = require('./passwordService');

const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'กรุณากรอกอีเมล' });

    const result = await passwordService.requestPasswordReset({ email, req });
    return res.json(result);
  } catch (error) {
    if (error?.code === 'PASSWORD_RESET_MAIL_FAILED') {
      console.error('❌ sendPasswordResetEmail error:', error.cause || error);
      return res.status(500).json({ message: 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้' });
    }

    console.error('❌ forgotPassword error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดำเนินการลืมรหัสผ่านได้' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const rawToken = normalize(req.body?.token);
    const password = normalize(req.body?.password);
    const confirmPassword = normalize(req.body?.confirmPassword);

    if (!rawToken) return res.status(400).json({ message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือไม่ครบถ้วน' });
    if (!password || !confirmPassword) return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน' });
    if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'ยืนยันรหัสผ่านไม่ตรงกัน' });

    const result = await passwordService.resetPassword({ rawToken, password });
    if (result.invalid) {
      return res.status(400).json({ message: 'ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรีเซ็ตรหัสผ่านใหม่อีกครั้ง' });
    }

    return res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง' });
  } catch (error) {
    console.error('❌ resetPassword error:', error);
    return res.status(500).json({ message: 'ไม่สามารถรีเซ็ตรหัสผ่านได้' });
  }
};

module.exports = { forgotPassword, resetPassword };