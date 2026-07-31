const { Prisma } = require('../../../../../../lib/prisma');
const addressJoinService = require('./addressJoinService');

const trimOrUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const sendKnownPrismaError = (res, error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: 'เกิดข้อผิดพลาดในการรวมที่อยู่' });
  }
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
};

const joinAddress = async (req, res) => {
  try {
    const address = trimOrUndefined(req.body?.address);
    const subdistrictCode = trimOrUndefined(req.body?.subdistrictCode);
    const postalCode = trimOrUndefined(req.body?.postalCode);

    if (!subdistrictCode) {
      return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });
    }

    const joinedAddress = await addressJoinService.joinAddressBySubdistrictCode({
      address,
      subdistrictCode,
      postalCode,
    });

    if (!joinedAddress) {
      return res.status(404).json({ message: 'ไม่พบรหัสตำบล (subdistrictCode) นี้' });
    }

    return res.json({ address: joinedAddress });
  } catch (error) {
    console.error('❌ [address.join] error:', error);
    return sendKnownPrismaError(res, error);
  }
};

module.exports = { joinAddress };
