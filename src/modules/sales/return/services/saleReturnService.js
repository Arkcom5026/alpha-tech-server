const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');
const { buildSaleReturnEligibility } = require('../builders/saleReturnEligibilityBuilder');
const { buildRefundProjection } = require('../builders/saleReturnRefundBuilder');
const {
  buildSerializedReturnMovement,
  buildSimpleReturnMovement,
} = require('../builders/saleReturnMovementBuilder');
const { assertSaleReturnReplayHash } = require('../policies/saleReturnIdempotencyPolicy');
const { assertSerializedReturnable, assertSimpleReturnable } = require('../policies/saleReturnStockPolicy');
const { assertRefundProjection } = require('../policies/saleReturnRefundPolicy');
const { assertCanApproveDeductedRefund } = require('../policies/saleReturnApprovalPolicy');
const {
  findSaleForReturn,
  findCompletionCommand,
  findEmployeeReturnAuthority,
  runSaleReturnTransaction,
  createSaleReturnHeader,
  restoreSerializedItem,
  restoreSimpleItem,
  createRefundEvidence,
  createCompletionCommand,
} = require('../repositories/saleReturnRepository');
const { mapSaleReturnResult } = require('../mappers/saleReturnMapper');
const { generateSaleReturnCode } = require('../utils/saleReturnCode');

const loadSaleReturnEligibility = async ({ saleId, branchId, client }) => {
  const sale = await findSaleForReturn({ saleId, branchId, client });
  if (!sale) {
    throw new SaleReturnError(404, SaleReturnFailureCode.SALE_NOT_FOUND, 'Sale was not found in this branch');
  }
  return buildSaleReturnEligibility(sale);
};

const loadVerifiedReplay = async ({ branchId, commandId, requestHash }) => {
  const stored = await findCompletionCommand({ branchId, commandId });
  if (!stored) return null;
  assertSaleReturnReplayHash({ storedHash: stored.requestHash, requestHash });
  return mapSaleReturnResult({
    saleReturn: stored.saleReturn,
    commandId,
    replayed: true,
  });
};

const completeSaleReturn = async ({ command, branchId, employeeId, actorRole }) => {
  const replay = await loadVerifiedReplay({
    branchId,
    commandId: command.commandId,
    requestHash: command.requestHash,
  });
  if (replay) return replay;

  try {
    await runSaleReturnTransaction(async (tx) => {
      const eligibility = await loadSaleReturnEligibility({
        saleId: command.saleId,
        branchId,
        client: tx,
      });
      const serializedById = new Map(
        eligibility.serializedItems.map((item) => [item.saleItemId, item])
      );
      const simpleById = new Map(
        eligibility.simpleItems.map((item) => [item.saleItemSimpleId, item])
      );

      for (const requested of command.items) {
        if (requested.kind === 'SIMPLE') {
          assertSimpleReturnable(simpleById.get(requested.saleItemSimpleId), requested.quantity);
        } else {
          assertSerializedReturnable(serializedById.get(requested.saleItemId));
        }
      }

      const projection = buildRefundProjection({
        command,
        serializedById,
        simpleById,
      });
      assertRefundProjection({
        command,
        projection,
        paymentItemsById: new Map(
          eligibility.paymentItems.map((item) => [item.paymentItemId, item])
        ),
      });

      const employeeAuthority = projection.deductedAmount.gt(0)
        ? await findEmployeeReturnAuthority({ employeeId, branchId, client: tx })
        : null;
      assertCanApproveDeductedRefund({
        deductedAmount: projection.deductedAmount,
        actorRole,
        employeeRole: employeeAuthority?.v2Role,
      });

      const occurredAt = new Date();
      const saleReturn = await createSaleReturnHeader({
        client: tx,
        code: await generateSaleReturnCode(tx, branchId),
        command,
        branchId,
        employeeId,
        projection,
        occurredAt,
      });

      for (const item of projection.evaluatedItems) {
        if (item.kind === 'SIMPLE') {
          await restoreSimpleItem({
            client: tx,
            item,
            saleReturnId: saleReturn.id,
            branchId,
            occurredAt,
            movement: buildSimpleReturnMovement({
              item,
              saleReturnId: saleReturn.id,
              branchId,
              employeeId,
              occurredAt,
              reason: command.reason,
            }),
          });
        } else {
          const restored = await restoreSerializedItem({
            client: tx,
            item,
            saleReturnId: saleReturn.id,
            branchId,
            occurredAt,
            movement: buildSerializedReturnMovement({
              item,
              saleReturnId: saleReturn.id,
              branchId,
              employeeId,
              occurredAt,
              reason: command.reason,
            }),
          });
          if (!restored) {
            throw new SaleReturnError(
              409,
              SaleReturnFailureCode.STOCK_CONFLICT,
              'Stock changed during return'
            );
          }
        }
      }

      await createRefundEvidence({
        client: tx,
        command,
        saleReturnId: saleReturn.id,
        branchId,
        employeeId,
        occurredAt,
      });
      await createCompletionCommand({
        client: tx,
        branchId,
        command,
        saleReturnId: saleReturn.id,
      });
    });

    const result = await loadVerifiedReplay({
      branchId,
      commandId: command.commandId,
      requestHash: command.requestHash,
    });
    return {
      ...result,
      idempotency: { commandId: command.commandId, replayed: false },
    };
  } catch (error) {
    const raceReplay = await loadVerifiedReplay({
      branchId,
      commandId: command.commandId,
      requestHash: command.requestHash,
    });
    if (raceReplay) return raceReplay;
    if (error?.code === 'P2034' || error?.code === 'P2002') {
      throw new SaleReturnError(
        409,
        SaleReturnFailureCode.COMPLETION_CONFLICT,
        'Return data changed concurrently; refresh eligibility and retry'
      );
    }
    throw error;
  }
};

module.exports = {
  loadSaleReturnEligibility,
  loadVerifiedReplay,
  completeSaleReturn,
};
