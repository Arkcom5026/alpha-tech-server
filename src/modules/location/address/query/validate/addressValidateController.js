// src/modules/location/address/query/validate/addressValidateController.js
const addressValidateService = require('./addressValidateService');
const {
  AddressValidatePersistenceError,
} = require('./addressValidateRepository');

const validateAddress = async (req, res) => {
  try {
    const result = await addressValidateService.validateSubdistrictCode(
      req.query?.subdistrictCode
    );
    return res.json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }

    console.error('❌ [address.validate] error:', error.cause || error);

    if (error instanceof AddressValidatePersistenceError && error.isKnownPrismaError) {
      return res.status(400).json({
        error: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสตำบล',
      });
    }

    return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

module.exports = {
  validateAddress,
};
