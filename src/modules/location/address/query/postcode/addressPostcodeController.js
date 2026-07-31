const { Prisma } = require('../../../../../../lib/prisma');
const addressPostcodeService = require('./addressPostcodeService');

const trimOrUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const sendKnownPrismaError = (res, error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: 'เกิดข้อผิดพลาดในการดึงรหัสไปรษณีย์' });
  }
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
};

const postcodeAddress = async (req, res) => {
  try {
    const subdistrictCode = trimOrUndefined(req.query?.subdistrictCode);
    if (!subdistrictCode) {
      return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });
    }

    const result = await addressPostcodeService.getPostcodeBySubdistrictCode(subdistrictCode);
    if (!result) {
      return res.status(404).json({ message: 'ไม่พบรหัสตำบล (subdistrictCode) นี้' });
    }

    return res.json({ postalCode: result.postcode || null });
  } catch (error) {
    console.error('❌ [address.postcode] error:', error);
    return sendKnownPrismaError(res, error);
  }
};

module.exports = { postcodeAddress };
