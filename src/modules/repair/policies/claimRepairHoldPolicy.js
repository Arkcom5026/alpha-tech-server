const { CLAIM_ACTIVE_STATUSES } = require('../contracts/repairContract');

function findActiveLinkedClaim(repairJob) {
  return (repairJob?.warrantyClaims || []).find((claim) =>
    CLAIM_ACTIVE_STATUSES.includes(claim.status)
  ) || null;
}

function assertRepairNotHeldByActiveClaim(repairJob, ErrorType, code = 'REPAIR_ACTIVE_CLAIM_HOLD') {
  const activeClaim = findActiveLinkedClaim(repairJob);
  if (!activeClaim) return null;

  throw new ErrorType(
    code,
    `Repair job is held by active warranty claim ${activeClaim.claimNo || activeClaim.id}`,
    {
      repairJobId: repairJob.id,
      warrantyClaimId: activeClaim.id,
      claimNo: activeClaim.claimNo || null,
      claimStatus: activeClaim.status,
    }
  );
}

module.exports = {
  findActiveLinkedClaim,
  assertRepairNotHeldByActiveClaim,
};
