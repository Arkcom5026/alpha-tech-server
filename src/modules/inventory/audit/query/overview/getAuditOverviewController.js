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
    console.error('❌ [getOverview] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงภาพรวมรอบเช็คได้' });
  }
};

module.exports = { getOverview };
