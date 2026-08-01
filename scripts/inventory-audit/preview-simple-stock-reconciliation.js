#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const readBranchId = () => {
  const raw = process.argv.find((arg) => arg.startsWith('--branch-id='));
  const branchId = Number.parseInt(String(raw || '').split('=')[1], 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new Error('Usage: node scripts/inventory-audit/preview-simple-stock-reconciliation.js --branch-id=<positive integer>');
  }
  return branchId;
};

const classifyBackfill = ({ balance, productLots, productMovements, difference }) => {
  const quantity = toNumber(balance?.quantity);
  const avgCost = toNumber(balance?.avgCost);
  const lastReceivedCost = toNumber(balance?.lastReceivedCost);
  const usableCost = avgCost > 0 ? avgCost : lastReceivedCost > 0 ? lastReceivedCost : null;

  if (quantity > 0 && productLots.length === 0 && productMovements.length === 0 && difference === quantity) {
    if (usableCost) {
      return {
        classification: 'READY_FOR_PREVIEW_BACKFILL',
        reason: 'Positive legacy StockBalance exists without SimpleLot or SimpleLot movement history, and a usable balance cost is available.',
        proposedLot: {
          qtyInitial: quantity,
          qtyRemaining: quantity,
          unitCost: usableCost,
          costSource: avgCost > 0 ? 'STOCK_BALANCE_AVG_COST' : 'STOCK_BALANCE_LAST_RECEIVED_COST',
          status: 'ACTIVE',
          source: 'LEGACY_BACKFILL_PREVIEW',
        },
      };
    }

    return {
      classification: 'BLOCKED_MISSING_COST',
      reason: 'Positive legacy StockBalance exists without SimpleLot or SimpleLot movement history, but no defensible positive cost is available.',
      proposedLot: {
        qtyInitial: quantity,
        qtyRemaining: quantity,
        unitCost: null,
        costSource: null,
        status: 'ACTIVE',
        source: 'LEGACY_BACKFILL_PREVIEW',
      },
    };
  }

  return {
    classification: 'REQUIRES_MANUAL_REVIEW',
    reason: 'Existing lot or movement evidence, non-positive balance, or a mixed reconciliation state prevents deterministic legacy backfill.',
    proposedLot: null,
  };
};

const main = async () => {
  const branchId = readBranchId();

  const [balances, lots, movements] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { branchId },
      select: {
        id: true,
        productId: true,
        quantity: true,
        reserved: true,
        avgCost: true,
        lastReceivedCost: true,
        product: { select: { id: true, name: true, mode: true, inventoryBehavior: true } },
      },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    }),
    prisma.simpleLot.findMany({
      where: { branchId },
      select: {
        id: true,
        productId: true,
        barcode: true,
        status: true,
        qtyInitial: true,
        qtyRemaining: true,
        unitCost: true,
        receivedAt: true,
      },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    }),
    prisma.stockMovement.findMany({
      where: { branchId, simpleLotId: { not: null } },
      select: {
        id: true,
        productId: true,
        simpleLotId: true,
        type: true,
        qty: true,
        refType: true,
        refId: true,
        note: true,
        createdAt: true,
      },
      orderBy: [{ productId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const balanceByProduct = new Map(balances.map((row) => [row.productId, row]));
  const lotsByProduct = new Map();
  const movementsByProduct = new Map();

  for (const lot of lots) {
    const rows = lotsByProduct.get(lot.productId) || [];
    rows.push(lot);
    lotsByProduct.set(lot.productId, rows);
  }

  for (const movement of movements) {
    const rows = movementsByProduct.get(movement.productId) || [];
    rows.push(movement);
    movementsByProduct.set(movement.productId, rows);
  }

  const productIds = [...new Set([
    ...balances.map((row) => row.productId),
    ...lots.map((row) => row.productId),
  ])].sort((a, b) => a - b);

  const products = productIds.map((productId) => {
    const balance = balanceByProduct.get(productId) || null;
    const productLots = lotsByProduct.get(productId) || [];
    const productMovements = movementsByProduct.get(productId) || [];
    const activeLots = productLots.filter((lot) => lot.status === 'ACTIVE' && toNumber(lot.qtyRemaining) > 0);
    const lotRemaining = activeLots.reduce((sum, lot) => sum + toNumber(lot.qtyRemaining), 0);
    const balanceQuantity = toNumber(balance?.quantity);
    const difference = balanceQuantity - lotRemaining;
    const missingCostLots = activeLots.filter((lot) => toNumber(lot.unitCost) <= 0);
    const movementNet = productMovements.reduce((sum, movement) => sum + toNumber(movement.qty), 0);
    const backfillPreview = classifyBackfill({
      balance,
      productLots,
      productMovements,
      difference,
    });

    return {
      productId,
      productName: balance?.product?.name || null,
      productMode: balance?.product?.mode || null,
      inventoryBehavior: balance?.product?.inventoryBehavior || null,
      stockBalance: balance ? {
        id: balance.id,
        quantity: balanceQuantity,
        reserved: toNumber(balance.reserved),
        avgCost: toNumber(balance.avgCost),
        lastReceivedCost: toNumber(balance.lastReceivedCost),
      } : null,
      lotSummary: {
        activeLotCount: activeLots.length,
        activeQtyRemaining: lotRemaining,
        allLotCount: productLots.length,
        missingCostLotCount: missingCostLots.length,
        missingCostQuantity: missingCostLots.reduce((sum, lot) => sum + toNumber(lot.qtyRemaining), 0),
      },
      reconciliationDifference: difference,
      movementSummary: {
        movementCount: productMovements.length,
        netQuantity: movementNet,
        byType: productMovements.reduce((acc, movement) => {
          const key = String(movement.type || 'UNKNOWN');
          acc[key] = toNumber(acc[key]) + toNumber(movement.qty);
          return acc;
        }, {}),
      },
      backfillPreview,
      lots: productLots,
      movements: productMovements,
    };
  });

  const contributors = products.filter((row) => row.reconciliationDifference !== 0 || row.lotSummary.missingCostLotCount > 0);
  const totals = products.reduce((acc, row) => {
    acc.balanceQuantity += toNumber(row.stockBalance?.quantity);
    acc.activeLotRemaining += toNumber(row.lotSummary.activeQtyRemaining);
    acc.reconciliationDifference += toNumber(row.reconciliationDifference);
    acc.missingCostLotCount += toNumber(row.lotSummary.missingCostLotCount);
    acc.missingCostQuantity += toNumber(row.lotSummary.missingCostQuantity);
    return acc;
  }, {
    balanceQuantity: 0,
    activeLotRemaining: 0,
    reconciliationDifference: 0,
    missingCostLotCount: 0,
    missingCostQuantity: 0,
  });

  const classificationSummary = contributors.reduce((acc, row) => {
    const key = row.backfillPreview.classification;
    const current = acc[key] || { productCount: 0, quantity: 0 };
    current.productCount += 1;
    current.quantity += toNumber(row.backfillPreview.proposedLot?.qtyRemaining);
    acc[key] = current;
    return acc;
  }, {});

  const report = {
    mode: 'PREVIEW_ONLY',
    mutationPerformed: false,
    branchId,
    generatedAt: new Date().toISOString(),
    formula: 'StockBalance.quantity - SUM(ACTIVE SimpleLot.qtyRemaining)',
    totals,
    classificationSummary,
    contributorCount: contributors.length,
    contributors,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[simple-stock-reconciliation-preview] FAIL', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof prisma?.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });
