'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const receiptId = Number(process.argv[2]);
const expectedBranchId = Number(process.argv[3]);
const barcodes = process.argv.slice(4).map((value) => String(value || '').trim()).filter(Boolean);

if (!Number.isInteger(receiptId) || receiptId <= 0) {
  throw new Error('Usage: node scripts/repair-stock-receipt-receive-movements.js <receiptId> <branchId> <barcode> [...]');
}
if (!Number.isInteger(expectedBranchId) || expectedBranchId <= 0) {
  throw new Error('branchId must be a positive integer.');
}
if (!barcodes.length) {
  throw new Error('At least one barcode is required.');
}
if (process.env.ALLOW_MAIN_DATABASE_STOCK_RECEIPT_REPAIR !== 'YES') {
  throw new Error('Blocked: set ALLOW_MAIN_DATABASE_STOCK_RECEIPT_REPAIR=YES to approve this scoped repair.');
}
if (process.env.CONFIRM_STOCK_RECEIPT_REPAIR_SCOPE !== `${receiptId}:${expectedBranchId}:${barcodes.join(',')}`) {
  throw new Error('Blocked: CONFIRM_STOCK_RECEIPT_REPAIR_SCOPE does not exactly match the requested scope.');
}

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) throw new Error('Missing .env runtime configuration.');
dotenv.config({ path: envPath, override: false });

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');

const { prisma } = require('../lib/prisma');

const connectionAuthority = () => {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return {
      mode: 'RUNTIME_SCOPED_REPAIR',
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, '') || null,
    };
  } catch (_) {
    return { mode: 'RUNTIME_SCOPED_REPAIR', host: 'unparsed', port: null, database: null };
  }
};

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId: expectedBranchId },
      select: { id: true, branchId: true, code: true },
    });
    if (!receipt) throw new Error('Receipt not found in the approved branch scope.');

    const rows = await tx.barcodeReceiptItem.findMany({
      where: { barcode: { in: barcodes } },
      select: {
        id: true,
        barcode: true,
        branchId: true,
        status: true,
        receiptItemId: true,
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
            branchId: true,
            productId: true,
            status: true,
            purchaseOrderReceiptItemId: true,
          },
        },
      },
    });

    const rowByBarcode = new Map(rows.map((row) => [row.barcode, row]));
    const repaired = [];
    const skipped = [];

    for (const barcode of barcodes) {
      const row = rowByBarcode.get(barcode);
      if (!row) throw new Error(`BarcodeReceiptItem not found: ${barcode}`);
      if (row.branchId !== expectedBranchId) throw new Error(`Branch mismatch for barcode ${barcode}`);
      if (row.receiptItem?.receiptId !== receiptId) throw new Error(`Receipt link mismatch for barcode ${barcode}`);
      if (String(row.status || '').toUpperCase() !== 'SN_RECEIVED') throw new Error(`Barcode is not received: ${barcode}`);
      if (!row.stockItem) throw new Error(`StockItem missing for barcode ${barcode}`);
      if (row.stockItem.branchId !== expectedBranchId) throw new Error(`StockItem branch mismatch for barcode ${barcode}`);
      if (row.stockItem.barcode !== barcode) throw new Error(`StockItem barcode mismatch for ${barcode}`);
      if (row.stockItem.purchaseOrderReceiptItemId !== row.receiptItemId) throw new Error(`Receipt item link mismatch for ${barcode}`);
      if (row.stockItem.status !== 'IN_STOCK') throw new Error(`StockItem is not IN_STOCK for ${barcode}`);

      const productId = row.stockItem.productId || row.receiptItem?.productId || row.receiptItem?.purchaseOrderItem?.productId;
      if (!productId) throw new Error(`Product missing for barcode ${barcode}`);

      const existing = await tx.stockMovement.findFirst({
        where: {
          branchId: expectedBranchId,
          productId,
          stockItemId: row.stockItem.id,
          type: 'RECEIVE',
          refType: 'PURCHASE_RECEIPT',
          refId: receiptId,
        },
        select: { id: true },
      });

      if (existing) {
        skipped.push({ barcode, stockItemId: row.stockItem.id, movementId: existing.id, reason: 'ALREADY_EXISTS' });
        continue;
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          branchId: expectedBranchId,
          qty: 1,
          type: 'RECEIVE',
          stockItemId: row.stockItem.id,
          refType: 'PURCHASE_RECEIPT',
          refId: receiptId,
          note: `Controlled repair: missing RECEIVE movement for barcode ${barcode}`,
        },
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
      });

      repaired.push({ barcode, movement });
    }

    return { receipt, repaired, skipped };
  }, { timeout: 20000 });

  console.log(JSON.stringify({
    result: 'PASS',
    databaseModified: result.repaired.length > 0,
    authority: connectionAuthority(),
    approvedScope: { receiptId, branchId: expectedBranchId, barcodes },
    ...result,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      result: 'FAIL',
      databaseModified: false,
      authority: connectionAuthority(),
      approvedScope: { receiptId, branchId: expectedBranchId, barcodes },
      message: error.message || String(error),
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
