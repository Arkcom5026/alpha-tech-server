// src/modules/product/services/productTemplateEngine/productCloneService.js
// Product Template Engine v1
// Supports both standalone transaction and external transaction.

const { prisma } = require('../../../../../lib/prisma')
const { TEMPLATE_BRANCH_CODE } = require('./constants')
const { validateTemplate } = require('./validateTemplate')
const { cloneProductType } = require('./cloneProductType')
const { cloneBrandMapping } = require('./cloneBrandMapping')
const { cloneProduct } = require('./cloneProduct')
const { cloneImages } = require('./cloneImages')
const { cloneBranchPrice } = require('./cloneBranchPrice')
const { afterCloneHooks } = require('./afterCloneHooks')

const toPositiveInt = (v) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const findExistingClone = async (tx, { templateProductId, targetBranchId }) => {
  return tx.product.findFirst({
    where: {
      templateProductId: Number(templateProductId),
      branchPrice: {
        some: { branchId: Number(targetBranchId) },
      },
    },
    select: { id: true },
  })
}

const cloneProductFromTemplateCore = async (tx, {
  templateProductId,
  targetBranchId,
  templateBranchCode = TEMPLATE_BRANCH_CODE,
  updatedBy = null,
  forceNew = false,
} = {}) => {
  const tplId = toPositiveInt(templateProductId)
  const branchId = toPositiveInt(targetBranchId)

  if (!tplId) {
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

  const { templateBranch, templateProduct } = await validateTemplate(tx, {
    templateProductId: tplId,
    templateBranchCode,
  })

  if (Number(templateBranch.id) === Number(branchId)) {
    throw Object.assign(new Error('TARGET_BRANCH_CANNOT_BE_TEMPLATE'), {
      status: 400,
      code: 'TARGET_BRANCH_CANNOT_BE_TEMPLATE',
    })
  }

  if (!forceNew) {
    const existing = await findExistingClone(tx, {
      templateProductId: templateProduct.id,
      targetBranchId: branchId,
    })

    if (existing) {
      return {
        ok: true,
        cloned: false,
        productId: existing.id,
        templateProductId: templateProduct.id,
        targetBranchId: branchId,
        message: 'PRODUCT_ALREADY_CLONED',
      }
    }
  }

  const targetProductTypeId = await cloneProductType(tx, {
    templateProductTypeId: templateProduct.productTypeId,
    targetBranchId: branchId,
  })

  await cloneBrandMapping(tx, {
    sourceProductTypeId: templateProduct.productTypeId,
    targetProductTypeId,
  })

  const newProductId = await cloneProduct(tx, {
    templateProduct,
    targetProductTypeId,
  })

  await cloneImages(tx, {
    templateProduct,
    newProductId,
  })

  await cloneBranchPrice(tx, {
    templateProduct,
    newProductId,
    targetBranchId: branchId,
    updatedBy,
  })

  await afterCloneHooks(tx, {
    templateProduct,
    newProductId,
    targetBranchId: branchId,
  })

  return {
    ok: true,
    cloned: true,
    productId: newProductId,
    templateProductId: templateProduct.id,
    templateBranchId: templateBranch.id,
    targetBranchId: branchId,
    targetProductTypeId,
  }
}

/**
 * Clone template product into an operational branch.
 *
 * Usage A: standalone transaction
 * await cloneProductFromTemplate({ templateProductId, targetBranchId })
 *
 * Usage B: external transaction, for QuickStock / PO / Receive flows
 * await cloneProductFromTemplate({ tx, templateProductId, targetBranchId })
 */
const cloneProductFromTemplate = async ({
  tx = null,
  templateProductId,
  targetBranchId,
  templateBranchCode = TEMPLATE_BRANCH_CODE,
  updatedBy = null,
  forceNew = false,
} = {}) => {
  const payload = {
    templateProductId,
    targetBranchId,
    templateBranchCode,
    updatedBy,
    forceNew,
  }

  if (tx) {
    return cloneProductFromTemplateCore(tx, payload)
  }

  return prisma.$transaction(
    async (transactionClient) => cloneProductFromTemplateCore(transactionClient, payload),
    { timeout: 20000 }
  )
}

module.exports = {
  TEMPLATE_BRANCH_CODE,
  cloneProductFromTemplate,
  cloneProductFromTemplateCore,
}
