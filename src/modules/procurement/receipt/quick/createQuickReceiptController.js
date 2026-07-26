const service = require('./createQuickReceiptService');

const handle = async (req, res) => {
  try {
    const payload = await service.execute({
      branchId: Number(req.user?.branchId),
      receivedById: Number(req.user?.employeeId),
      body: req.body,
    });

    return res.status(201).json(payload);
  } catch (error) {
    if (error?.status && error?.payload) {
      return res.status(error.status).json(error.payload);
    }

    console.error('❌ [createQuickReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถสร้าง QUICK receipt ได้' });
  }
};

module.exports = { handle };
