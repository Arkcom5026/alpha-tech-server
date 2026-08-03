function buildCustomerBranchEvidence(branchIdInput) {
  const branchId = Number(branchIdInput);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return { id: { equals: -1 } };
  }

  return {
    OR: [
      { sales: { some: { branchId } } },
      { repairJobs: { some: { branchId } } },
      { deviceIntakes: { some: { branchId } } },
      { ownedDevices: { some: { branchId, status: { not: 'RETIRED' } } } },
    ],
  };
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
