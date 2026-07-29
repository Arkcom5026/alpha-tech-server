const { normalizeEmail } = require('../shared/authNormalization');
const userLookupService = require('./userLookupService');

const findUserByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email) return res.status(400).json({ message: 'กรุณาระบุอีเมล' });

    const user = await userLookupService.findUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้อีเมลนี้' });

    return res.json(user);
  } catch (error) {
    console.error('❌ findUserByEmail error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = { findUserByEmail };
