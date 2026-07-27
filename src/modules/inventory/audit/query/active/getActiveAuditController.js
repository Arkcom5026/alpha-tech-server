const { getActiveAudit } = require('./getActiveAuditService');
const { setNoStoreHeaders, requireBranchId } = require('../../shared/stockAuditHttp');

const getActiveReadySession = async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const result = await getActiveAudit({ branchId: requireBranchId(req) });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [getActiveReadySession] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึง active session ได้' });
  }
};

module.exports = { getActiveReadySession };
