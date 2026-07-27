const { getActiveAudit } = require('./getActiveAuditService');
const { setNoStoreHeaders, requireBranchId } = require('../../shared/stockAuditHttp');

const getActiveReadySession = async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const result = await getActiveAudit({ branchId: requireBranchId(req) });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Γ¥î [getActiveReadySession] error:', error);
    return res.status(500).json({ message: 'α╣äα╕íα╣êα╕¬α╕▓α╕íα╕▓α╕úα╕ûα╕öα╕╢α╕ç active session α╣äα╕öα╣ë' });
  }
};

module.exports = { getActiveReadySession };
