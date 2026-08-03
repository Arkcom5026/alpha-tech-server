'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const returnCode = String(process.argv[2] || '').trim();
if (!returnCode) {
  require('../tests/pos-sale-return-e2e-outcome.contract.test');
  console.log('POS Sale Return E2E runtime outcome: SKIP (return code not supplied; contract verified).');
  return;
}

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');

dotenv.config({ path: envPath, override: true });
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../lib/prisma');

const fail = (message, details = {}) => {
  console.log(JSON.stringify({
    result: 'FAIL',
    databaseModified: false,
    authority: {
      host: authority.target.host,
      port: authority.target.port,
      database: authority.target.database,
      projectRef: authority.target.projectRef,
    },
    returnCode,
    message,
    details,
  }, null, 2));
  process.exitCode = 2;
};

const money = (value) => Number(value || 0);

async function main() {
  const saleReturn = await prisma.saleReturn.findUnique({
    where: { code: returnCode },
    select: {
      id: true,
      code: true,
      branchId: true,
      saleId: true,
      status: true,
      reason: true,
      returnedAt: true,
      stockRestoredAt: true,
      completedAt: true,
      refundedAmount: true,
      deductedAmount: true,
      sale: { select: { id: true, branchId: true } },
      items: {
        select: {
          id: true,
          saleItemId: true,
          refundAmount: true,
          saleItem: {
            select: {
              id: true,
              stockItem: {
                select: { id: true, branchId: true, status: true },
              },
            },
          },
        },
      },
      saleReturnItemSimples: {
        select: {
          id: true,
          saleItemSimpleId: true,
          quantity: true,
          refundAmount: true,
        },
      },
      refundTransaction: {
        select: {
          id: true,
          branchId: true,
          amount: true,
          method: true,
          sourcePaymentItemId: true,
        },
      },
      completionCommand: {
        select: { id: true, branchId: true, commandKey: true, requestHash: true },
      },
    },
  });

  if (!saleReturn) return fail('Sale Return was not found.');
  if (saleReturn.sale?.branchId !== saleReturn.branchId) {
    return fail('Sale Return and source Sale are not in the same branch.', {
      saleReturnBranchId: saleReturn.branchId,
      saleBranchId: saleReturn.sale?.branchId,
    });
  }
  if (saleReturn.status !== 'COMPLETED' || !saleReturn.stockRestoredAt || !saleReturn.completedAt) {
    return fail('Sale Return completion or stock-restoration evidence is incomplete.', {
      status: saleReturn.status,
      stockRestoredAt: saleReturn.stockRestoredAt,
      completedAt: saleReturn.completedAt,
    });
  }
  if (!saleReturn.completionCommand || saleReturn.completionCommand.branchId !== saleReturn.branchId) {
    return fail('Completion-command tenant evidence is missing or inconsistent.');
  }
  if (!saleReturn.items.length && !saleReturn.saleReturnItemSimples.length) {
    return fail('Sale Return contains no returned line.');
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      branchId: saleReturn.branchId,
      refType: 'SALE_RETURN',
      refId: saleReturn.id,
      type: 'RETURN',
    },
    select: {
      id: true,
      branchId: true,
      qty: true,
      refType: true,
      refId: true,
      stockItemId: true,
      simpleLotId: true,
    },
  });

  for (const line of saleReturn.items) {
    const stock = line.saleItem?.stockItem;
    if (!stock || stock.branchId !== saleReturn.branchId || stock.status !== 'IN_STOCK') {
      return fail('Returned serialized StockItem was not restored to IN_STOCK in the same branch.', {
        saleReturnItemId: line.id,
        stock,
      });
    }
    const movement = movements.find((entry) => (
      entry.stockItemId === stock.id
      && Number(entry.qty) === 1
      && entry.refType === 'SALE_RETURN'
      && entry.refId === saleReturn.id
    ));
    if (!movement) return fail('Serialized return movement is missing.', {
      saleReturnItemId: line.id,
      stockItemId: stock.id,
      movements,
    });
  }

  const simpleMovementTotal = movements
    .filter((entry) => entry.simpleLotId !== null)
    .reduce((total, entry) => total + money(entry.qty), 0);
  const simpleReturnTotal = saleReturn.saleReturnItemSimples
    .reduce((total, line) => total + money(line.quantity), 0);
  if (simpleMovementTotal + 0.0001 < simpleReturnTotal) {
    return fail('Simple-item return movement evidence is incomplete.', {
      simpleMovementTotal,
      simpleReturnTotal,
      movements,
    });
  }

  const refundTotal = saleReturn.refundTransaction
    .reduce((total, refund) => total + money(refund.amount), 0);
  if (Math.abs(refundTotal - money(saleReturn.refundedAmount)) > 0.0001) {
    return fail('Refund evidence does not equal the accepted refunded amount.', {
      refundTotal,
      refundedAmount: money(saleReturn.refundedAmount),
    });
  }
  if (saleReturn.refundTransaction.some((refund) => refund.branchId !== saleReturn.branchId)) {
    return fail('Refund evidence crosses the Sale Return branch.');
  }

  console.log(JSON.stringify({
    result: 'PASS',
    databaseModified: false,
    authority: {
      host: authority.target.host,
      port: authority.target.port,
      database: authority.target.database,
      projectRef: authority.target.projectRef,
    },
    saleReturn: {
      id: saleReturn.id,
      code: saleReturn.code,
      branchId: saleReturn.branchId,
      saleId: saleReturn.saleId,
      status: saleReturn.status,
      reason: saleReturn.reason,
      returnedAt: saleReturn.returnedAt,
      refundedAmount: money(saleReturn.refundedAmount),
      deductedAmount: money(saleReturn.deductedAmount),
    },
    serialized: saleReturn.items.map((line) => ({
      saleReturnItemId: line.id,
      saleItemId: line.saleItemId,
      stockItemId: line.saleItem.stockItem.id,
      stockStatus: line.saleItem.stockItem.status,
    })),
    simple: saleReturn.saleReturnItemSimples.map((line) => ({
      saleReturnItemSimpleId: line.id,
      saleItemSimpleId: line.saleItemSimpleId,
      quantity: money(line.quantity),
    })),
    refunds: saleReturn.refundTransaction.map((refund) => ({
      id: refund.id,
      branchId: refund.branchId,
      amount: money(refund.amount),
      method: refund.method,
      sourcePaymentItemId: refund.sourcePaymentItemId,
    })),
    movements,
    completionCommand: {
      id: saleReturn.completionCommand.id,
      branchId: saleReturn.completionCommand.branchId,
      commandKey: saleReturn.completionCommand.commandKey,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`POS_SALE_RETURN_E2E_OUTCOME_VERIFICATION_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
