//src/modules/product/services/productTemplateEngine/QuickStockService_auto_clone_patch.js

// PATCH: Replace product lookup block in quickReceiveExistingProduct()

let operationalProductId = productId;

let product = await tx.product.findFirst({
  where: {
    id: operationalProductId,
    active: true,
    productType: {
      branchId,
    },
  },
  select: {
    id: true,
    name: true,
    mode: true,
    noSN: true,
    trackSerialNumber: true,
    productTypeId: true,
  },
});

// Auto-clone from Template (T01) if not found in current branch
if (!product) {
  const cloneResult = await cloneProductFromTemplate({
    templateProductId: productId,
    targetBranchId: branchId,
    updatedBy: empId,
    tx,
  });

  operationalProductId = cloneResult.productId;

  product = await tx.product.findFirst({
    where: {
      id: operationalProductId,
      active: true,
      productType: {
        branchId,
      },
    },
    select: {
      id: true,
      name: true,
      mode: true,
      noSN: true,
      trackSerialNumber: true,
      productTypeId: true,
    },
  });
}

if (!product) {
  const err = new Error(
    'ไม่พบสินค้าในสาขาปัจจุบัน และไม่สามารถ Clone จาก Template ได้'
  );
  err.statusCode = 404;
  err.code = 'PRODUCT_NOT_FOUND_OR_TEMPLATE_CLONE_FAILED';
  throw err;
}
