const { cancelAudit, confirmAudit } = require('./finalizeAuditService');

const cancelAuditController = async (req, res) => {
  try {
    const result = await cancelAudit({
      sessionId: parseInt(req.params.sessionId, 10),
      branchId: Number(req.user?.branchId),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Γ¥î [cancelAudit] error:', error);
    return res.status(500).json({ message: 'α╕óα╕üα╣Çα╕Ñα╕┤α╕üα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê' });
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
    console.error('Γ¥î [confirmAudit] error:', error);
    return res.status(500).json({ message: 'α╕óα╕╖α╕Öα╕óα╕▒α╕Öα╕£α╕Ñα╕üα╕▓α╕úα╣Çα╕èα╣çα╕äα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê' });
  }
};

module.exports = { cancelAuditController, confirmAuditController };
