function normalizeBranchId(branchIdInput) {
  const branchId = Number(branchIdInput);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
}

function buildCustomerBranchEvidence(branchIdInput) {
  const branchId = normalizeBranchId(branchIdInput);
  if (!branchId) {
    return { id: { equals: -1 } };
  }

  return { branchId };
}

function buildCustomerBranchAccessWhere({ customerId, branchId }) {
  return {
    id: Number(customerId),
    ...buildCustomerBranchEvidence(branchId),
  };
}

module.exports = {
  buildCustomerBranchEvidence,
  buildCustomerBranchAccessWhere,
};
