const { prisma } = require('../../../../../../lib/prisma');
const GetCombinableSalesRepository = require('./getCombinableSalesRepository');
const GetCombinableSalesService = require('./getCombinableSalesService');

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const repository = new GetCombinableSalesRepository(prisma);
const service = new GetCombinableSalesService(repository);

const getCombinableSales = async (req, res) => {
  try {
    const branchId = toPositiveInt(req.user?.branchId);
    const sales = await service.execute(branchId);
    return res.json(sales);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    const payload = error?.code
      ? { code: error.code, error: error.message }
      : { error: 'ไม่สามารถโหลดข้อมูลได้' };

    if (statusCode >= 500) {
      console.error('❌ [getCombinableSales] error:', error);
    }

    return res.status(statusCode).json(payload);
  }
};

module.exports = { getCombinableSales };
