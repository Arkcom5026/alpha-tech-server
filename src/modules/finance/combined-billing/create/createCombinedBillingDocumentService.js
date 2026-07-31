const toPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const normalizeSaleIds = (saleIds) => (
  Array.isArray(saleIds)
    ? saleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : []
);

const createCombinedBillingDocumentService = ({ repository }) => ({
  create: async ({ branchId, employeeId, saleIds, note }) => {
    const normalizedBranchId = toPositiveInteger(branchId);
    if (!normalizedBranchId) {
      const error = new Error('Unauthorized: missing branch context');
      error.statusCode = 401;
      error.code = 'BRANCH_CONTEXT_REQUIRED';
      throw error;
    }

    const normalizedEmployeeId = toPositiveInteger(employeeId);
    if (!normalizedEmployeeId) {
      const error = new Error('Employee profile context is required');
      error.statusCode = 403;
      error.code = 'EMPLOYEE_CONTEXT_REQUIRED';
      throw error;
    }

    const normalizedSaleIds = normalizeSaleIds(saleIds);
    if (normalizedSaleIds.length === 0) {
      const error = new Error('กรุณาเลือกรายการขายอย่างน้อย 1 รายการ');
      error.statusCode = 400;
      throw error;
    }

    return repository.create({
      branchId: normalizedBranchId,
      employeeId: normalizedEmployeeId,
      saleIds: normalizedSaleIds,
      note: String(note || ''),
    });
  },
});

module.exports = {
  createCombinedBillingDocumentService,
  normalizeSaleIds,
};
