const repository = require('./listWarrantyClaimsRepository');
const { mapWarrantyClaim } = require('../../../mappers/repairMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../../contracts/repairError');

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

function validateListWarrantyClaimsQuery(query = {}) {
  const parsedLimit = Number(query.limit || 50);
  const parsedOffset = Number(query.offset || 0);

  return {
    status: query.status ? String(query.status).trim().toUpperCase() : null,
    stockItemId: optionalPositiveInteger(query.stockItemId, 'stockItemId'),
    limit: Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50,
    offset: Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
}

class ListWarrantyClaimsService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, query) {
    const filters = validateListWarrantyClaimsQuery(query);
    const claims = await this.repository.findMany(actor.branchId, filters);
    return claims.map(mapWarrantyClaim);
  }
}

module.exports = new ListWarrantyClaimsService();
module.exports.ListWarrantyClaimsService = ListWarrantyClaimsService;
module.exports.validateListWarrantyClaimsQuery = validateListWarrantyClaimsQuery;
