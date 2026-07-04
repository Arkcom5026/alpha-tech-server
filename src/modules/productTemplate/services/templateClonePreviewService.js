// src/modules/productTemplate/services/templateClonePreviewService.js
// Mission C — Clone Preview Foundation

const { TEMPLATE_BRANCH_CODE } = require('../../product/services/productTemplateEngine/constants');
const { validateTemplate } = require('../../product/services/productTemplateEngine/validateTemplate');

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const findExistingClone = async (prisma, { templateProductId, targetBranchId }) => {
  return prisma.product.findFirst({
    where: {
      templateProductId: Number(templateProductId),
      branchPrice: { some: { branchId: Number(targetBranchId) } },
    },
    select: { id: true, name: true, active: true },
  });
};

const getClonePreview = async (prisma, {
  templateProductId,
  targetBranchId,
  templateBranchCode = TEMPLATE_BRANCH_CODE,
} = {}) => {
  const tplId = toPositiveInt(templateProductId);
  const branchId = toPositiveInt(targetBranchId);

  if (!tplId) {
    const err = new Error('INVALID_TEMPLATE_PRODUCT_ID');
    err.statusCode = 400;
    err.code = 'INVALID_TEMPLATE_PRODUCT_ID';
    throw err;
  }

  if (!branchId) {
    const err = new Error('INVALID_TARGET_BRANCH_ID');
    err.statusCode = 400;
    err.code = 'INVALID_TARGET_BRANCH_ID';
    throw err;
  }

  const targetBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, branchCode: true, slug: true },
  });

  if (!targetBranch) {
    const err = new Error('TARGET_BRANCH_NOT_FOUND');
    err.statusCode = 404;
    err.code = 'TARGET_BRANCH_NOT_FOUND';
    throw err;
  }

  const { templateBranch, templateProduct } = await validateTemplate(prisma, {
    templateProductId: tplId,
    templateBranchCode,
  });

  const existingClone = await findExistingClone(prisma, {
    templateProductId: templateProduct.id,
    targetBranchId: branchId,
  });

  const targetProductType = await prisma.productType.findFirst({
    where: {
      branchId,
      globalProductTypeId: templateProduct.productType?.globalProductTypeId || null,
    },
    select: { id: true, name: true, branchId: true, globalProductTypeId: true },
  });

  const priceSnapshot = templateProduct.branchPrice?.[0] || null;

  return {
    ok: true,
    canClone: !existingClone && Number(templateBranch.id) !== branchId,
    alreadyCloned: !!existingClone,
    existingProduct: existingClone,
    templateBranch,
    targetBranch,
    templateProduct: {
      id: templateProduct.id,
      name: templateProduct.name,
      productTypeId: templateProduct.productTypeId,
      brandId: templateProduct.brandId,
      categoryId: templateProduct.categoryId,
      unitId: templateProduct.unitId,
      warrantyDays: templateProduct.warrantyDays,
      mode: templateProduct.mode,
      noSN: templateProduct.noSN,
      trackSerialNumber: templateProduct.trackSerialNumber,
      imageCount: templateProduct.productImages?.length || 0,
    },
    mapping: {
      productType: {
        sourceId: templateProduct.productTypeId,
        targetId: targetProductType?.id || null,
        action: targetProductType ? 'REUSE_EXISTING' : 'CREATE_FROM_TEMPLATE',
      },
      brand: {
        sourceId: templateProduct.brandId || null,
        action: templateProduct.brandId ? 'MAP_BY_PRODUCT_TYPE_BRAND' : 'NONE',
      },
      images: {
        count: templateProduct.productImages?.length || 0,
        action: templateProduct.productImages?.length ? 'CLONE_ACTIVE_IMAGES' : 'NONE',
      },
      priceSnapshot: {
        hasSnapshot: !!priceSnapshot,
        action: priceSnapshot ? 'COPY_TO_TARGET_BRANCH_PRICE' : 'CREATE_DEFAULT_BRANCH_PRICE',
      },
    },
  };
};

module.exports = { getClonePreview };
