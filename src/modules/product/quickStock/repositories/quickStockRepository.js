// src/modules/product/quickStock/repositories/quickStockRepository.js
// QuickStock Runtime Repository
// Data-access layer only. Keep business decisions in QuickStockService.

const {
  createStockMovement,
  createStockMovements,
} = require('../../../inventory/movement/stockMovementWriter')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

class QuickStockRepository {
  constructor(prisma) {
    if (!prisma) {
      throw new Error('[QuickStockRepository] prisma is required')
    }
    this.prisma = prisma
  }

  client(db) {
    return db || this.prisma
  }

  async findActiveProducts({ db } = {}) {
    const client = this.client(db)

    return client.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        productTypeId: true,
        brandId: true,
        trackSerialNumber: true,
        brand: {
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findProductTypes({ db } = {}) {
    const client = this.client(db)

    return client.productType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
  }

  async findStockByBranch({ db, branchId } = {}) {
    const client = this.client(db)
    const brId = toInt(branchId)

    return client.stockItem.findMany({
      where: { branchId: brId },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findBrandByNormalizedName({ db, normalizedName } = {}) {
    const client = this.client(db)

    return client.brand.findFirst({
      where: { normalizedName },
    })
  }

  async createBrand({ db, name, normalizedName } = {}) {
    const client = this.client(db)

    return client.brand.create({
      data: {
        name: String(name || '').trim(),
        normalizedName,
        active: true,
      },
    })
  }

  async createProduct({ db, data } = {}) {
    const client = this.client(db)

    return client.product.create({ data })
  }

  async createBranchPrice({ db, data } = {}) {
    const client = this.client(db)

    return client.branchPrice.create({ data })
  }

  async findExistingBarcodes({ db, barcodes = [] } = {}) {
    const client = this.client(db)
    const cleanBarcodes = (Array.isArray(barcodes) ? barcodes : [])
      .map((barcode) => String(barcode || '').trim())
      .filter(Boolean)

    if (!cleanBarcodes.length) {
      return {
        stockItems: [],
        simpleLots: [],
        existingBarcodeSet: new Set(),
      }
    }

    const [stockItems, simpleLots] = await Promise.all([
      client.stockItem.findMany({
        where: { barcode: { in: cleanBarcodes } },
        select: { barcode: true },
      }),
      client.simpleLot.findMany({
        where: { barcode: { in: cleanBarcodes } },
        select: { barcode: true },
      }),
    ])

    const existingBarcodeSet = new Set([
      ...stockItems.map((row) => String(row.barcode).toLowerCase()),
      ...simpleLots.map((row) => String(row.barcode).toLowerCase()),
    ])

    return {
      stockItems,
      simpleLots,
      existingBarcodeSet,
    }
  }

  async findExistingSerialNumbers({ db, serialNumbers = [] } = {}) {
    const client = this.client(db)
    const cleanSerialNumbers = (Array.isArray(serialNumbers) ? serialNumbers : [])
      .map((serialNumber) => String(serialNumber || '').trim())
      .filter(Boolean)

    if (!cleanSerialNumbers.length) return []

    return client.stockItem.findMany({
      where: { serialNumber: { in: cleanSerialNumbers } },
      select: { serialNumber: true },
    })
  }

  async findOperationalProductInBranch({ db, productId, branchId } = {}) {
    const client = this.client(db)
    const id = toInt(productId)
    const brId = toInt(branchId)

    if (!id || !brId) return null

    return client.product.findFirst({
      where: {
        id,
        active: true,
        productType: { branchId: brId },
      },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        inventoryBehavior: true,
        productTypeId: true,
        templateProductId: true,
      },
    })
  }

  async findProductForReceive({ db, productId, branchId } = {}) {
    return this.findOperationalProductInBranch({
      db,
      productId,
      branchId,
    })
  }

  async findClonedOperationalProduct({ db, productId, branchId } = {}) {
    return this.findOperationalProductInBranch({ db, productId, branchId })
  }

  async findBranchPrice({ db, productId, branchId } = {}) {
    const client = this.client(db)
    const pId = toInt(productId)
    const brId = toInt(branchId)

    if (!pId || !brId) return null

    return client.branchPrice.findFirst({
      where: {
        productId: pId,
        branchId: brId,
      },
      select: {
        id: true,
        costPrice: true,
        priceRetail: true,
        priceWholesale: true,
        priceTechnician: true,
        priceOnline: true,
      },
    })
  }

  async updateBranchPrice({ db, branchPriceId, data } = {}) {
    const client = this.client(db)
    const id = toInt(branchPriceId)

    return client.branchPrice.update({
      where: { id },
      data,
    })
  }

  async upsertBranchPriceManual({ db, productId, branchId, data } = {}) {
    const client = this.client(db)
    const existingBranchPrice = await this.findBranchPrice({
      db: client,
      productId,
      branchId,
    })

    if (existingBranchPrice) {
      const updated = await this.updateBranchPrice({
        db: client,
        branchPriceId: existingBranchPrice.id,
        data,
      })

      return {
        action: 'updated',
        branchPriceId: existingBranchPrice.id,
        branchPrice: updated,
      }
    }

    const created = await this.createBranchPrice({
      db: client,
      data: {
        productId: toInt(productId),
        branchId: toInt(branchId),
        ...data,
      },
    })

    return {
      action: 'created',
      branchPriceId: created.id,
      branchPrice: created,
    }
  }

  async upsertBranchPrice({
    db,
    productId,
    branchId,
    employeeId,
    payload = {},
  } = {}) {
    return this.upsertBranchPriceManual({
      db,
      productId,
      branchId,
      data: {
        costPrice: toNumber(payload.costPrice),
        priceRetail: toNumber(payload.priceRetail),
        priceWholesale: toNumber(payload.priceWholesale),
        priceTechnician: toNumber(payload.priceTechnician),
        priceOnline: toNumber(payload.priceOnline),
        updatedBy: toInt(employeeId),
        isActive: true,
      },
    })
  }

  async createStockItems({ db, data = [] } = {}) {
    const client = this.client(db)

    return client.stockItem.createMany({ data })
  }

  async createStockMovements({ db, data = [] } = {}) {
    const client = this.client(db)

    return createStockMovements(client, data)
  }

  async createStockMovement({ db, data } = {}) {
    const client = this.client(db)

    return createStockMovement(client, data)
  }

  async createSimpleLot({ db, data } = {}) {
    const client = this.client(db)

    return client.simpleLot.create({ data })
  }

  async upsertStockBalance({ db, productId, branchId, quantity, lastReceivedCost } = {}) {
    const client = this.client(db)
    const pId = toInt(productId)
    const brId = toInt(branchId)
    const qty = toNumber(quantity, 0)
    const lastCost = toNumber(lastReceivedCost, 0)

    const rows = await client.$queryRawUnsafe(
      `SELECT "id", "quantity", "avgCost"
       FROM "StockBalance"
       WHERE "productId"=$1 AND "branchId"=$2
       FOR UPDATE`,
      pId,
      brId
    )

    if (rows.length) {
      const current = rows[0]
      const currentQty = toNumber(current.quantity, 0)
      const currentAvg = toNumber(current.avgCost, lastCost)
      const nextQty = currentQty + qty
      const weightedAvg = nextQty > 0
        ? ((currentQty * currentAvg) + (qty * lastCost)) / nextQty
        : lastCost

      return client.stockBalance.update({
        where: { id: current.id },
        data: {
          quantity: nextQty,
          lastReceivedCost: lastCost,
          avgCost: weightedAvg,
        },
      })
    }

    return client.stockBalance.create({
      data: {
        productId: pId,
        branchId: brId,
        quantity: qty,
        reserved: 0,
        lastReceivedCost: lastCost,
        avgCost: lastCost,
      },
    })
  }
}

module.exports = {
  QuickStockRepository,
  toInt,
  toNumber,
}
