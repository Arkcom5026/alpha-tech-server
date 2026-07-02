src/modules/product/services/productCloneService.js
// src/modules/product/services/productCloneService.js
// Clone Product from Template Branch (T01) into target operational branch.
// CommonJS only.

const { prisma, Prisma } = require('../../../lib/prisma')

const TEMPLATE_BRANCH_CODE = 'T01'

const toInt = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const productHasField = (fieldName) => {
  try {
    const model = Prisma?.dmmf?.datamodel?.models?.find((m) => m.name === 'Product')
    return !!model?.fields?.some((f) => f.name === fieldName)
  } catch {
    return false
  }
}

const PRODUCT_HAS_TEMPLATE_PRODUCT_ID = productHasField('templateProductId')

const getTemplateBranch = async (db = prisma, branchCode = TEMPLATE_BRANCH_CODE) => {
  const branch = await db.branch.findFirst({
    where: { branchCode },
    select: {
      id: true,
      name: true,
      branchCode: true,
      features: true,
    },
  })

  if (!branch) {
    throw Object.assign(new Error('TEMPLATE_BRANCH_NOT_FOUND'), {
      status: 404,
      code: 'TEMPLATE_BRANCH_NOT_FOUND',
    })
  }

  return branch
}

const ensureTargetProductType = async (tx, templateProductTypeId, targetBranchId) => {
  const templateType = await tx.productType.findUnique({
    where: { id: Number(templateProductTypeId) },
    select: {
      id: true,
      name: true,
      active: true,
      globalProductTypeId: true,
      branchId: true,
    },
  })

  if (!templateType) {
    throw Object.assign(new Error('TEMPLATE_PRODUCT_TYPE_NOT_FOUND'), {
      status: 404,
      code: 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND',
    })
  }

  const existing = await tx.productType.findFirst({
    where: {
      branchId: Number(targetBranchId),
      globalProductTypeId: templateType.globalProductTypeId,
      name: templateType.name,
    },
    select: { id: true },
  })

  if (existing?.id) return existing.id

  const created = await tx.productType.create({
    data: {
      name: templateType.name,
      active: typeof templateType.active === 'boolean' ? templateType.active : true,
      globalProductTypeId: templateType.globalProductTypeId,
      branchId: Number(targetBranchId),
    },
    select: { id: true },
  })

  return created.id
}

const cloneProductTypeBrandMapping = async (tx, templateProductTypeId, targetProductTypeId) => {
  const mappings = await tx.productTypeBrand.findMany({
    where: { productTypeId: Number(templateProductTypeId) },
    select: { brandId: true },
  })

  for (const m of mappings) {
    try {
      await tx.productTypeBrand.create({
        data: {
          productTypeId: Number(targetProductTypeId),
          brandId: Number(m.brandId),
        },
      })
    } catch (e) {
      if (e?.code !== 'P2002') throw e
    }
  }
}

const findExistingBranchProduct = async (tx, {
  templateProduct,
  targetBranchId,
  targetProductTypeId,
}) => {
  if (PRODUCT_HAS_TEMPLATE_PRODUCT_ID) {
    const foundByTemplate = await tx.product.findFirst({
      where: {
        templateProductId: Number(templateProduct.id),
        branchPrice: {
          some: { branchId: Number(targetBranchId) },
        },
      },
      select: { id: true },
    })

    if (foundByTemplate?.id) return foundByTemplate
  }

  return tx.product.findFirst({
    where: {
      name: templateProduct.name,
      productTypeId: Number(targetProductTypeId),
      brandId: templateProduct.brandId ?? null,
      unitId: templateProduct.unitId ?? null,
      branchPrice: {
        some: { branchId: Number(targetBranchId) },
      },
    },
    select: { id: true },
  })
}

