const service = require('./generateReceiptBarcodesService');

const handle = async (req, res) => {
  try {
    const result = await service.execute({
      id: Number(req.params.id),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [generateReceiptBarcodes] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถสร้างบาร์โค้ดได้' });
  }
};

module.exports = { handle };
