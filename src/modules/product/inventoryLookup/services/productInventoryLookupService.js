const { prisma } = require('../../../../lib/prisma')
const {
  findSimpleProductBySaleBarcode,
  findStockItemByBarcode,
  findStockItemBySerialNumber,
} = require('../../runtime/repositories/operationalProductRuntimeRepository')
const { normStr, toInt } = require('../../runtime/shared/operationalProductInput')

const requireBranchId = (branchId) => {
  const brId = toInt(branchId)
  if (!brId) {
    const error = new Error('BRANCH_ID_MISSING')
    error.statusCode = 401
    error.code = 'BRANCH_ID_MISSING'
    throw error
  }
  return brId
}

const findProductInventoryByBarcode = async ({ branchId, barcode, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const code = normStr(barcode)
  if (!code) {
    const error = new Error('BARCODE_REQUIRED')
    error.statusCode = 400
    error.code = 'BARCODE_REQUIRED'
    throw error
  }
  const stockItem = await findStockItemByBarcode({ branchId: brId, barcode: code, db })
  if (stockItem) return stockItem
  const product = await findSimpleProductBySaleBarcode({ branchId: brId, saleBarcode: code, db })
  if (!product) return null
  const nonStock = product.inventoryBehavior === 'NON_STOCK'
  const balance = product.stockBalances?.[0]
  const available = Math.max(0, Number(balance?.quantity || 0) - Number(balance?.reserved || 0))
  const lot = product.simpleLots?.[0] || null
  if (!nonStock && (!lot || available <= 0)) return null
  return {
    kind: nonStock ? 'NON_STOCK' : 'SIMPLE',
    lineType: 'SIMPLE',
    stockItemId: null,
    productId: product.id,
    simpleLotId: nonStock ? null : lot.id,
    barcode: product.saleBarcode,
    inventoryBehavior: product.inventoryBehavior,
    qtyRemaining: nonStock ? null : available,
    product,
  }
}

const findProductInventoryBySerial = async ({ branchId, serialNumber, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const serial = normStr(serialNumber)
  if (!serial) {
    const error = new Error('SERIAL_NUMBER_REQUIRED')
    error.statusCode = 400
    error.code = 'SERIAL_NUMBER_REQUIRED'
    throw error
  }
  return findStockItemBySerialNumber({ branchId: brId, serialNumber: serial, db })
}

module.exports = { findProductInventoryByBarcode, findProductInventoryBySerial }
