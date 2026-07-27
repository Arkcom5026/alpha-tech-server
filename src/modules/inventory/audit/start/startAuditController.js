const { startReadyStockAudit } = require('./startAuditService');

const startReadyAudit = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeId = req.user?.employeeId ?? req.user?.profileId ?? null;
    const result = await startReadyStockAudit({ branchId, employeeId });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [startReadyAudit] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถเริ่มรอบเช็คสต๊อกได้' });
  }
};

module.exports = { startReadyAudit };
