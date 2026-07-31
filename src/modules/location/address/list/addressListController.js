const { Prisma } = require('../../../../../lib/prisma');
const addressListService = require('./addressListService');

function sendKnownPrismaError(res, error, fallbackMessage) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: fallbackMessage });
  }

  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
}

function trimOrUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

async function listProvinces(_req, res) {
  try {
    const items = await addressListService.getProvinces();
    return res.json(items);
  } catch (error) {
    console.error('❌ [address.listProvinces] error:', error);
    return sendKnownPrismaError(res, error, 'เกิดข้อผิดพลาดในการดึงจังหวัด');
  }
}

async function listDistricts(req, res) {
  try {
    const provinceCode = trimOrUndefined(req.query?.provinceCode);
    if (!provinceCode) {
      return res.status(400).json({ message: 'provinceCode is required' });
    }

    const items = await addressListService.getDistricts(provinceCode);
    return res.json(items);
  } catch (error) {
    console.error('❌ [address.listDistricts] error:', error);
    return sendKnownPrismaError(res, error, 'เกิดข้อผิดพลาดในการดึงอำเภอ');
  }
}

async function listSubdistricts(req, res) {
  try {
    const districtCode = trimOrUndefined(req.query?.districtCode);
    if (!districtCode) {
      return res.status(400).json({ message: 'districtCode is required' });
    }

    const items = await addressListService.getSubdistricts(districtCode);
    return res.json(items);
  } catch (error) {
    console.error('❌ [address.listSubdistricts] error:', error);
    return sendKnownPrismaError(res, error, 'เกิดข้อผิดพลาดในการดึงตำบล');
  }
}

module.exports = {
  listProvinces,
  listDistricts,
  listSubdistricts,
};
