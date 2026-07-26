const service = require('./listPurchaseOrderItemsService');

const handle = async (req, res) => {
  try {
    const poId = Number(req.params.poId ?? req.params.id);
    const items = await service.execute({
      poId,
      branchId: Number(req.user?.branchId),
    });

    return res.json(items);
  } catch (error) {
    if (error?.status && error?.payload) {
      return res.status(error.status).json(error.payload);
    }

    console.error('[getPOItemsByPOId] ❌', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { handle };
