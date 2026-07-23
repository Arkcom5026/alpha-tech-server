const { prisma } = require('../../../../../lib/prisma');
const { updateSaleDocumentLines } = require('../services/saleDocumentService');

const updateSaleDocumentLinesController = async (req, res) => {
  try {
    const saleId = Number(req.params.id ?? req.params.saleId);
    const branchId = Number(req.user?.branchId);

    const result = await updateSaleDocumentLines({
      prisma,
      saleId,
      branchId,
      items: req.body?.items,
      simpleItems: req.body?.simpleItems,
    });

    return res.json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('❌ [updateSaleDocumentLines] error:', error);
    return res.status(status).json({ error: error?.message || 'ไม่สามารถบันทึกข้อความก่อน/หลังสินค้าได้' });
  }
};

const updateSaleDocumentDescriptionsController =
  updateSaleDocumentLinesController;

module.exports = {
  updateSaleDocumentDescriptionsController,
  updateSaleDocumentLinesController,
};
