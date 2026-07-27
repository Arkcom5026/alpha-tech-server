const { Prisma } = require('@prisma/client')
const repository = require('./simpleStockAdjustmentRepository')
const {
  assertProductCanAdjustSimpleStock,
} = require('../../policies/productInventoryMutationPolicy')

const adjustmentError = (code, statusCode = 400, details = null) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = statusCode
  error.details = details
  return error
}

const decimal = (value) => new Prisma.Decimal(value ?? 0)

const adjustmentLotBarcode = ({ branchId, productId }) =>
  `ADJ-${branchId}-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

class SimpleStockAdjustmentService {
  constructor(repo = repository) {
    this.repository = repo
  }

  async adjust({ branchId, employeeId, payload }) {
    const normalizedBranchId = Number(branchId)
    if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
      throw adjustmentError('BRANCH_ID_MISSING', 401)
    }

    return this.repository.transaction(async (repo) => {
      const product = await repo.findProduct(normalizedBranchId, payload.productId)
      if (!product) throw adjustmentError('PRODUCT_NOT_FOUND_IN_BRANCH', 404)

      assertProductCanAdjustSimpleStock(product)

      const balance = await repo.findBalance(normalizedBranchId, product.id)
      const currentQuantity = decimal(balance?.quantity)
      const reserved = decimal(balance?.reserved)
      const delta = decimal(payload.qtyDelta)
      const nextQuantity = currentQuantity.plus(delta)

      if (nextQuantity.isNegative() || nextQuantity.lessThan(reserved)) {
        throw adjustmentError('INSUFFICIENT_AVAILABLE_STOCK_FOR_ADJUSTMENT', 409, {
          quantity: currentQuantity.toString(),
          reserved: reserved.toString(),
          requestedDelta: delta.toString(),
        })
      }

      const movementBase = {
        productId: product.id,
        branchId: normalizedBranchId,
        type: 'ADJUST',
        refType: payload.refType,
        refId: payload.refId,
        note: payload.note,
        ...(employeeId ? { performedByEmployeeId: Number(employeeId) } : {}),
      }

      const movements = []
      let adjustmentLot = null

      if (delta.isPositive()) {
        const unitCost = payload.unitCost == null
          ? decimal(balance?.lastReceivedCost ?? balance?.avgCost)
          : decimal(payload.unitCost)

        adjustmentLot = await repo.createAdjustmentLot({
          productId: product.id,
          branchId: normalizedBranchId,
          barcode: adjustmentLotBarcode({ branchId: normalizedBranchId, productId: product.id }),
          qtyInitial: delta,
          qtyRemaining: delta,
          unitCost,
          status: 'ACTIVE',
        })

        movements.push(await repo.createMovement({
          ...movementBase,
          qty: delta,
          simpleLotId: adjustmentLot.id,
        }))

        const previousAverageCost = decimal(
          balance?.avgCost ?? balance?.lastReceivedCost ?? unitCost
        )
        const nextAverageCost = currentQuantity.isZero()
          ? unitCost
          : currentQuantity.times(previousAverageCost)
              .plus(delta.times(unitCost))
              .dividedBy(nextQuantity)

        await repo.upsertBalance({
          branchId: normalizedBranchId,
          productId: product.id,
          quantity: nextQuantity,
          reserved,
          avgCost: nextAverageCost,
          lastReceivedCost: unitCost,
        })
      } else {
        let remainingToRemove = delta.abs()
        const lots = await repo.findActiveLots(normalizedBranchId, product.id)
        const lotQuantity = lots.reduce(
          (sum, lot) => sum.plus(decimal(lot.qtyRemaining)),
          decimal(0)
        )

        if (lotQuantity.lessThan(remainingToRemove)) {
          throw adjustmentError('SIMPLE_LOT_BALANCE_MISMATCH', 409, {
            stockBalanceQuantity: currentQuantity.toString(),
            lotQuantity: lotQuantity.toString(),
            requestedRemoval: remainingToRemove.toString(),
          })
        }

        for (const lot of lots) {
          if (remainingToRemove.isZero()) break
          const available = decimal(lot.qtyRemaining)
          const consumed = Prisma.Decimal.min(available, remainingToRemove)
          const lotRemaining = available.minus(consumed)

          await repo.updateLot(lot.id, lotRemaining)
          movements.push(await repo.createMovement({
            ...movementBase,
            qty: consumed.negated(),
            simpleLotId: lot.id,
          }))
          remainingToRemove = remainingToRemove.minus(consumed)
        }

        await repo.upsertBalance({
          branchId: normalizedBranchId,
          productId: product.id,
          quantity: nextQuantity,
          reserved,
          avgCost: balance?.avgCost ?? null,
          lastReceivedCost: balance?.lastReceivedCost ?? null,
        })
      }

      return {
        product: { id: product.id, name: product.name },
        branchId: normalizedBranchId,
        previousQuantity: currentQuantity.toString(),
        qtyDelta: delta.toString(),
        quantity: nextQuantity.toString(),
        reserved: reserved.toString(),
        adjustmentLotId: adjustmentLot?.id || null,
        movementIds: movements.map((movement) => movement.id),
      }
    })
  }
}

module.exports = new SimpleStockAdjustmentService()
module.exports.SimpleStockAdjustmentService = SimpleStockAdjustmentService
