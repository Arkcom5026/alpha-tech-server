const { cancelAudit, confirmAudit } = require('./finalizeAuditService');

const cancelAuditController = async (req, res) => {
  try {
    const result = await cancelAudit({
      sessionId: parseInt(req.params.sessionId, 10),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [cancelAudit] error:', error);
    return res.status(500).json({ message: 'ยกเลิกรอบเช็คไม่สำเร็จ' });
  }
};

const confirmAuditController = async (req, res) => {
  try {
    const result = await confirmAudit({
      sessionId: parseInt(req.params.sessionId, 10),
      branchId: Number(req.user?.branchId),
      strategy: req.body?.strategy,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [confirmAudit] error:', error);
    return res.status(500).json({ message: 'ยืนยันผลการเช็คไม่สำเร็จ' });
  }
};

module.exports = { cancelAuditController, confirmAuditController };
