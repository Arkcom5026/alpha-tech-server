const { normalize, normalizeEmail } = require('../shared/authNormalization');
const registrationService = require('./registrationService');

const register = async (req, res) => {
  try {
    const shopName = normalize(req.body?.shopName);
    const shopSlug = normalize(req.body?.shopSlug).toLowerCase();
    const email = normalizeEmail(req.body?.email);
    const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : 1;

    if (!shopName || !shopSlug || !email) {
      return res.status(400).json({
        message: 'กรุณาระบุชื่อร้านค้า, Shop Slug และอีเมลติดต่อหลักให้ครบถ้วน',
      });
    }

    const result = await registrationService.registerStore({
      shopName,
      shopSlug,
      email,
      categoryId,
      req,
    });

    if (result.conflict === 'EMAIL') {
      return res.status(409).json({
        message: 'อีเมลติดต่อหลักนี้ถูกลงทะเบียนในระบบแพลตฟอร์มแล้ว',
      });
    }

    if (result.conflict === 'SLUG') {
      return res.status(409).json({
        message: 'ชื่อย่อลิงก์สาขา (Shop Slug) นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น',
      });
    }

    return res.status(201).json(result.response);
  } catch (error) {
    console.error('❌ register error:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'ระบบหลังบ้านขัดข้อง กรุณาลองใหม่อีกครั้ง',
    });
  }
};

module.exports = { register };
