// src/modules/auth/controllers/authController.js
const authService = require('../services/authService');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { slug: tenantSlug } = req.tenant;

      const result = await authService.login(email, password, tenantSlug);

      return res.status(200).json({
        success: true,
        message: 'การเข้าสู่ระบบและระบุสาขาสำเร็จ',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();