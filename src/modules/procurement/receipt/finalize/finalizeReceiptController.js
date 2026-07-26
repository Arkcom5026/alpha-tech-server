const service = require('./finalizeReceiptService');

const handle = async (req, res) => {
  try {
    const result = await service.execute({
      id: Number(req.params.id),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ finalizeReceiptController error:', error);
    return res.status(500).json({ message: 'Failed to finalize receipt.' });
  }
};

module.exports = { handle };
