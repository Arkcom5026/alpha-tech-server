const { Prisma } = require('../../../../../../lib/prisma');
const addressResolveService = require('./addressResolveService');

function toStringOrUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function sendKnownPrismaError(res, error, fallbackMessage) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: fallbackMessage });
  }

  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
}

async function resolveAddress(req, res) {
  try {
    const subdistrictCode = toStringOrUndefined(req.query?.subdistrictCode);
    const address = toStringOrUndefined(req.query?.address);
    const postalCode = toStringOrUndefined(req.query?.postalCode);

    if (!subdistrictCode) {
      return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });
    }

    const result = await addressResolveService.resolveAddress({
      subdistrictCode,
      address,
      postalCode,
    });

    if (!result) {
      return res.status(404).json({ message: 'ไม่พบรหัสตำบล (subdistrictCode) นี้' });
    }

    return res.json(result);
  } catch (error) {
    console.error('❌ [address.resolve] error:', error);
    return sendKnownPrismaError(res, error, 'เกิดข้อผิดพลาดในการดึงข้อมูลที่อยู่');
  }
}

module.exports = {
  resolveAddress,
};
