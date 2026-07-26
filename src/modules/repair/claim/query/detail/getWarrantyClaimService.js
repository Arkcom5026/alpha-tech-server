const repository = require('./getWarrantyClaimRepository');
const { mapWarrantyClaim } = require('../../../mappers/repairMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../../contracts/repairError');

function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนเต็มมากกว่า 0`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

class GetWarrantyClaimService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, warrantyClaimId) {
    const normalizedClaimId = positiveInteger(
      warrantyClaimId,
      'warrantyClaimId'
    );

    const claim = await this.repository.findById(
      actor.branchId,
      normalizedClaimId
    );

    if (!claim) {
      throw new RepairError(
        RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND,
        'ไม่พบรายการเคลมในสาขานี้',
        404
      );
    }

    return mapWarrantyClaim(claim);
  }
}

module.exports = new GetWarrantyClaimService();
module.exports.GetWarrantyClaimService = GetWarrantyClaimService;
module.exports.positiveInteger = positiveInteger;
