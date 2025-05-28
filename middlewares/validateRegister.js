// ✅ middleware/validateRegister.js (CommonJS)

const { body, validationResult } = require('express-validator');

const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('กรุณากรอกอีเมลให้ถูกต้อง'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),

  body('name')
    .notEmpty()
    .withMessage('กรุณากรอกชื่อ'),

  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('เบอร์โทรศัพท์ไม่ถูกต้อง'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = {
  validateRegister,
};
