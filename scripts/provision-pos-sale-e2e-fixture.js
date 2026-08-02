'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const APPROVAL = 'ALPHATECH_POS_SALE_E2E_FIXTURE';
const envPath = path.join(process.cwd(), '.env.restore');

if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
assertTestDatabaseAuthority({ targetUrl, env: process.env, requiresWriteApproval: true });

if (process.env.POS_SALE_E2E_FIXTURE_APPROVAL !== APPROVAL) {
  throw new Error(`Set POS_SALE_E2E_FIXTURE_APPROVAL=${APPROVAL} before provisioning POS Sale E2E data.`);
}

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} in .env.restore.`);
  return value;
};

const operatorEmail = required('POS_SALE_E2E_OPERATOR_EMAIL').toLowerCase();
const operatorPassword = required('POS_SALE_E2E_OPERATOR_PASSWORD');
const fixtureHash = crypto.createHash('sha256').update(operatorEmail).digest('hex').slice(0, 10);
const branchSlug = `system-test-pos-sale-${fixtureHash}`;
const productBarcode = `E2E-POS-PRODUCT-${fixtureHash}`;

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../lib/prisma');

async function main() {
  const runToken = crypto.randomBytes(8).toString('hex').toUpperCase();
  const passwordHash = await bcrypt.hash(operatorPassword, 12);

  const fixture = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.upsert({
      where: { slug: branchSlug },
      update: {},
      create: {
        name: 'System Test POS Sale',
        address: 'SYSTEM TEST ONLY',
        phone: '0000000000',
        slug: branchSlug,
        businessType: 'GENERAL',
        category: {
          connectOrCreate: {
            where: { name: 'System POS Sale E2E' },
            create: { name: 'System POS Sale E2E', active: true, isSystem: true },
          },
        },
      },
      select: { id: true, slug: true },
    });

    const user = await tx.user.upsert({
      where: { email: operatorEmail },
      update: { password: passwordHash, role: 'SUPERADMIN', enabled: true },
      create: { email: operatorEmail, password: passwordHash, role: 'SUPERADMIN', enabled: true },
      select: { id: true },
    });

    const employee = await tx.employeeProfile.upsert({
      where: { userId: user.id },
      update: { branchId: branch.id, approved: true, active: true, v2Role: 'OWNER', name: 'System Test POS Operator' },
      create: {
        userId: user.id,
        branchId: branch.id,
        name: 'System Test POS Operator',
        phone: '0000000000',
        approved: true,
        active: true,
        v2Role: 'OWNER',
      },
      select: { id: true, branchId: true },
    });

    let product = await tx.product.findFirst({
      where: { saleBarcode: productBarcode },
      select: { id: true, saleBarcode: true },
    });
    if (!product) {
      product = await tx.product.create({
        data: {
          name: 'System Test POS Sale Product',
          saleBarcode: productBarcode,
          active: true,
          noSN: false,
          trackSerialNumber: true,
        },
        select: { id: true, saleBarcode: true },
      });
    }

    await tx.branchPrice.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branch.id } },
      update: { isActive: true, costPrice: 100, priceRetail: 107, priceWholesale: 107, priceTechnician: 107 },
      create: {
        productId: product.id,
        branchId: branch.id,
        costPrice: 100,
        priceRetail: 107,
        priceWholesale: 107,
        priceTechnician: 107,
        isActive: true,
        note: 'System POS Sale E2E fixture only',
      },
    });

    const stockItem = await tx.stockItem.create({
      data: {
        barcode: `E2E-POS-STOCK-${fixtureHash}-${runToken}`,
        serialNumber: `E2E-POS-SN-${fixtureHash}-${runToken}`,
        productId: product.id,
        branchId: branch.id,
        status: 'IN_STOCK',
        costPrice: 100,
        source: 'SYSTEM_POS_SALE_E2E',
        remark: 'Test DB only; one fixture stock item per browser E2E run.',
      },
      select: { id: true, barcode: true, status: true },
    });

    return { branch, employee, product, stockItem };
  });

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    fixture: {
      branchId: fixture.branch.id,
      branchSlug: fixture.branch.slug,
      employeeId: fixture.employee.id,
      operatorEmail,
      productId: fixture.product.id,
      productBarcode: fixture.product.saleBarcode,
      stockItemId: fixture.stockItem.id,
      stockBarcode: fixture.stockItem.barcode,
      stockStatus: fixture.stockItem.status,
      expectedRetailTotal: 107,
    },
    retainedTestData: true,
    safety: 'A fresh Test-DB-only stock item is created for every run; no production data is read or written.',
  }));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
