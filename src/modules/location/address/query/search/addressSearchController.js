const { Prisma } = require('../../../../../../lib/prisma');
const addressSearchService = require('./addressSearchService');

const trimOrUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const sendKnownPrismaError = (res, error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: 'เกิดข้อผิดพลาดในการค้นหาที่อยู่' });
  }
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
};

const searchAddress = async (req, res) => {
  try {
    const query = trimOrUndefined(req.query?.q);
    const result = await addressSearchService.searchAddresses(query);
    return res.json(result);
  } catch (error) {
    console.error('❌ [address.search] error:', error);
    return sendKnownPrismaError(res, error);
  }
};

module.exports = { searchAddress };
