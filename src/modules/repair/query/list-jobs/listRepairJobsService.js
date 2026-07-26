const repository = require('./listRepairJobsRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');

function optionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
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

function validateListQuery(query = {}) {
  const parsedLimit = Number(query.limit || 50);
  const parsedOffset = Number(query.offset || 0);

  return {
    status: query.status ? String(query.status).trim().toUpperCase() : null,
    stockItemId: optionalPositiveInteger(query.stockItemId, 'stockItemId'),
    customerId: optionalPositiveInteger(query.customerId, 'customerId'),
    limit: Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50,
    offset: Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
}

class ListRepairJobsService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, query) {
    const filters = validateListQuery(query);
    const jobs = await this.repository.findMany(actor.branchId, filters);
    return jobs.map(mapRepairJob);
  }
}

module.exports = new ListRepairJobsService();
module.exports.ListRepairJobsService = ListRepairJobsService;
module.exports.validateListQuery = validateListQuery;
