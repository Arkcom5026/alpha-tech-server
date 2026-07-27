const { startReadyStockAudit } = require('./startAuditService');

const startReadyAudit = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeId = req.user?.employeeId ?? req.user?.profileId ?? null;
    const result = await startReadyStockAudit({ branchId, employeeId });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Γ¥î [startReadyAudit] error:', error);
    return res.status(500).json({ message: 'α╣äα╕íα╣êα╕¬α╕▓α╕íα╕▓α╕úα╕ûα╣Çα╕úα╕┤α╣êα╕íα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╕¬α╕òα╣èα╕¡α╕üα╣äα╕öα╣ë' });
  }
};

module.exports = { startReadyAudit };
