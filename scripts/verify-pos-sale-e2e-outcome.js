'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const barcode = String(process.argv[2] || '').trim();
const expectedCustomerPhone = String(process.argv[3] || '').replace(/\D/g, '');
if (!barcode) {
  require('../tests/pos-sale-e2e-outcome.contract.test');
  console.log('POS Sale E2E runtime outcome: SKIP (stock barcode not supplied; contract verified).');
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
    stockBarcode: barcode,
    expectedCustomerPhone: expectedCustomerPhone || null,
    message,
    details,
  }, null, 2));
  process.exitCode = 2;
};

async function main() {
  const stockItem = await prisma.stockItem.findUnique({
    where: { barcode },
    select: {
      id: true,
      barcode: true,
      branchId: true,
      status: true,
      soldAt: true,
      saleItems: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          saleId: true,
          sale: {
            select: {
              id: true,
              branchId: true,
              customerId: true,
              status: true,
              paid: true,
              statusPayment: true,
              totalAmount: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  user: { select: { loginId: true } },
                },
              },
            },
          },
        },
      },
      stockMovements: {
        where: { type: 'SALE' },
        orderBy: { occurredAt: 'desc' },
        take: 10,
        select: {
          id: true,
          branchId: true,
          qty: true,
          refType: true,
          refId: true,
          stockItemId: true,
        },
      },
    },
  });

  if (!stockItem) return fail('Fixture stock item was not found.');
  if (stockItem.status !== 'SOLD') return fail('Fixture stock item is not SOLD.', { status: stockItem.status });

  const saleItem = stockItem.saleItems.find((item) => item.sale?.branchId === stockItem.branchId);
  if (!saleItem?.sale) return fail('No same-branch SaleItem evidence was found.', {
    stockBranchId: stockItem.branchId,
    saleItems: stockItem.saleItems,
  });

  const sale = saleItem.sale;
  if (sale.status !== 'COMPLETED' || sale.paid !== true || sale.statusPayment !== 'PAID') {
    return fail('Sale completion/payment evidence is incomplete.', {
      saleId: sale.id,
      status: sale.status,
      paid: sale.paid,
      statusPayment: sale.statusPayment,
    });
  }

  if (!sale.customerId || sale.customer?.id !== sale.customerId) {
    return fail('Sale customer evidence is missing or inconsistent.', {
      saleId: sale.id,
      customerId: sale.customerId,
      customer: sale.customer,
    });
  }

  const persistedPhone = String(sale.customer?.user?.loginId || '').replace(/\D/g, '');
  if (expectedCustomerPhone && persistedPhone !== expectedCustomerPhone) {
    return fail('Sale customer phone does not match the Browser fixture.', {
      saleId: sale.id,
      customerId: sale.customerId,
      expectedCustomerPhone,
      persistedPhone,
    });
  }

  const movement = stockItem.stockMovements.find((item) => (
    item.branchId === stockItem.branchId
    && item.stockItemId === stockItem.id
    && item.refType === 'SALE'
    && item.refId === sale.id
    && Number(item.qty) === -1
  ));
  if (!movement) return fail('No matching SALE stock-movement evidence was found.', {
    stockItemId: stockItem.id,
    stockBranchId: stockItem.branchId,
    saleId: sale.id,
    movements: stockItem.stockMovements,
  });

  console.log(JSON.stringify({
    result: 'PASS',
    databaseModified: false,
    authority: {
      host: authority.target.host,
      port: authority.target.port,
      database: authority.target.database,
      projectRef: authority.target.projectRef,
    },
    stock: {
      id: stockItem.id,
      barcode: stockItem.barcode,
      branchId: stockItem.branchId,
      status: stockItem.status,
      soldAt: stockItem.soldAt,
    },
    sale: {
      id: sale.id,
      branchId: sale.branchId,
      customerId: sale.customerId,
      status: sale.status,
      paid: sale.paid,
      statusPayment: sale.statusPayment,
      totalAmount: Number(sale.totalAmount),
    },
    customer: {
      id: sale.customer.id,
      name: sale.customer.name,
      phone: persistedPhone,
      branchEvidenceSaleId: sale.id,
    },
    movement: {
      id: movement.id,
      branchId: movement.branchId,
      qty: Number(movement.qty),
      refType: movement.refType,
      refId: movement.refId,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`POS_SALE_E2E_OUTCOME_VERIFICATION_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
