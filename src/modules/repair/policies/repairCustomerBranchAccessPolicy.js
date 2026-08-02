function buildCustomerBranchEvidence(branchIdInput) {
  const branchId = Number(branchIdInput);
  return {
    OR: [
      { sales: { some: { branchId } } },
      { repairJobs: { some: { branchId } } },
      { deviceIntakes: { some: { branchId } } },
      { ownedDevices: { some: { branchId, status: { not: 'RETIRED' } } } },
    ],
  };
}

module.exports = { buildCustomerBranchEvidence };
