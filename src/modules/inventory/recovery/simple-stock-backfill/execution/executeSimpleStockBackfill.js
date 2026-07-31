const EXECUTION_VERSION = 'simple-stock-backfill-execution-v1';

const createExecutionError = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const requireText = (value, code, label) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw createExecutionError(code, `${label} is required`);
  }
  return normalized;
};

const requirePositiveInteger = (value, code, label) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createExecutionError(code, `${label} must be a positive integer`);
  }
  return normalized;
};

const requirePositiveNumber = (value, code, label) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createExecutionError(code, `${label} must be greater than zero`);
  }
  return normalized;
};

const validateExecutionPlan = ({ executionPlan, approval }) => {
  if (!executionPlan || typeof executionPlan !== 'object') {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_REQUIRED',
      'executionPlan is required'
    );
  }

  if (approval?.explicitApproval !== true) {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXPLICIT_APPROVAL_REQUIRED',
      'Explicit approval is required before mutation'
    );
  }

  if (executionPlan.mode !== 'PLAN_ONLY' || executionPlan.mutationPerformed !== false) {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_MODE_INVALID',
      'Only an unmutated PLAN_ONLY execution plan is accepted'
    );
  }

  if (executionPlan.executable !== false || executionPlan.approvedForMutation !== false) {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_SAFETY_INVALID',
      'Execution plan safety contract is invalid'
    );
  }

  const branchId = requirePositiveInteger(
    executionPlan.branchId,
    'INVENTORY_BRANCH_SCOPE_REQUIRED',
    'branchId'
  );
  const executionPlanId = requireText(
    executionPlan.executionPlanId,
    'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_ID_REQUIRED',
    'executionPlanId'
  );
  const executionPlanHash = requireText(
    executionPlan.executionPlanHash,
    'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_HASH_REQUIRED',
    'executionPlanHash'
  );
  const operatorIdentity = requireText(
    approval?.operatorIdentity,
    'SIMPLE_STOCK_BACKFILL_OPERATOR_REQUIRED',
    'operatorIdentity'
  );
  const approvedPlanId = requireText(
    approval?.executionPlanId,
    'SIMPLE_STOCK_BACKFILL_APPROVED_PLAN_ID_REQUIRED',
    'approval.executionPlanId'
  );
  const approvedPlanHash = requireText(
    approval?.executionPlanHash,
    'SIMPLE_STOCK_BACKFILL_APPROVED_PLAN_HASH_REQUIRED',
    'approval.executionPlanHash'
  );
  const approvedManifestId = requireText(
    approval?.manifestId,
    'SIMPLE_STOCK_BACKFILL_APPROVED_MANIFEST_ID_REQUIRED',
    'approval.manifestId'
  );
  const approvedSnapshotHash = requireText(
    approval?.sourceSnapshotHash,
    'SIMPLE_STOCK_BACKFILL_APPROVED_SNAPSHOT_HASH_REQUIRED',
    'approval.sourceSnapshotHash'
  );

  const mismatch = [];
  if (executionPlanId !== approvedPlanId) {
    mismatch.push({ code: 'EXECUTION_PLAN_ID_MISMATCH', expected: approvedPlanId, actual: executionPlanId });
  }
  if (executionPlanHash !== approvedPlanHash) {
    mismatch.push({ code: 'EXECUTION_PLAN_HASH_MISMATCH', expected: approvedPlanHash, actual: executionPlanHash });
  }
  if (executionPlan.sourceApproval?.manifestId !== approvedManifestId) {
    mismatch.push({ code: 'MANIFEST_ID_MISMATCH', expected: approvedManifestId, actual: executionPlan.sourceApproval?.manifestId || null });
  }
  if (executionPlan.sourceApproval?.sourceSnapshotHash !== approvedSnapshotHash) {
    mismatch.push({ code: 'SOURCE_SNAPSHOT_HASH_MISMATCH', expected: approvedSnapshotHash, actual: executionPlan.sourceApproval?.sourceSnapshotHash || null });
  }
  if (mismatch.length > 0) {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_APPROVAL_MISMATCH',
      'Approved execution plan does not match the current plan',
      mismatch
    );
  }

  const guards = executionPlan.executionGuards || {};
  if (
    guards.revalidateManifestBeforeExecution !== true ||
    guards.revalidateEveryPreconditionHash !== true ||
    guards.abortOnAnyDrift !== true ||
    guards.transactionRequired !== true ||
    guards.partialCommitAllowed !== false
  ) {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_GUARDS_INVALID',
      'Execution guards are incomplete'
    );
  }

  return {
    branchId,
    executionPlanId,
    executionPlanHash,
    operatorIdentity,
    manifestId: approvedManifestId,
    sourceSnapshotHash: approvedSnapshotHash,
    operations: Array.isArray(executionPlan.operations) ? executionPlan.operations : [],
    blockedEntries: Array.isArray(executionPlan.blockedEntries) ? executionPlan.blockedEntries : [],
  };
};

