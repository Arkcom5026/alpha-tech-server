// src/modules/location/address/query/validate/addressValidateService.js
const addressValidateRepository = require('./addressValidateRepository');

const normalizeSubdistrictCode = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const validateSubdistrictCode = async (value) => {
  const subdistrictCode = normalizeSubdistrictCode(value);

  if (!subdistrictCode) {
    const error = new Error('กรุณาระบุ subdistrictCode');
    error.code = 'ADDRESS_SUBDISTRICT_CODE_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const subdistrict = await addressValidateRepository.findSubdistrictByCode(subdistrictCode);
  return { valid: Boolean(subdistrict) };
};

module.exports = {
  normalizeSubdistrictCode,
  validateSubdistrictCode,
};
