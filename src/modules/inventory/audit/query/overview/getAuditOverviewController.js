const { getAuditOverview } = require('./getAuditOverviewService');
const { setNoStoreHeaders, requireBranchId, parseSessionId } = require('../../shared/stockAuditHttp');

const getOverview = async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const result = await getAuditOverview({
      sessionId: parseSessionId(req.params.sessionId),
      branchId: requireBranchId(req),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Γ¥î [getOverview] error:', error);
    return res.status(500).json({ message: 'α╣äα╕íα╣êα╕¬α╕▓α╕íα╕▓α╕úα╕ûα╕öα╕╢α╕çα╕áα╕▓α╕₧α╕úα╕ºα╕íα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╣äα╕öα╣ë' });
  }
};

module.exports = { getOverview };
