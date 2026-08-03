'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const args = process.argv.slice(2);
const runtimeMode = args[0] === '--runtime';
const values = runtimeMode ? args.slice(1) : args;
const receiptId = Number(values[0]);
const expectedBranchId = Number(values[1]);
const expectations = values.slice(2).map((value) => {
  const [barcode, rawSerial = 'NULL'] = String(value).split(':');
  return {
    barcode: String(barcode || '').trim(),
    serialNumber: String(rawSerial || '').toUpperCase() === 'NULL' ? null : String(rawSerial).trim(),
  };
}).filter((item) => item.barcode);

if (!Number.isInteger(receiptId) || receiptId <= 0) {
  throw new Error('Usage: node scripts/verify-stock-receipt-e2e-outcome.js [--runtime] <receiptId> <branchId> <barcode:serial|NULL> [...]');
}
if (!Number.isInteger(expectedBranchId) || expectedBranchId <= 0) {
  throw new Error('Expected branchId must be a positive integer.');
}
if (!expectations.length) {
  throw new Error('At least one barcode expectation is required.');
}

let targetUrl;
let authority;

if (runtimeMode) {
  if (process.env.ALLOW_MAIN_DATABASE_READONLY_VERIFICATION !== 'YES') {
    throw new Error('Runtime DB verification requires ALLOW_MAIN_DATABASE_READONLY_VERIFICATION=YES.');
  }

  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
  targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) throw new Error('DATABASE_URL is missing for runtime verification.');

  const parsed = new URL(targetUrl);
  authority = {
    mode: 'RUNTIME_READ_ONLY',
    target: {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, '') || null,
      projectRef: parsed.hostname.split('.')[1] || null,
    },
  };
} else {
  const envPath = path.join(process.cwd(), '.env.restore');
  if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');

  dotenv.config({ path: envPath, override: true });
  targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
  const authorityEnv = { ...process.env };
  delete authorityEnv.DATABASE_URL;
  delete authorityEnv.DIRECT_URL;
  authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });
}

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../lib/prisma');

const outputAuthority = () => ({
  mode: authority.mode || 'TEST_DATABASE',
  host: authority.target.host,
  port: authority.target.port,
  database: authority.target.database,
  projectRef: authority.target.projectRef,
});

const finish = (result, details) => {
  console.log(JSON.stringify({
    result,
    databaseModified: false,
    transactionReadOnly: true,
    authority: outputAuthority(),
    receiptId,
    expectedBranchId,
    ...details,
  }, null, 2));
  if (result !== 'PASS') process.exitCode = 2;
};

async function verify(tx) {
  const receipt = await tx.purchaseOrderReceipt.findUnique({
    where: { id: receiptId },
    select: { id: true, branchId: true, code: true },
  });

  if (!receipt) return finish('FAIL', { message: 'Purchase receipt was not found.' });
  if (receipt.branchId !== expectedBranchId) {
    return finish('FAIL', {
      message: 'Receipt branch does not match expected tenant.',
      receipt,
    });
  }

  const barcodes = expectations.map((item) => item.barcode);
  const rows = await tx.barcodeReceiptItem.findMany({
    where: { barcode: { in: barcodes } },
    select: {
      id: true,
      barcode: true,
      branchId: true,
      receiptItemId: true,
      status: true,
      stockItemId: true,
      receiptItem: {
        select: {
          id: true,
          receiptId: true,
          productId: true,
          purchaseOrderItem: { select: { productId: true } },
        },
      },
      stockItem: {
        select: {
          id: true,
          barcode: true,
          serialNumber: true,
          branchId: true,
          productId: true,
          status: true,
          purchaseOrderReceiptItemId: true,
        },
      },
    },
  });

  const rowByBarcode = new Map(rows.map((row) => [row.barcode, row]));
  const failures = [];
  const evidence = [];

  for (const expected of expectations) {
    const row = rowByBarcode.get(expected.barcode);
    if (!row) {
      failures.push({ barcode: expected.barcode, reason: 'BARCODE_RECEIPT_ITEM_NOT_FOUND' });
      continue;
    }

    const productId = row.receiptItem?.productId || row.receiptItem?.purchaseOrderItem?.productId || row.stockItem?.productId || null;
    const itemFailures = [];

    if (row.branchId !== expectedBranchId) itemFailures.push('BARCODE_BRANCH_MISMATCH');
    if (row.receiptItem?.receiptId !== receiptId) itemFailures.push('RECEIPT_LINK_MISMATCH');
    if (String(row.status || '').toUpperCase() !== 'SN_RECEIVED') itemFailures.push('BARCODE_STATUS_NOT_RECEIVED');
    if (!row.stockItem) itemFailures.push('STOCK_ITEM_MISSING');

    if (row.stockItem) {
      if (row.stockItem.branchId !== expectedBranchId) itemFailures.push('STOCK_ITEM_BRANCH_MISMATCH');
      if (row.stockItem.barcode !== expected.barcode) itemFailures.push('STOCK_ITEM_BARCODE_MISMATCH');
      if ((row.stockItem.serialNumber ?? null) !== expected.serialNumber) itemFailures.push('SERIAL_NUMBER_MISMATCH');
      if (row.stockItem.purchaseOrderReceiptItemId !== row.receiptItemId) itemFailures.push('RECEIPT_ITEM_LINK_MISMATCH');
      if (row.stockItem.status !== 'IN_STOCK') itemFailures.push('STOCK_ITEM_NOT_IN_STOCK');
    }

    const balance = productId
      ? await tx.stockBalance.findUnique({
          where: { productId_branchId: { productId, branchId: expectedBranchId } },
          select: { productId: true, branchId: true, quantity: true, reserved: true },
        })
      : null;
    if (!balance) itemFailures.push('STOCK_BALANCE_MISSING');

    const movements = row.stockItem
      ? await tx.stockMovement.findMany({
          where: {
            branchId: expectedBranchId,
            productId: row.stockItem.productId,
            type: 'RECEIVE',
            OR: [
              { stockItemId: row.stockItem.id },
              { refType: 'PURCHASE_RECEIPT', refId: receiptId },
            ],
          },
          orderBy: { occurredAt: 'desc' },
          take: 20,
          select: {
            id: true,
            branchId: true,
            productId: true,
            stockItemId: true,
            qty: true,
            type: true,
            refType: true,
            refId: true,
            occurredAt: true,
          },
        })
      : [];
    if (!movements.length) itemFailures.push('RECEIVE_STOCK_MOVEMENT_MISSING');

    if (itemFailures.length) failures.push({ barcode: expected.barcode, reasons: itemFailures });
    evidence.push({ expected, barcodeReceiptItem: row, stockBalance: balance, receiveMovements: movements });
  }

  if (failures.length) {
    return finish('FAIL', {
      message: 'Stock receipt post-condition verification failed.',
      receipt,
      failures,
      evidence,
    });
  }

  return finish('PASS', {
    message: 'Stock receipt post-conditions are complete and tenant-consistent.',
    receipt,
    evidence,
  });
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await verify(tx);
  }, { timeout: 30000 });
}

main()
  .catch((error) => {
    console.error(`STOCK_RECEIPT_E2E_OUTCOME_VERIFICATION_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