const buildMutationCommands = ({ executionPlan, approval }) => {
  const validated = validateExecutionPlan({ executionPlan, approval });

  const commands = validated.operations.map((operation, index) => {
    const actions = Array.isArray(operation.actions) ? operation.actions : [];
    const createLot = actions.find((action) => action.action === 'CREATE_SIMPLE_LOT');
    const createMovement = actions.find((action) => action.action === 'CREATE_STOCK_MOVEMENT');

    if (!createLot || !createMovement) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_EXECUTION_ACTIONS_INVALID',
        `Operation ${operation.entryId || index} must contain lot and movement actions`
      );
    }

    const entryId = requireText(
      operation.entryId,
      'SIMPLE_STOCK_BACKFILL_ENTRY_ID_REQUIRED',
      'entryId'
    );
    const preconditionHash = requireText(
      operation.preconditionHash,
      'SIMPLE_STOCK_BACKFILL_PRECONDITION_HASH_REQUIRED',
      'preconditionHash'
    );
    const productId = requirePositiveInteger(
      operation.productId,
      'SIMPLE_STOCK_BACKFILL_PRODUCT_ID_REQUIRED',
      'productId'
    );
    const quantity = requirePositiveNumber(
      createLot.payload?.qtyRemaining,
      'SIMPLE_STOCK_BACKFILL_EXECUTION_QUANTITY_INVALID',
      'qtyRemaining'
    );
    const qtyInitial = requirePositiveNumber(
      createLot.payload?.qtyInitial,
      'SIMPLE_STOCK_BACKFILL_EXECUTION_QUANTITY_INVALID',
      'qtyInitial'
    );
    const unitCost = requirePositiveNumber(
      createLot.payload?.unitCost,
      'SIMPLE_STOCK_BACKFILL_EXECUTION_COST_INVALID',
      'unitCost'
    );
    const movementQty = requirePositiveNumber(
      createMovement.payload?.qty,
      'SIMPLE_STOCK_BACKFILL_EXECUTION_MOVEMENT_QTY_INVALID',
      'movement.qty'
    );

    if (
      Number(operation.branchId) !== validated.branchId ||
      Number(createLot.payload?.branchId) !== validated.branchId ||
      Number(createMovement.payload?.branchId) !== validated.branchId
    ) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_BRANCH_MISMATCH',
        `Operation ${entryId} is outside the approved branch`
      );
    }

    if (
      Number(createLot.payload?.productId) !== productId ||
      Number(createMovement.payload?.productId) !== productId
    ) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_PRODUCT_AUTHORITY_MISMATCH',
        `Operation ${entryId} has inconsistent product authority`
      );
    }

    if (quantity !== qtyInitial || movementQty !== quantity) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_EXECUTION_QUANTITY_MISMATCH',
        `Operation ${entryId} quantities must match`
      );
    }

    return {
      sequence: index + 1,
      entryId,
      productId,
      branchId: validated.branchId,
      preconditionHash,
      lot: {
        qtyInitial,
        qtyRemaining: quantity,
        unitCost,
        status: createLot.payload?.status || 'ACTIVE',
      },
      movement: {
        qty: movementQty,
        type: requireText(
          createMovement.payload?.type,
          'SIMPLE_STOCK_BACKFILL_EXECUTION_MOVEMENT_TYPE_REQUIRED',
          'movement.type'
        ),
        refType: createMovement.payload?.refType || 'SIMPLE_STOCK_BACKFILL',
        note: createMovement.payload?.note || `Legacy backfill ${entryId}`,
      },
    };
  });

  return {
    executionVersion: EXECUTION_VERSION,
    mode: 'EXECUTION_COMMANDS_READY',
    mutationPerformed: false,
    executable: true,
    approvedForMutation: true,
    branchId: validated.branchId,
    operatorIdentity: validated.operatorIdentity,
    manifestId: validated.manifestId,
    sourceSnapshotHash: validated.sourceSnapshotHash,
    executionPlanId: validated.executionPlanId,
    executionPlanHash: validated.executionPlanHash,
    commandCount: commands.length,
    blockedEntryCount: validated.blockedEntries.length,
    commands,
    transactionContract: {
      isolationLevel: 'Serializable',
      allOrNothing: true,
      partialCommitAllowed: false,
      revalidateBeforeFirstWrite: true,
      revalidateEveryPreconditionHash: true,
    },
  };
};

