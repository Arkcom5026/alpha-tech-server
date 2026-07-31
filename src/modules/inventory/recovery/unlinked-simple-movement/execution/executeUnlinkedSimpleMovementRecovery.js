const requireText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${field} is required`);
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_APPROVAL_REQUIRED';
    error.details = { field };
    throw error;
  }
  return normalized;
};

const requireExplicitApproval = (approval) => {
  if (approval?.explicitApproval !== true) {
    const error = new Error('Explicit approval is required');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXPLICIT_APPROVAL_REQUIRED';
    throw error;
  }

  return {
    branchId: Number(approval.branchId),
    manifestId: requireText(approval.manifestId, 'manifestId'),
    sourceSnapshotHash: requireText(
      approval.sourceSnapshotHash,
      'sourceSnapshotHash'
    ),
    executionPlanId: requireText(approval.executionPlanId, 'executionPlanId'),
    executionPlanHash: requireText(
      approval.executionPlanHash,
      'executionPlanHash'
    ),
    operatorIdentity: requireText(approval.operatorIdentity, 'operatorIdentity'),
  };
};

const validatePlanAuthority = ({ executionPlan, approval }) => {
  if (!executionPlan || executionPlan.mode !== 'PLAN_ONLY') {
    const error = new Error('A deterministic PLAN_ONLY execution plan is required');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_PLAN_REQUIRED';
    throw error;
  }

  if (
    Number(executionPlan.branchId) !== approval.branchId
    || executionPlan.manifestId !== approval.manifestId
    || executionPlan.sourceSnapshotHash !== approval.sourceSnapshotHash
    || executionPlan.executionPlanId !== approval.executionPlanId
    || executionPlan.executionPlanHash !== approval.executionPlanHash
    || executionPlan.operatorIdentity !== approval.operatorIdentity
  ) {
    const error = new Error('Execution plan authority does not match explicit approval');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_AUTHORITY_MISMATCH';
    throw error;
  }
};

const executeUnlinkedSimpleMovementRecovery = async ({
  executionPlan,
  approval,
  repository,
}) => {
  if (!repository || typeof repository.transaction !== 'function') {
    const error = new Error('Execution repository is required');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_REPOSITORY_REQUIRED';
    throw error;
  }

  const normalizedApproval = requireExplicitApproval(approval);
  if (!Number.isInteger(normalizedApproval.branchId) || normalizedApproval.branchId <= 0) {
    const error = new Error('A positive branchId is required');
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }

  validatePlanAuthority({ executionPlan, approval: normalizedApproval });

  return repository.transaction(async (txRepository) => {
    const revalidation = await txRepository.revalidateExecutionPlan({
      executionPlan,
      approval: normalizedApproval,
    });

    if (!revalidation.manifestMatches || !revalidation.planMatches) {
      const error = new Error('Runtime authority is stale; execution aborted');
      error.code = 'UNLINKED_SIMPLE_MOVEMENT_STALE_RUNTIME_AUTHORITY';
      error.details = revalidation;
      throw error;
    }

    const failedOperations = revalidation.operationResults.filter(
      (result) => result.matches !== true
    );
    if (failedOperations.length > 0) {
      const error = new Error('One or more recovery preconditions no longer match');
      error.code = 'UNLINKED_SIMPLE_MOVEMENT_PRECONDITION_MISMATCH';
      error.details = { failedOperations };
      throw error;
    }

    const operationResults = [];
    for (const operation of executionPlan.operations || []) {
      const lot = await txRepository.createSimpleLot({
        branchId: operation.branchId,
        productId: operation.productId,
        qtyInitial: operation.createLot.qtyInitial,
        qtyRemaining: operation.createLot.qtyRemaining,
        unitCost: operation.createLot.unitCost,
        status: operation.createLot.status,
      });

      const linkResult = await txRepository.linkExistingMovements({
        movementIds: operation.linkExistingMovementIds,
        branchId: operation.branchId,
        productId: operation.productId,
        simpleLotId: lot.id,
      });

      if (Number(linkResult?.count) !== operation.linkExistingMovementIds.length) {
        const error = new Error('Movement link count mismatch; execution aborted');
        error.code = 'UNLINKED_SIMPLE_MOVEMENT_LINK_COUNT_MISMATCH';
        error.details = {
          entryId: operation.entryId,
          expected: operation.linkExistingMovementIds.length,
          actual: Number(linkResult?.count || 0),
        };
        throw error;
      }

      operationResults.push({
        entryId: operation.entryId,
        productId: operation.productId,
        simpleLotId: lot.id,
        linkedMovementIds: operation.linkExistingMovementIds,
        quantity: operation.impact.quantity,
        inventoryValue: operation.impact.inventoryValue,
      });
    }

    const executionAudit = await txRepository.recordExecutionAudit({
      branchId: normalizedApproval.branchId,
      manifestId: normalizedApproval.manifestId,
      sourceSnapshotHash: normalizedApproval.sourceSnapshotHash,
      executionPlanId: normalizedApproval.executionPlanId,
      executionPlanHash: normalizedApproval.executionPlanHash,
      operatorIdentity: normalizedApproval.operatorIdentity,
      operationCount: operationResults.length,
      operationResults,
    });

    return {
      result: 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_EXECUTED',
      mutationPerformed: true,
      branchId: normalizedApproval.branchId,
      manifestId: normalizedApproval.manifestId,
      sourceSnapshotHash: normalizedApproval.sourceSnapshotHash,
      executionPlanId: normalizedApproval.executionPlanId,
      executionPlanHash: normalizedApproval.executionPlanHash,
      operatorIdentity: normalizedApproval.operatorIdentity,
      totals: executionPlan.totals,
      operationResults,
      executionAudit,
    };
  });
};

module.exports = {
  executeUnlinkedSimpleMovementRecovery,
};
