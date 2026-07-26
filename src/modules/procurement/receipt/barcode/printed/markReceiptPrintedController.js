const service = require('./markReceiptPrintedService');

const handle = async (req, res) => {
  try {
    const result = await service.execute({
      id: Number(req.params.id),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ markPurchaseOrderReceiptAsPrinted error:', error);
    return res.status(500).json({ error: 'Failed to mark receipt as printed' });
  }
};

module.exports = { handle };
