const service = require('./listReceiptsReadyToPayService');

const handle = async (req, res) => {
  try {
    const result = await service.execute({
      branchId: Number(req.user?.branchId),
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
      limit: req.query?.limit,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [getReceiptsReadyToPay] error:', error);
    return res.status(500).json({ error: 'Failed to load outstanding receipts.' });
  }
};

module.exports = { handle };
