// scripts/test-product-template-clone.js
const { prisma, toNumber, logHeader, pass, pickTemplateProduct } = require('./runtime-test-utils');
const { cloneProductFromTemplate } = require('../src/modules/product/services/productTemplateEngine');

async function inspectClone(productId, targetBranchId) {
  return prisma.product.findUnique({
    where: { id: Number(productId) },
    select: {
      id: true,
      name: true,
      templateProductId: true,
      productTypeId: true,
      brandId: true,
      unitId: true,
      branchPrice: {
        where: { branchId: Number(targetBranchId) },
        select: {
          id: true,
          branchId: true,
          costPrice: true,
          priceRetail: true,
          priceOnline: true,
          priceTechnician: true,
          priceWholesale: true,
          isActive: true,
        },
      },
      productImages: {
        select: { id: true, url: true, secure_url: true, public_id: true, isCover: true, active: true },
      },
    },
  });
}

async function main() {
  logHeader('P1 Runtime Test: Product Template Clone');

  const targetBranchId = toNumber(process.env.TEST_TARGET_BRANCH_ID, 2);
  const template = await pickTemplateProduct();

  console.log('Template Product:', template);
  console.log('Target Branch:', targetBranchId);

  const result1 = await cloneProductFromTemplate({
    templateProductId: template.id,
    targetBranchId,
    updatedBy: null,
  });

  console.log('\nClone Result 1:', result1);
  if (!result1?.ok || !result1?.productId) throw new Error('Clone failed: invalid result');

  const clonedProduct = await inspectClone(result1.productId, targetBranchId);
  console.log('\nCloned Product:', clonedProduct);

  if (!clonedProduct) throw new Error('Cloned product not found');
  if (Number(clonedProduct.templateProductId) !== Number(template.id)) throw new Error('templateProductId mismatch');
  if (!clonedProduct.branchPrice?.length) throw new Error('BranchPrice was not cloned');

  const result2 = await cloneProductFromTemplate({
    templateProductId: template.id,
    targetBranchId,
    updatedBy: null,
  });

  console.log('\nClone Result 2:', result2);
  if (result2?.cloned !== false) throw new Error('Duplicate guard failed');

  pass('Product template clone PASS');
}

main()
  .catch((error) => {
    console.error('\n❌ Product template clone FAIL');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
