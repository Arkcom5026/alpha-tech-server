const { prisma } = require('../../../../lib/prisma')

const selectOperationalRuntimeProduct = (branchId) => ({
  id: true,
  active: true,
  name: true,
  mode: true,
  noSN: true,
  trackSerialNumber: true,
  templateProductId: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductType: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  branchPrice: {
    where: { branchId },
    take: 1,
    select: {
      id: true,
      branchId: true,
      costPrice: true,
      priceRetail: true,
      priceOnline: true,
      priceWholesale: true,
      priceTechnician: true,
      isActive: true,
    },
  },
  stockItems: {
    where: { branchId, status: 'IN_STOCK' },
    take: 1,
    select: { id: true },
  },
  stockBalances: {
    where: { branchId },
    take: 1,
    select: {
      quantity: true,
      reserved: true,
      lastReceivedCost: true,
    },
  },
})

const selectOperationalProductDetail = (branchId) => ({
  id: true,
  name: true,
  mode: true,
  noSN: true,
  trackSerialNumber: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductType: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  productImages: {
    where: { active: true },
    orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
    select: { id: true, url: true, secure_url: true, caption: true, isCover: true },
  },
  branchPrice: {
    where: { branchId },
    take: 1,
    select: {
      costPrice: true,
      priceWholesale: true,
      priceTechnician: true,
      priceRetail: true,
      priceOnline: true,
      isActive: true,
    },
  },
  stockBalances: {
    where: { branchId },
    take: 1,
    select: { quantity: true, reserved: true, lastReceivedCost: true },
  },
  stockItems: {
    where: { branchId, status: 'IN_STOCK' },
    select: { id: true },
    take: 1,
  },
})

