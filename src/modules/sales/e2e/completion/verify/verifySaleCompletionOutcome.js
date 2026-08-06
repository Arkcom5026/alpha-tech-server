'use strict';

/**
 * Sale Completion E2E Post-condition Verifier
 *
 * Read-only verification against the real Test DB. The caller must inject the
 * Prisma client used by the selected runtime; this module never creates,
 * updates, or deletes business data.
 */

function assertPositiveInteger(value, name) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return numericValue;
}

function collectProductIds(sale) {
  const ids = [
    ...(sale.items || []).map((item) => item.productId),
    ...(sale.simpleItems || []).map((item) => item.productId),
  ]
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(ids)];
}

async function verifySaleCompletionOutcome({ prisma, saleId, branchId }) {
  if (!prisma?.sale || !prisma?.payment || !prisma?.stockMovement) {
    throw new TypeError('A Prisma client with sale, payment, and stockMovement delegates is required');
  }

  const normalizedSaleId = assertPositiveInteger(saleId, 'saleId');
  const normalizedBranchId = assertPositiveInteger(branchId, 'branchId');

  const sale = await prisma.sale.findFirst({
    where: {
      id: normalizedSaleId,
      branchId: normalizedBranchId,
    },
    include: {
      items: true,
      simpleItems: true,
      completionCommand: true,
    },
  });

  if (!sale) {
    throw new Error(
      `Sale completion evidence not found for saleId=${normalizedSaleId}, branchId=${normalizedBranchId}`
    );
  }

  const payments = await prisma.payment.findMany({
    where: {
      saleId: normalizedSaleId,
      branchId: normalizedBranchId,
    },
  });

  const productIds = collectProductIds(sale);
  const stockMovements = productIds.length > 0
    ? await prisma.stockMovement.findMany({
        where: {
          branchId: normalizedBranchId,
          productId: { in: productIds },
          createdAt: { gte: sale.soldAt },
        },
      })
    : [];

  const itemCount = (sale.items?.length || 0) + (sale.simpleItems?.length || 0);
  const checks = {
    sale: true,
    branchIsolation: sale.branchId === normalizedBranchId,
    items: itemCount > 0,
    payment: payments.length > 0,
    completionCommand: Boolean(sale.completionCommand),
    inventory: productIds.length === 0 || stockMovements.length > 0,
    receipt: Boolean(sale.code),
  };

  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  if (failedChecks.length > 0) {
    throw new Error(
      `Sale completion post-condition failed: ${failedChecks.join(', ')} `
        + `(saleId=${normalizedSaleId}, branchId=${normalizedBranchId})`
    );
  }

  return {
    status: 'PASS',
    saleId: normalizedSaleId,
    branchId: normalizedBranchId,
    saleCode: sale.code,
    soldAt: sale.soldAt,
    itemCount,
    paymentCount: payments.length,
    stockMovementCount: stockMovements.length,
    completionCommandId: sale.completionCommand?.id || null,
    checks,
  };
}

module.exports = Object.freeze({
  verifySaleCompletionOutcome,
});
