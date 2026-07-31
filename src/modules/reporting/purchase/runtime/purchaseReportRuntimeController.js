const service = require('./purchaseReportRuntimeService');

const requireBranchId = (req, res) => {
  const branchId = Number.parseInt(req.user?.branchId, 10);
  if (!branchId) {
    res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    return null;
  }
  return branchId;
};

const sendServiceResult = (res, result) => res.status(result.status).json(result.body);

const getPurchaseReport = async (req, res) => {
  const branchId = requireBranchId(req, res);
  if (!branchId) return undefined;

  try {
    return sendServiceResult(
      res,
      await service.getPurchaseReport({ branchId, query: req.query || {} })
    );
  } catch (error) {
    console.error('Error fetching purchase report:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching the purchase report.',
      error: error?.message || String(error),
    });
  }
};

const getPurchaseReceiptReport = async (req, res) => {
  const branchId = requireBranchId(req, res);
  if (!branchId) return undefined;

  try {
    return sendServiceResult(
      res,
      await service.getPurchaseReceiptReport({ branchId, query: req.query || {} })
    );
  } catch (error) {
    console.error('Error fetching purchase receipt report:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching the purchase receipt report.',
      error: error?.message || String(error),
    });
  }
};

const getPurchaseReceiptReportDetail = async (req, res) => {
  const branchId = requireBranchId(req, res);
  if (!branchId) return undefined;

  try {
    return sendServiceResult(
      res,
      await service.getPurchaseReceiptReportDetail({
        branchId,
        receiptId: req.params?.receiptId,
      })
    );
  } catch (error) {
    console.error('Error fetching purchase receipt report detail:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching the purchase receipt report detail.',
      error: error?.message || String(error),
    });
  }
};

module.exports = {
  getPurchaseReport,
  getPurchaseReceiptReport,
  getPurchaseReceiptReportDetail,
};
