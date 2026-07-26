const listEligiblePurchaseOrdersRepository = require('./listEligiblePurchaseOrdersRepository');

class EligiblePurchaseOrdersQueryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EligiblePurchaseOrdersQueryError';
    this.code = code;
  }
}

class ListEligiblePurchaseOrdersService {
  constructor(repository = listEligiblePurchaseOrdersRepository) {
    this.repository = repository;
  }

  execute({ branchId }) {
    const normalizedBranchId = Number(branchId);
    if (!normalizedBranchId) {
      throw new EligiblePurchaseOrdersQueryError('UNAUTHORIZED', 'unauthorized');
    }
    return this.repository.findMany(normalizedBranchId);
  }
}

module.exports = new ListEligiblePurchaseOrdersService();
module.exports.ListEligiblePurchaseOrdersService = ListEligiblePurchaseOrdersService;
module.exports.EligiblePurchaseOrdersQueryError = EligiblePurchaseOrdersQueryError;