const executeSimpleStockBackfill = async ({ executionPlan, approval, repository }) => {
  if (!repository || typeof repository.transaction !== 'function') {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_REPOSITORY_REQUIRED',
      'A transactional execution repository is required'
    );
  }

  const commandSet = buildMutationCommands({ executionPlan, approval });

  return repository.transaction(async (tx) => {
    const revalidation = await tx.revalidateExecutionPlan({
      executionPlan,
      approval,
      commandSet,
    });

    const operationResults = Array.isArray(revalidation?.operationResults)
      ? revalidation.operationResults
      : [];
    const hasDrift =
      revalidation?.manifestMatches !== true ||
      revalidation?.planMatches !== true ||
      operationResults.length !== commandSet.commands.length ||
      operationResults.some((entry) => entry.matches !== true);

    if (hasDrift) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_PRECONDITION_DRIFT',
        'Current inventory state no longer matches the approved execution plan',
        revalidation || null
      );
    }

    const executedEntries = [];
    let totalQuantity = 0;
    let totalInventoryValue = 0;

    for (const command of commandSet.commands) {
      const lot = await tx.createSimpleLot({
        productId: command.productId,
        branchId: command.branchId,
        qtyInitial: command.lot.qtyInitial,
        qtyRemaining: command.lot.qtyRemaining,
        unitCost: command.lot.unitCost,
        status: command.lot.status,
      });

      const movement = await tx.createStockMovement({
        productId: command.productId,
        branchId: command.branchId,
        qty: command.movement.qty,
        type: command.movement.type,
        refType: command.movement.refType,
        note: command.movement.note,
        simpleLotId: lot.id,
        performedByEmployeeId: approval.performedByEmployeeId || null,
      });

      totalQuantity += command.lot.qtyRemaining;
      totalInventoryValue += command.lot.qtyRemaining * command.lot.unitCost;
      executedEntries.push({
        entryId: command.entryId,
        productId: command.productId,
        preconditionHash: command.preconditionHash,
        simpleLotId: lot.id,
        stockMovementId: movement.id,
        quantity: command.lot.qtyRemaining,
        unitCost: command.lot.unitCost,
      });
    }

    const audit = await tx.recordExecutionAudit({
      executionVersion: EXECUTION_VERSION,
      branchId: commandSet.branchId,
      operatorIdentity: commandSet.operatorIdentity,
      executionPlanId: commandSet.executionPlanId,
      executionPlanHash: commandSet.executionPlanHash,
      manifestId: commandSet.manifestId,
      sourceSnapshotHash: commandSet.sourceSnapshotHash,
      executedEntryCount: executedEntries.length,
      skippedBlockedEntryCount: commandSet.blockedEntryCount,
      totalQuantity,
      totalInventoryValue,
      executedEntries,
    });

    return {
      executionVersion: EXECUTION_VERSION,
      mode: 'EXECUTED',
      mutationPerformed: true,
      branchId: commandSet.branchId,
      operatorIdentity: commandSet.operatorIdentity,
      executionPlanId: commandSet.executionPlanId,
      executionPlanHash: commandSet.executionPlanHash,
      manifestId: commandSet.manifestId,
      sourceSnapshotHash: commandSet.sourceSnapshotHash,
      executedEntryCount: executedEntries.length,
      createdLotCount: executedEntries.length,
      createdMovementCount: executedEntries.length,
      skippedBlockedEntryCount: commandSet.blockedEntryCount,
      totalQuantity,
      totalInventoryValue,
      audit,
      executedEntries,
    };
  });
};

module.exports = {
  EXECUTION_VERSION,
  validateExecutionPlan,
  buildMutationCommands,
  executeSimpleStockBackfill,
};
