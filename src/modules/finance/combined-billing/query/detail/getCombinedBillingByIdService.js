const { GetCombinedBillingByIdRepository } = require('./getCombinedBillingByIdRepository');

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

class GetCombinedBillingByIdService {
  constructor(repository = new GetCombinedBillingByIdRepository()) {
    this.repository = repository;
  }

  async execute({ id, branchId }) {
    const normalizedId = toPositiveInt(id);
    const normalizedBranchId = toPositiveInt(branchId);

    if (!normalizedId || !normalizedBranchId) {
      const error = new Error('ข้อมูลไม่ครบ');
      error.code = 'COMBINED_BILLING_DETAIL_INVALID_CONTEXT';
      error.statusCode = 400;
      throw error;
    }

    const document = await this.repository.findByIdForBranch({
      id: normalizedId,
      branchId: normalizedBranchId,
    });

    if (!document) {
      const error = new Error('ไม่พบเอกสาร');
      error.code = 'COMBINED_BILLING_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    return document;
  }
}

module.exports = { GetCombinedBillingByIdService, toPositiveInt };
