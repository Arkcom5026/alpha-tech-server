const service = require('../service/missingCostResolutionRecoveryPreviewService');

const buildOperatorIdentity = (user) => {
  const employeeId = Number(user?.employeeId || user?.id);
  if (Number.isInteger(employeeId) && employeeId > 0) {
    return `employee:${employeeId}`;
  }
  const email = String(user?.email || '').trim();
  return email ? `user:${email}` : '';
};

const getPreview = async (req, res, next) => {
  try {
    const result = await service.getPreview({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
      operatorIdentity: buildOperatorIdentity(req.user),
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPreview,
  buildOperatorIdentity,
};
