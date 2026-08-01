const repository = require('../repository/missingCostResolutionRecoveryPreviewRepository');
const {
  buildApprovedResolutionRecoveryPreview,
} = require('../buildApprovedResolutionRecoveryPreview');
const {
  assertBranchId,
  assertResolutionId,
  createNotFoundError,
} = require('../../runtime/service/missingCostResolutionReadService');

const assertOperatorIdentity = (operatorIdentity) => {
  const normalized = String(operatorIdentity || '').trim();
  if (!normalized) {
    const error = new Error('Operator identity is required');
    error.code = 'MISSING_COST_RECOVERY_OPERATOR_REQUIRED';
    error.statusCode = 403;
    throw error;
  }
  return normalized;
};

class MissingCostResolutionRecoveryPreviewService {
  constructor(previewRepository = repository) {
    this.repository = previewRepository;
  }

  async buildPreview({ branchId, resolutionId, operatorIdentity }) {
    const scopedBranchId = assertBranchId(branchId);
    const scopedResolutionId = assertResolutionId(resolutionId);
    const scopedOperatorIdentity = assertOperatorIdentity(operatorIdentity);

    const resolution = await this.repository.findApprovedResolution({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
    });
    if (!resolution) throw createNotFoundError();

    const approvedVersion = resolution.versions?.[0] || null;
    const currentSource = await this.repository.findCurrentSource({
      branchId: scopedBranchId,
      stockBalanceId: resolution.stockBalanceId,
      productId: resolution.productId,
    });

    return buildApprovedResolutionRecoveryPreview({
      resolution: {
        ...resolution,
        approvedVersion,
      },
      currentSource,
      operatorIdentity: scopedOperatorIdentity,
    });
  }
}

module.exports = new MissingCostResolutionRecoveryPreviewService();
module.exports.MissingCostResolutionRecoveryPreviewService = MissingCostResolutionRecoveryPreviewService;
module.exports.assertOperatorIdentity = assertOperatorIdentity;
