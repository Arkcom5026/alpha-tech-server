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

  const mismatch = [];
  if (executionPlanId !== approvedPlanId) {
    mismatch.push({
      code: 'EXECUTION_PLAN_ID_MISMATCH',
      expected: approvedPlanId,
      actual: executionPlanId,
    });
  }
  if (executionPlanHash !== approvedPlanHash) {
    mismatch.push({
      code: 'EXECUTION_PLAN_HASH_MISMATCH',
      expected: approvedPlanHash,
      actual: executionPlanHash,
    });
  }
  if (mismatch.length > 0) {
    throw createExecutionError(
      'SIMPLE_STOCK_BACKFILL_EXECUTION_APPROVAL_MISMATCH',
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

  const operations = Array.isArray(executionPlan.operations)
    ? executionPlan.operations
    : [];

  return {
    branchId,
    executionPlanId,
    executionPlanHash,
    operatorIdentity,
    operations,
  };
};

const buildMutationCommands = ({ executionPlan, approval }) => {
  const validated = validateExecutionPlan({ executionPlan, approval });

  const commands = validated.operations.map((operation, index) => {
    const actions = Array.isArray(operation.actions) ? operation.actions : [];
    const createLot = actions.find((action) => action.action === 'CREATE_SIMPLE_LOT');
    const createMovement = actions.find(
      (action) => action.action === 'CREATE_STOCK_MOVEMENT'
    );

    if (!createLot || !createMovement) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_EXECUTION_ACTIONS_INVALID',
        `Operation ${operation.entryId || index} must contain lot and movement actions`
      );
    }

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

    const productIdMatch = entryId.match(/product-(\d+)|balance-(\d+)/);
    const productId = Number(
      createLot.payload?.productId ||
      createMovement.payload?.productId ||
      operation.productId ||
      productIdMatch?.[1]
    );

    if (!Number.isInteger(productId) || productId <= 0) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_PRODUCT_ID_REQUIRED',
        `Operation ${entryId} must contain productId`
      );
    }

    if (Number(createLot.payload?.branchId) !== validated.branchId) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_BRANCH_MISMATCH',
        `Operation ${entryId} is outside the approved branch`
      );
    }

    if (quantity !== qtyInitial) {
      throw createExecutionError(
        'SIMPLE_STOCK_BACKFILL_EXECUTION_QUANTITY_MISMATCH',
        `Operation ${entryId} must initialize and retain the same quantity`
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
        qty: requirePositiveNumber(
          createMovement.payload?.qty,
          'SIMPLE_STOCK_BACKFILL_EXECUTION_MOVEMENT_QTY_INVALID',
          'movement.qty'
        ),
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
    executionPlanId: validated.executionPlanId,
    executionPlanHash: validated.executionPlanHash,
    commandCount: commands.length,
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

module.exports = {
  EXECUTION_VERSION,
  validateExecutionPlan,
  buildMutationCommands,
};
