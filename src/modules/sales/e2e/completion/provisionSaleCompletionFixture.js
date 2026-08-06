'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  resolveSaleCompletionE2ERuntimeAuthority,
} = require('./saleCompletionE2ERuntimeAuthority');

const authority = resolveSaleCompletionE2ERuntimeAuthority({ requiresWrite: true });

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} in the selected E2E runtime environment.`);
  return value;
};

const operatorEmail = required('POS_SALE_E2E_OPERATOR_EMAIL').toLowerCase();
const operatorPassword = authority.mayMutateOperatorCredential
  ? required('POS_SALE_E2E_OPERATOR_PASSWORD')
  : null;
const fixtureHash = crypto.createHash('sha256').update(operatorEmail).digest('hex').slice(0, 10);
const dedicatedBranchSlug = `system-test-pos-sale-${fixtureHash}`;
const productBarcode = `E2E-POS-PRODUCT-${fixtureHash}`;

process.env.DATABASE_URL = authority.targetUrl;
process.env.DIRECT_URL = authority.targetUrl;
const { prisma } = require('../../../../../lib/prisma');

async function main() {
  const runToken = crypto.randomBytes(8).toString('hex').toUpperCase();
  const customerDigits = BigInt(`0x${runToken}`).toString().slice(-8).padStart(8, '0');
  const customerPhone = `09${customerDigits}`;
  const customerName = `System Test POS Customer ${runToken}`;

  const fixture = await prisma.$transaction(async (tx) => {
    let branch;
    let employee;

    if (authority.expectedBranch) {
      const user = await tx.user.findUnique({
        where: { email: operatorEmail },
        include: { employeeProfile: true },
      });
      employee = user?.employeeProfile;
      if (!user?.enabled || !employee?.id || !employee.active || !employee.approved) {
        throw new Error('The Main-DB E2E operator must already be enabled, active, and approved.');
      }
      branch = await tx.branch.findUnique({
        where: { id: employee.branchId },
        select: { id: true, slug: true, name: true },
      });
      if (
        !branch
        || branch.id !== authority.expectedBranch.branchId
        || branch.slug !== authority.expectedBranch.branchSlug
      ) {
        throw new Error(
          `Main-DB Sale E2E is fixed to branchId=${authority.expectedBranch.branchId}, `
            + `slug=${authority.expectedBranch.branchSlug}.`
        );
      }
    } else {
      branch = await tx.branch.upsert({
        where: { slug: dedicatedBranchSlug },
        update: {},
        create: {
          name: 'System Test POS Sale',
          address: 'SYSTEM TEST ONLY',
          phone: '0000000000',
          slug: dedicatedBranchSlug,
          businessType: 'GENERAL',
          category: {
            connectOrCreate: {
              where: { name: 'System POS Sale E2E' },
              create: { name: 'System POS Sale E2E', active: true, isSystem: true },
            },
          },
        },
        select: { id: true, slug: true, name: true },
      });

      const passwordHash = await bcrypt.hash(operatorPassword, 12);
      const user = await tx.user.upsert({
        where: { email: operatorEmail },
        update: { password: passwordHash, role: 'ADMIN', enabled: true },
        create: { email: operatorEmail, password: passwordHash, role: 'ADMIN', enabled: true },
        select: { id: true },
      });
      employee = await tx.employeeProfile.upsert({
        where: { userId: user.id },
        update: {
          branchId: branch.id,
          approved: true,
          active: true,
          v2Role: 'OWNER',
          name: 'System Test POS Operator',
        },
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
    }

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
      update: {
        isActive: true,
        costPrice: 100,
        priceRetail: 107,
        priceWholesale: 107,
        priceTechnician: 107,
      },
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
        remark: `${authority.environment} retained fixture; one stock item per Browser E2E run.`,
      },
      select: { id: true, barcode: true, status: true },
    });

    return { branch, employee, product, stockItem };
  });

  console.log(JSON.stringify({
    result: 'PASS',
    environment: authority.environment,
    runtimeAuthority: authority.target,
    runToken,
    fixture: {
      branchId: fixture.branch.id,
      branchSlug: fixture.branch.slug,
      employeeId: fixture.employee.id,
      operatorEmail,
      customerName,
      customerPhone,
      productId: fixture.product.id,
      productBarcode: fixture.product.saleBarcode,
      stockItemId: fixture.stockItem.id,
      stockBarcode: fixture.stockItem.barcode,
      stockStatus: fixture.stockItem.status,
      expectedRetailTotal: 107,
    },
    browserEnvironment: {
      E2E_TEST_USERNAME: operatorEmail,
      POS_SALE_E2E_BRANCH_ID: String(fixture.branch.id),
      POS_SALE_E2E_BRANCH_SLUG: fixture.branch.slug,
      POS_SALE_E2E_STOCK_BARCODE: fixture.stockItem.barcode,
      POS_SALE_E2E_EXPECTED_RETAIL_TOTAL: '107',
      POS_SALE_E2E_CUSTOMER_NAME: customerName,
      POS_SALE_E2E_CUSTOMER_PHONE: customerPhone,
      POS_SALE_E2E_RUN_TOKEN: runToken,
    },
    retainedTestData: true,
    safety: authority.expectedBranch
      ? 'Creates a fresh sale stock item only inside the fixed Main-DB test tenant; operator credentials are unchanged.'
      : 'Creates fresh dedicated-Test-DB stock; the customer is created only through the real POS Browser flow.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`POS_SALE_E2E_FIXTURE_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
