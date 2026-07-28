const { prisma } = require('../../../../../lib/prisma');
const {
  toInt,
  projectSaleReturnSummary,
} = require('../../shared/saleReturnProjection');

const getAllSaleReturns = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const saleReturns = await prisma.saleReturn.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        sale: { include: { customer: true } },
        items: true,
      },
    });

    return res.status(200).json(saleReturns.map(projectSaleReturnSummary));
  } catch (error) {
    console.error('❌ [getAllSaleReturns] Error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบคืนสินค้าได้' });
  }
};

module.exports = {
  getAllSaleReturns,
};
