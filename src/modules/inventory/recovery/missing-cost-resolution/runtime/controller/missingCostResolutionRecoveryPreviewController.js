const service = require('../../recovery-preview/service/missingCostResolutionRecoveryPreviewService');
const {
  buildMissingCostResolutionRecoveryApprovalPlan,
} = require('../../recovery-plan/buildMissingCostResolutionRecoveryApprovalPlan');

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
    const operatorIdentity = buildOperatorIdentity(req.user);
    const result = await service.buildPreview({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
      operatorIdentity,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const getApprovalPlan = async (req, res, next) => {
  try {
    const operatorIdentity = buildOperatorIdentity(req.user);
    const preview = await service.buildPreview({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
      operatorIdentity,
    });
    const result = buildMissingCostResolutionRecoveryApprovalPlan({
      preview,
      operatorIdentity,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPreview,
  getApprovalPlan,
  buildOperatorIdentity,
};
