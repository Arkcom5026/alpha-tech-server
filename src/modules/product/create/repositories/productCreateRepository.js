// src/modules/product/create/repositories/productCreateRepository.js

const { prisma } = require('../../../../../lib/prisma')

const DEFAULT_TEMPLATE_BRANCH_CODE = 'T01'

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

const toMoneyOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const getDb = (db) => db || prisma

const getProductTypeDedupeKey = (item = {}) => {
  const globalProductTypeId = toInt(item.globalProductTypeId)
  const normalized = item.normalizedName || item.name
  return `global:${globalProductTypeId || 'none'}:${normalizeName(normalized)}`
}

const dedupeProductTypes = (items = []) => {
  const byKey = new Map()

  items.forEach((item) => {
    if (!item?.id) return

    const key = getProductTypeDedupeKey(item)
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, item)
      return
    }

    // Prefer the active row, then the lower id as the stable canonical dropdown value.
    if (!existing.active && item.active) {
      byKey.set(key, item)
      return
    }

    if (existing.active === item.active && Number(item.id) < Number(existing.id)) {
      byKey.set(key, item)
    }
  })

  return Array.from(byKey.values()).sort((a, b) => {
    const nameCompare = String(a.name || '').localeCompare(String(b.name || ''), 'th')
    if (nameCompare !== 0) return nameCompare
    return Number(a.id) - Number(b.id)
  })
}

const findTemplateBranch = async ({ db, branchCode = DEFAULT_TEMPLATE_BRANCH_CODE } = {}) => {
  const client = getDb(db)

  return client.branch.findFirst({
    where: { branchCode },
    select: { id: true, name: true, branchCode: true },
  })
}

const findProductTypeById = async ({ db, productTypeId } = {}) => {
  const client = getDb(db)
  const ptId = toInt(productTypeId)
  if (!ptId) return null

  return client.productType.findUnique({
    where: { id: ptId },
    include: {
      globalProductType: {
        select: { id: true, name: true, categoryId: true },
      },
      productTypeBrands: {
        select: {
          brandId: true,
          brand: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
              active: true,
            },
          },
        },
      },
    },
  })
}

const findBranchProductTypeMatch = async ({ db, branchId, sourceProductType } = {}) => {
  const client = getDb(db)
  const brId = toInt(branchId)
  if (!brId || !sourceProductType) return null

  const globalProductTypeId = toInt(sourceProductType.globalProductTypeId)
  const normalizedName = sourceProductType.normalizedName || normalizeName(sourceProductType.name)

  return client.productType.findFirst({
    where: {
      branchId: brId,
      globalProductTypeId,
      OR: [
        { normalizedName },
        { name: sourceProductType.name },
      ],
    },
    include: {
      globalProductType: true,
      productTypeBrands: true,
    },
  })
}

const createBranchProductTypeFromSource = async ({ db, branchId, sourceProductType } = {}) => {
  const client = getDb(db)
  const brId = toInt(branchId)
  if (!brId || !sourceProductType) return null

  const normalizedName = sourceProductType.normalizedName || normalizeName(sourceProductType.name)

  try {
    return await client.productType.create({
      data: {
        name: sourceProductType.name,
        active: true,
        guideExamples: Array.isArray(sourceProductType.guideExamples)
          ? sourceProductType.guideExamples
          : [],
        normalizedName,
        pathCached: sourceProductType.pathCached || null,
        branchId: brId,
        globalProductTypeId: sourceProductType.globalProductTypeId,
      },
      include: {
        globalProductType: true,
        productTypeBrands: true,
      },
    })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    return findBranchProductTypeMatch({ db: client, branchId: brId, sourceProductType })
  }
}

const ensureBranchProductType = async ({ db, branchId, productTypeId } = {}) => {
  const client = getDb(db)
  const brId = toInt(branchId)
  const sourceProductType = await findProductTypeById({ db: client, productTypeId })
  if (!brId || !sourceProductType) return null

  if (sourceProductType.branchId === brId) return sourceProductType

  const existing = await findBranchProductTypeMatch({
    db: client,
    branchId: brId,
    sourceProductType,
  })
  if (existing) return existing

  return createBranchProductTypeFromSource({
    db: client,
    branchId: brId,
    sourceProductType,
  })
}

const ensureProductTypeBrand = async ({ db, productTypeId, brandId } = {}) => {
  const client = getDb(db)
  const ptId = toInt(productTypeId)
  const brId = toInt(brandId)
  if (!ptId || !brId) return null

  const existing = await client.productTypeBrand.findUnique({
    where: {
      productTypeId_brandId: {
        productTypeId: ptId,
        brandId: brId,
      },
    },
  })
  if (existing) return existing

  try {
    return await client.productTypeBrand.create({
      data: { productTypeId: ptId, brandId: brId },
    })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    return client.productTypeBrand.findUnique({
      where: {
        productTypeId_brandId: {
          productTypeId: ptId,
          brandId: brId,
        },
      },
    })
  }
}

