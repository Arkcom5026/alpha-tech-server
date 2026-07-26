const service = require('./commitReceiptService');

const handle = async (req, res) => {
  try {
    const result = await service.execute({
      id: Number(req.params.id),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [commitReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถ commit ใบรับสินค้าได้' });
  }
};

module.exports = { handle };
