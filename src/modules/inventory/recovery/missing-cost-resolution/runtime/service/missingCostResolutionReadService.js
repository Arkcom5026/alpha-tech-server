const repository = require('../repository/missingCostResolutionReadRepository');
const {
  buildRuntimeQueueDto,
  buildRuntimeDetailDto,
  mapAuditEvent,
} = require('../mappers/missingCostResolutionReadMapper');

const assertBranchId = (branchId) => {
  const value = Number(branchId);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error('Authenticated branch is required');
    error.code = 'MISSING_COST_BRANCH_REQUIRED';
    error.statusCode = 403;
    throw error;
  }
  return value;
};

const assertResolutionId = (resolutionId) => {
  const value = Number(resolutionId);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error('Resolution id must be a positive integer');
    error.code = 'MISSING_COST_RESOLUTION_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const createNotFoundError = () => {
  const error = new Error('Missing cost resolution not found');
  error.code = 'MISSING_COST_RESOLUTION_NOT_FOUND';
  error.statusCode = 404;
  return error;
};

class MissingCostResolutionReadService {
  constructor(readRepository = repository) {
    this.repository = readRepository;
  }

  async listQueue({ branchId, filters = {} }) {
    const scopedBranchId = assertBranchId(branchId);
    const rows = await this.repository.findQueue({
      branchId: scopedBranchId,
      status: filters.status,
      productId: filters.productId,
      stockBalanceId: filters.stockBalanceId,
      limit: filters.limit,
      offset: filters.offset,
    });
    return buildRuntimeQueueDto({ branchId: scopedBranchId, rows });
  }

  async getDetail({ branchId, resolutionId }) {
    const scopedBranchId = assertBranchId(branchId);
    const scopedResolutionId = assertResolutionId(resolutionId);
    const row = await this.repository.findDetail({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
    });
    if (!row) throw createNotFoundError();
    return buildRuntimeDetailDto(row);
  }

  async getAuditHistory({ branchId, resolutionId }) {
    const scopedBranchId = assertBranchId(branchId);
    const scopedResolutionId = assertResolutionId(resolutionId);
    const row = await this.repository.findDetail({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
    });
    if (!row) throw createNotFoundError();
    const events = await this.repository.findAuditHistory({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
    });
    return {
      apiVersion: 'missing-cost-resolution-api-v1',
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
      mode: 'READ_ONLY_AUDIT_HISTORY',
      mutationPerformed: false,
      items: events.map(mapAuditEvent),
    };
  }
}

module.exports = new MissingCostResolutionReadService();
module.exports.MissingCostResolutionReadService = MissingCostResolutionReadService;
module.exports.assertBranchId = assertBranchId;
module.exports.assertResolutionId = assertResolutionId;
module.exports.createNotFoundError = createNotFoundError;