const listTemplateProductTypes = async ({ includeInactive = false } = {}) => {
  const templateBranch = await findTemplateBranch()
  if (!templateBranch) return []

  const productTypes = await prisma.productType.findMany({
    where: {
      branchId: templateBranch.id,
      ...(includeInactive ? {} : { active: true }),
    },
    select: {
      id: true,
      name: true,
      active: true,
      branchId: true,
      normalizedName: true,
      globalProductTypeId: true,
      globalProductType: { select: { id: true, name: true, categoryId: true } },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return dedupeProductTypes(productTypes)
}

const listBranchProductTypes = async ({ branchId, includeInactive = false } = {}) => {
  const brId = toInt(branchId)
  if (!brId) return []

  const productTypes = await prisma.productType.findMany({
    where: {
      branchId: brId,
      ...(includeInactive ? {} : { active: true }),
    },
    select: {
      id: true,
      name: true,
      active: true,
      branchId: true,
      normalizedName: true,
      globalProductTypeId: true,
      globalProductType: { select: { id: true, name: true, categoryId: true } },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return dedupeProductTypes(productTypes)
}

const findBranchProductTypeById = async ({ db, branchId, productTypeId, includeInactive = false } = {}) => {
  const client = getDb(db)
  const brId = toInt(branchId)
  const ptId = toInt(productTypeId)
  if (!brId || !ptId) return null

  return client.productType.findFirst({
    where: {
      id: ptId,
      branchId: brId,
      ...(includeInactive ? {} : { active: true }),
    },
    include: {
      globalProductType: true,
      productTypeBrands: true,
    },
  })
}

const listUnits = async () => {
  return prisma.unit.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

const listBrandsForProductType = async ({ branchId, productTypeId, includeInactive = false } = {}) => {
  const brId = toInt(branchId)
  const ptId = toInt(productTypeId)
  if (!brId || !ptId) return []

  const branchProductType = await findBranchProductTypeById({
    branchId: brId,
    productTypeId: ptId,
    includeInactive,
  })
  if (!branchProductType) return []

  const mappings = await prisma.productTypeBrand.findMany({
    where: {
      productTypeId: branchProductType.id,
      brand: includeInactive ? {} : { active: true },
    },
    select: {
      brand: {
        select: {
          id: true,
          name: true,
          normalizedName: true,
          active: true,
        },
      },
    },
    orderBy: { brand: { name: 'asc' } },
  })

  const byId = new Map()
  mappings.forEach((item) => {
    if (item.brand?.id) byId.set(item.brand.id, item.brand)
  })

  return Array.from(byId.values()).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'th')
  )
}

const listExistingModels = async ({ branchId, productTypeId, brandId, search, limit = 30 } = {}) => {
  const brId = toInt(branchId)
  const ptId = toInt(productTypeId)
  const bdId = toInt(brandId)
  const take = Math.max(1, Math.min(toInt(limit) || 30, 100))
  if (!brId || !ptId) return []

  const sourceProductType = await findProductTypeById({ productTypeId: ptId })
  if (!sourceProductType) return []

  const branchProductType =
    sourceProductType.branchId === brId
      ? sourceProductType
      : await findBranchProductTypeMatch({ branchId: brId, sourceProductType })

  if (!branchProductType?.id) return []

  return prisma.product.findMany({
    where: {
      active: true,
      productTypeId: branchProductType.id,
      ...(bdId ? { brandId: bdId } : {}),
      branchPrice: {
        some: { branchId: brId, isActive: true },
      },
      ...(search
        ? { name: { contains: String(search).trim(), mode: 'insensitive' } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      productTypeId: true,
      brandId: true,
      unitId: true,
      productType: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take,
  })
}

const createOperationalProduct = async ({ db, data } = {}) => {
  const client = getDb(db)

  return client.product.create({
    data,
    include: {
      productType: true,
      brand: true,
      unit: true,
      branchPrice: true,
    },
  })
}

const upsertBranchPrice = async ({ db, productId, branchId, payload } = {}) => {
  const client = getDb(db)

  return client.branchPrice.upsert({
    where: { productId_branchId: { productId, branchId } },
    create: {
      productId,
      branchId,
      costPrice: toMoneyOrNull(payload.costPrice) ?? 0,
      priceRetail: toMoneyOrNull(payload.priceRetail),
      priceWholesale: toMoneyOrNull(payload.priceWholesale),
      priceTechnician: toMoneyOrNull(payload.priceTechnician),
      priceOnline: toMoneyOrNull(payload.priceOnline),
      isActive: true,
      note: payload.note || 'Product Create Runtime',
      updatedBy: payload.updatedBy || null,
    },
    update: {
      costPrice: toMoneyOrNull(payload.costPrice) ?? 0,
      priceRetail: toMoneyOrNull(payload.priceRetail),
      priceWholesale: toMoneyOrNull(payload.priceWholesale),
      priceTechnician: toMoneyOrNull(payload.priceTechnician),
      priceOnline: toMoneyOrNull(payload.priceOnline),
      isActive: true,
      note: payload.note || 'Product Create Runtime',
      updatedBy: payload.updatedBy || null,
    },
  })
}

module.exports = {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  normalizeName,
  toInt,
  toMoneyOrNull,
  findTemplateBranch,
  findProductTypeById,
  findBranchProductTypeById,
  ensureBranchProductType,
  ensureProductTypeBrand,
  listTemplateProductTypes,
  listBranchProductTypes,
  listUnits,
  listBrandsForProductType,
  listExistingModels,
  createOperationalProduct,
  upsertBranchPrice,
}
