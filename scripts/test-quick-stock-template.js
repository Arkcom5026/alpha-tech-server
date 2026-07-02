// scripts/test-quick-stock-template.js
const { prisma, toNumber, nowCode, logHeader, pass, pickTemplateProduct } = require('./runtime-test-utils');
const QuickStockService = require('../src/modules/quickStock/services/QuickStockService');

async function main() {
  logHeader('P1 Runtime Test: QuickStock Template Intake');

  const targetBranchId = toNumber(process.env.TEST_TARGET_BRANCH_ID, 2);
  const employeeId = toNumber(process.env.TEST_EMPLOYEE_ID, null);
  const unitCost = toNumber(process.env.TEST_UNIT_COST, 123);

  const template = await pickTemplateProduct();
  const barcode = process.env.TEST_BARCODE || nowCode('QS-TPL');

  console.log('Template Product:', template);
  console.log('Target Branch:', targetBranchId);
  console.log('Barcode:', barcode);

  const service = new QuickStockService(prisma);

  const result = await service.quickReceiveExistingProduct(
    {
      productId: template.id,
      movementType: 'RECOVERY_RECEIVE',
      unitCost,
      items: [{ barcode, serialNumber: process.env.TEST_SERIAL_NUMBER || null }],
      note: 'Runtime test: quick stock template intake',
    },
    targetBranchId,
    employeeId
  );

  console.log('\nQuickStock Result:', result);

  if (!result?.success) throw new Error('QuickStock result success=false');
  if (!result?.productId) throw new Error('QuickStock did not return productId');

  const product = await prisma.product.findUnique({
    where: { id: Number(result.productId) },
    select: {
      id: true,
      name: true,
      templateProductId: true,
      productTypeId: true,
      branchPrice: {
        where: { branchId: targetBranchId },
        select: { id: true, branchId: true, priceRetail: true, costPrice: true },
      },
      stockBalances: {
        where: { branchId: targetBranchId },
        select: { quantity: true, reserved: true, lastReceivedCost: true },
      },
    },
  });

  console.log('\nOperational Product:', product);

  if (!product) throw new Error('Operational product not found after QuickStock');
  if (Number(product.templateProductId) !== Number(template.id)) {
    throw new Error(`Expected templateProductId=${template.id}, got ${product.templateProductId}`);
  }
  if (!product.branchPrice?.length) throw new Error('BranchPrice not found for target branch');

  const stockItem = await prisma.stockItem.findFirst({
    where: { barcode },
    select: {
      id: true,
      barcode: true,
      productId: true,
      branchId: true,
      status: true,
      costPrice: true,
      source: true,
      remark: true,
    },
  });

  console.log('\nStockItem:', stockItem);

  if (!stockItem) throw new Error('StockItem was not created');
  if (Number(stockItem.productId) !== Number(product.id)) throw new Error('StockItem productId mismatch');
  if (Number(stockItem.branchId) !== Number(targetBranchId)) throw new Error('StockItem branchId mismatch');

  const movement = await prisma.stockMovement.findFirst({
    where: {
      productId: product.id,
      branchId: targetBranchId,
      note: { contains: barcode },
    },
    orderBy: { id: 'desc' },
    select: { id: true, productId: true, branchId: true, qty: true, type: true, refType: true, note: true },
  });

  console.log('\nStockMovement:', movement);
  if (!movement) throw new Error('StockMovement was not created');

  pass('QuickStock template intake PASS');
}

main()
  .catch((error) => {
    console.error('\n❌ QuickStock template intake FAIL');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
