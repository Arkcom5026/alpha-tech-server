function assertRepairNotHeldByActiveSubcontract(
  activeSubcontract,
  ErrorType,
  code = 'REPAIR_ACTIVE_SUBCONTRACT_HOLD'
) {
  if (!activeSubcontract) return null;

  throw new ErrorType(
    code,
    `Repair job is held by active external repair subcontract ${activeSubcontract.id}`,
    {
      repairSubcontractId: Number(activeSubcontract.id),
      subcontractStatus: activeSubcontract.status,
      providerName: activeSubcontract.providerName || null,
    }
  );
}

module.exports = {
  assertRepairNotHeldByActiveSubcontract,
};