const cloneProductFromTemplate = async ({
  templateProductId,
  targetBranchId,
  templateBranchCode = TEMPLATE_BRANCH_CODE,
  updatedBy = null,
  forceNew = false,
} = {}) => {
  const tplProductId = toInt(templateProductId)
  const branchId = toInt(targetBranchId)

  if (!tplProductId) {
    throw Object.assign(new Error('INVALID_TEMPLATE_PRODUCT_ID'), {
      status: 400,
      code: 'INVALID_TEMPLATE_PRODUCT_ID',
    })
  }

  if (!branchId) {
    throw Object.assign(new Error('INVALID_TARGET_BRANCH_ID'), {
      status: 400,
      code: 'INVALID_TARGET_BRANCH_ID',
    })
  }

  return prisma.$transaction(async (tx) => {
    const templateBranch = await getTemplateBranch(tx, templateBranchCode)

    if (Number(templateBranch.id) === Number(branchId)) {
      throw Object.assign(new Error('TARGET_BRANCH_CANNOT_BE_TEMPLATE_BRANCH'), {
        status: 400,
        code: 'TARGET_BRANCH_CANNOT_BE_TEMPLATE_BRANCH',
      })
    }

    const templateProduct = await tx.product.findFirst({
      where: {
        id: tplProductId,
        branchPrice: {
          some: { branchId: Number(templateBranch.id) },
        },
      },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        active: true,
        productTypeId: true,
        categoryId: true,
        brandId: true,
        unitId: true,
        productImages: {
          where: { active: true },
          orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
          select: {
            url: true,
            public_id: true,
            secure_url: true,
            caption: true,
            isCover: true,
            active: true,
          },
        },
        branchPrice: {
          where: { branchId: Number(templateBranch.id) },
          take: 1,
          select: {
            effectiveDate: true,
            expiredDate: true,
            costPrice: true,
            priceOnline: true,
            priceRetail: true,
            priceTechnician: true,
            priceWholesale: true,
            isActive: true,
          },
        },
      },
    })

    if (!templateProduct) {
      throw Object.assign(new Error('TEMPLATE_PRODUCT_NOT_FOUND_OR_NOT_IN_TEMPLATE_BRANCH'), {
        status: 404,
        code: 'TEMPLATE_PRODUCT_NOT_FOUND_OR_NOT_IN_TEMPLATE_BRANCH',
      })
    }

    const targetProductTypeId = await ensureTargetProductType(
      tx,
      templateProduct.productTypeId,
      branchId
    )

    await cloneProductTypeBrandMapping(tx, templateProduct.productTypeId, targetProductTypeId)

    if (!forceNew) {
      const existing = await findExistingBranchProduct(tx, {
        templateProduct,
        targetBranchId: branchId,
        targetProductTypeId,
      })

      if (existing?.id) {
        return {
          ok: true,
          cloned: false,
          productId: existing.id,
          templateProductId: templateProduct.id,
          targetBranchId: branchId,
          message: 'PRODUCT_ALREADY_EXISTS_IN_TARGET_BRANCH',
        }
      }
    }

    const productData = {
      name: templateProduct.name,
      mode: templateProduct.mode,
      noSN: templateProduct.noSN,
      trackSerialNumber: templateProduct.trackSerialNumber,
      active: true,
      productTypeId: targetProductTypeId,
      categoryId: templateProduct.categoryId,
      brandId: templateProduct.brandId,
      unitId: templateProduct.unitId,
    }

    if (PRODUCT_HAS_TEMPLATE_PRODUCT_ID) {
      productData.templateProductId = templateProduct.id
    }

    const created = await tx.product.create({
      data: {
        ...productData,
        productImages: templateProduct.productImages?.length
          ? {
              create: templateProduct.productImages.map((img) => ({
                url: img.url,
                public_id: img.public_id,
                secure_url: img.secure_url,
                caption: img.caption || null,
                isCover: !!img.isCover,
                active: true,
              })),
            }
          : undefined,
      },
      select: { id: true },
    })

    const bp = templateProduct.branchPrice?.[0] || {}

    await tx.branchPrice.create({
      data: {
        productId: created.id,
        branchId,
        effectiveDate: bp.effectiveDate ?? null,
        expiredDate: bp.expiredDate ?? null,
        note: `Cloned from template product ${templateProduct.id}`,
        updatedBy,
        isActive: typeof bp.isActive === 'boolean' ? bp.isActive : true,
        costPrice: bp.costPrice ?? 0,
        priceOnline: bp.priceOnline ?? null,
        priceRetail: bp.priceRetail ?? null,
        priceTechnician: bp.priceTechnician ?? null,
        priceWholesale: bp.priceWholesale ?? null,
      },
    })

    return {
      ok: true,
      cloned: true,
      productId: created.id,
      templateProductId: templateProduct.id,
      templateBranchId: templateBranch.id,
      targetBranchId: branchId,
      targetProductTypeId,
    }
  }, { timeout: 20000 })
}

module.exports = {
  TEMPLATE_BRANCH_CODE,
  getTemplateBranch,
  cloneProductFromTemplate,
}