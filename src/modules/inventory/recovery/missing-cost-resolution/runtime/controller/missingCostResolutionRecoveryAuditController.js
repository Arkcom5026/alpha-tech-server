const service = require('../../recovery-audit/service/missingCostResolutionRecoveryAuditService');

const getPostRecoveryAudit = async (req, res, next) => {
  try {
    const result = await service.getPostRecoveryAudit({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPostRecoveryAudit,
};