const selectOperationalOnlineProduct = (branchId) => ({
  id: true,
  name: true,
  mode: true,
  noSN: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductType: {
        select: {
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  productImages: {
    where: { isCover: true, active: true },
    take: 1,
    select: { secure_url: true, url: true },
  },
  branchPrice: {
    where: { branchId },
    take: 1,
    select: { priceOnline: true, isActive: true },
  },
  stockItems: {
    where: { branchId, status: 'IN_STOCK' },
    select: { id: true },
    take: 1,
  },
  stockBalances: {
    where: { branchId },
    take: 1,
    select: { quantity: true, reserved: true },
  },
})

const fetchOperationalRuntimeProduct = (productId, branchId, db = prisma) => (
  db.product.findFirst({
    where: { id: Number(productId), active: true, productType: { branchId: Number(branchId) } },
    select: selectOperationalRuntimeProduct(Number(branchId)),
  })
)

const withDb = (db = prisma) => db


const findOperationalRuntimeProductByTemplateId = ({
  branchId,
  templateProductId,
  db = prisma,
}) => (
  db.product.findFirst({
    where: {
      active: true,
      templateProductId: Number(templateProductId),
      productType: { branchId: Number(branchId) },
    },
    select: selectOperationalRuntimeProduct(Number(branchId)),
    orderBy: { id: 'desc' },
  })
)

const findOperationalProductDetailById = ({
  branchId,
  productId,
  db = prisma,
}) => (
  db.product.findFirst({
    where: {
      id: Number(productId),
      productType: { branchId: Number(branchId) },
    },
    select: selectOperationalProductDetail(Number(branchId)),
  })
)

const findOperationalProductList = ({
  branchId,
  where,
  take,
  skip,
  db = prisma,
}) => (
  db.product.findMany({
    where,
    select: selectOperationalRuntimeProduct(Number(branchId)),
    take,
    skip,
    orderBy: { id: 'desc' },
  })
)

const findOperationalOnlineProductList = ({
  branchId,
  where,
  take,
  skip,
  db = prisma,
}) => (
  db.product.findMany({
    where,
    select: selectOperationalOnlineProduct(Number(branchId)),
    take,
    skip,
    orderBy: { id: 'desc' },
  })
)

const findOperationalOnlineProductDetailById = ({
  branchId,
  productId,
  db = prisma,
}) => (
  db.product.findFirst({
    where: {
      id: Number(productId),
      productType: { branchId: Number(branchId) },
    },
    select: selectOperationalOnlineProduct(Number(branchId)),
  })
)

const findStockItemByBarcode = ({
  branchId,
  barcode,
  db = prisma,
}) => (
  db.stockItem.findFirst({
    where: {
      branchId: Number(branchId),
      barcode,
      product: { productType: { branchId: Number(branchId) } },
    },
    include: { product: true },
  })
)

const findStockItemBySerialNumber = ({
  branchId,
  serialNumber,
  db = prisma,
}) => (
  db.stockItem.findFirst({
    where: {
      branchId: Number(branchId),
      serialNumber,
      product: { productType: { branchId: Number(branchId) } },
    },
    include: { product: true },
  })
)



const transaction = (callback, options = { timeout: 15000 }, db = prisma) => (
  db.$transaction(callback, options)
)

const findBranchProductTypeForCreate = ({
  branchId,
  productTypeId,
  db = prisma,
}) => (
  db.productType.findFirst({
    where: {
      id: Number(productTypeId),
      branchId: Number(branchId),
    },
    select: {
      id: true,
      globalProductType: { select: { categoryId: true } },
    },
  })
)

const createLocalOperationalProductRecord = ({
  data,
  db = prisma,
}) => (
  db.product.create({
    data,
    select: { id: true },
  })
)

const upsertBranchPriceForProduct = ({
  productId,
  branchId,
  data,
  db = prisma,
}) => (
  db.branchPrice.upsert({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    update: data,
    create: {
      productId: Number(productId),
      branchId: Number(branchId),
      ...data,
    },
  })
)

const autoLearnProductTypeBrandRelation = async ({
  productTypeId,
  brandId,
  db = prisma,
}) => {
  const ptId = Number(productTypeId)
  const brId = Number(brandId)

  if (!ptId || !brId) return

  try {
    await db.productTypeBrand.create({
      data: {
        productTypeId: ptId,
        brandId: brId,
      },
    })
  } catch (error) {
    if (error?.code === 'P2002') return
    throw error
  }
}

const findTemplateBranchByCode = ({
  branchCode = 'T01',
  db = prisma,
}) => (
  db.branch.findFirst({
    where: { branchCode },
    select: { id: true },
  })
)

const findTemplateProductForClone = ({
  templateProductId,
  templateBranchId,
  db = prisma,
}) => (
  db.product.findFirst({
    where: {
      id: Number(templateProductId),
      active: true,
      productType: { branchId: Number(templateBranchId) },
    },
    select: {
      id: true,
      name: true,
      mode: true,
      noSN: true,
      trackSerialNumber: true,
      brandId: true,
      unitId: true,
      productType: {
        select: {
          globalProductTypeId: true,
        },
      },
    },
  })
)

const findBranchProductTypeByGlobalProductTypeId = ({
  branchId,
  globalProductTypeId,
  db = prisma,
}) => (
  db.productType.findFirst({
    where: {
      branchId: Number(branchId),
      globalProductTypeId,
    },
    select: {
      id: true,
      globalProductType: { select: { categoryId: true } },
    },
  })
)

const createOperationalProductRecordFromTemplate = ({
  data,
  db = prisma,
}) => (
  db.product.create({
    data,
    select: { id: true },
  })
)


module.exports = {
  withDb,
  transaction,
  createLocalOperationalProductRecord,
  upsertBranchPriceForProduct,
  autoLearnProductTypeBrandRelation,
  findBranchProductTypeForCreate,
  findTemplateBranchByCode,
  findTemplateProductForClone,
  findBranchProductTypeByGlobalProductTypeId,
  createOperationalProductRecordFromTemplate,
  fetchOperationalRuntimeProduct,
  findOperationalRuntimeProductByTemplateId,
  findOperationalProductDetailById,
  findOperationalProductList,
  findOperationalOnlineProductList,
  findOperationalOnlineProductDetailById,
  findStockItemByBarcode,
  findStockItemBySerialNumber,
  selectOperationalRuntimeProduct,
  selectOperationalProductDetail,
  selectOperationalOnlineProduct,
}
