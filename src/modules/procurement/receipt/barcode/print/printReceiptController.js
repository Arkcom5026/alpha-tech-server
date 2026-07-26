const service = require('./printReceiptService');

const handle = async (req, res) => {
  try {
    const result = await service.execute({
      id: Number(req.params.id),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [printReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถพิมพ์บาร์โค้ดได้' });
  }
};

module.exports = { handle };
