class GetCombinableSalesService {
  constructor(repository) {
    this.repository = repository;
  }

  async execute(branchId) {
    if (!Number.isInteger(branchId) || branchId <= 0) {
      const error = new Error('Branch context is required');
      error.code = 'BRANCH_CONTEXT_REQUIRED';
      error.statusCode = 401;
      throw error;
    }

    return this.repository.listByBranch(branchId);
  }
}

module.exports = GetCombinableSalesService;
