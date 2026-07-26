const repository = require('./repairJobDetailRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');

function requirePositiveInteger(value, fieldName) {
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

class RepairJobDetailService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, repairJobIdInput) {
    const repairJobId = requirePositiveInteger(repairJobIdInput, 'repairJobId');
    const job = await this.repository.findById(actor.branchId, repairJobId);

    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }

    return mapRepairJob(job);
  }
}

module.exports = new RepairJobDetailService();
module.exports.RepairJobDetailService = RepairJobDetailService;
module.exports.requirePositiveInteger = requirePositiveInteger;
