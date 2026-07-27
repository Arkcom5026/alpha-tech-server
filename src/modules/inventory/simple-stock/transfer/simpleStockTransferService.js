const crypto = require('crypto')
const { Prisma } = require('@prisma/client')
const repository = require('./simpleStockTransferRepository')
const {
  assertProductCanTransferSimpleStock,
} = require('../../policies/productInventoryMutationPolicy')

const transferError = (code, statusCode = 400, details = null) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = statusCode
  error.details = details
  return error
}

const decimal = (value) => new Prisma.Decimal(value ?? 0)
const barcodeKey = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)

class SimpleStockTransferService {
  constructor(repo = repository) {
    this.repository = repo
  }

  async transfer({ sourceBranchId, employeeId, payload }) {
    const branchId = Number(sourceBranchId)
    if (!Number.isInteger(branchId) || branchId <= 0) {
      throw transferError('BRANCH_ID_MISSING', 401)
    }
    if (branchId === payload.targetBranchId) {
      throw transferError('TRANSFER_BRANCHES_MUST_DIFFER')
    }

    return this.repository.transaction(async (repo) => {
      const replay = await repo.findTransferMovements(payload.movementRefType)
      if (replay.length) {
        const hasExpectedSource = replay.some(
          (movement) =>
            movement.branchId === branchId &&
            movement.productId === payload.sourceProductId &&
            decimal(movement.qty).isNegative()
        )
        const hasExpectedTarget = replay.some(
          (movement) =>
            movement.branchId === payload.targetBranchId &&
            decimal(movement.qty).isPositive()
        )
        if (!hasExpectedSource || !hasExpectedTarget) {
          throw transferError('SIMPLE_TRANSFER_IDEMPOTENCY_KEY_REUSED', 409)
        }
        return {
          replayed: true,
          transferKey: payload.transferKey,
          movementIds: replay.map((movement) => movement.id),
        }
      }

      const [targetBranch, sourceProduct] = await Promise.all([
        repo.findBranch(payload.targetBranchId),
        repo.findSourceProduct(branchId, payload.sourceProductId),
      ])
      if (!targetBranch) throw transferError('TARGET_BRANCH_NOT_FOUND', 404)
      if (!sourceProduct) throw transferError('SOURCE_PRODUCT_NOT_FOUND_IN_BRANCH', 404)

      assertProductCanTransferSimpleStock(sourceProduct)

      const targetProduct = await repo.findTargetProduct(
        payload.targetBranchId,
        sourceProduct,
        payload.targetProductId
      )
      if (!targetProduct) {
        throw transferError('TARGET_PRODUCT_NOT_FOUND_IN_BRANCH', 409, {
          sourceProductId: sourceProduct.id,
          templateProductId: sourceProduct.templateProductId,
          targetBranchId: payload.targetBranchId,
        })
      }

      assertProductCanTransferSimpleStock(targetProduct)

      const sourceIdentity = sourceProduct.templateProductId || sourceProduct.id
      const targetIdentity = targetProduct.templateProductId || targetProduct.id
      if (Number(sourceIdentity) !== Number(targetIdentity)) {
        throw transferError('TRANSFER_PRODUCT_IDENTITY_MISMATCH', 409)
      }

      const [sourceBalance, targetBalance, lots] = await Promise.all([
        repo.findBalance(branchId, sourceProduct.id),
        repo.findBalance(payload.targetBranchId, targetProduct.id),
        repo.findActiveLots(branchId, sourceProduct.id),
      ])

      const quantity = decimal(payload.quantity)
      const sourceQuantity = decimal(sourceBalance?.quantity)
      const sourceReserved = decimal(sourceBalance?.reserved)
      const sourceAvailable = sourceQuantity.minus(sourceReserved)
      if (sourceAvailable.lessThan(quantity)) {
        throw transferError('INSUFFICIENT_AVAILABLE_STOCK_FOR_TRANSFER', 409, {
          quantity: sourceQuantity.toString(),
          reserved: sourceReserved.toString(),
          requested: quantity.toString(),
        })
      }

      const lotQuantity = lots.reduce(
        (sum, lot) => sum.plus(decimal(lot.qtyRemaining)),
        decimal(0)
      )
      if (lotQuantity.lessThan(quantity)) {
        throw transferError('SIMPLE_LOT_BALANCE_MISMATCH', 409, {
          stockBalanceQuantity: sourceQuantity.toString(),
          lotQuantity: lotQuantity.toString(),
          requested: quantity.toString(),
        })
      }

      let remaining = quantity
      let incomingCost = decimal(0)
      const outgoingMovementIds = []
      const incomingMovementIds = []
      const destinationLotIds = []

      for (const lot of lots) {
        if (remaining.isZero()) break
        const lotAvailable = decimal(lot.qtyRemaining)
        const transferred = Prisma.Decimal.min(lotAvailable, remaining)
        const lotRemaining = lotAvailable.minus(transferred)
        const unitCost = decimal(lot.unitCost)

        await repo.updateLot(lot.id, lotRemaining)

        const destinationLot = await repo.createDestinationLot({
          branchId: payload.targetBranchId,
          productId: targetProduct.id,
          barcode: `TRF-${payload.targetBranchId}-${targetProduct.id}-${barcodeKey(payload.transferKey)}-${lot.id}`,
          qtyInitial: transferred,
          qtyRemaining: transferred,
          unitCost,
          status: 'ACTIVE',
        })
        destinationLotIds.push(destinationLot.id)
        incomingCost = incomingCost.plus(transferred.times(unitCost))

        const movementBase = {
          type: 'TRANSFER',
          refType: payload.movementRefType,
          refId: payload.refId,
          note: payload.note,
          ...(employeeId ? { performedByEmployeeId: Number(employeeId) } : {}),
        }
        const outgoing = await repo.createMovement({
          ...movementBase,
          productId: sourceProduct.id,
          branchId,
          qty: transferred.negated(),
          simpleLotId: lot.id,
        })
        const incoming = await repo.createMovement({
          ...movementBase,
          productId: targetProduct.id,
          branchId: payload.targetBranchId,
          qty: transferred,
          simpleLotId: destinationLot.id,
        })
        outgoingMovementIds.push(outgoing.id)
        incomingMovementIds.push(incoming.id)
        remaining = remaining.minus(transferred)
      }

      const nextSourceQuantity = sourceQuantity.minus(quantity)
      await repo.upsertBalance({
        branchId,
        productId: sourceProduct.id,
        quantity: nextSourceQuantity,
        reserved: sourceReserved,
        avgCost: sourceBalance?.avgCost ?? null,
        lastReceivedCost: sourceBalance?.lastReceivedCost ?? null,
      })

      const targetQuantity = decimal(targetBalance?.quantity)
      const targetReserved = decimal(targetBalance?.reserved)
      const nextTargetQuantity = targetQuantity.plus(quantity)
      const currentTargetAverage = decimal(
        targetBalance?.avgCost ?? targetBalance?.lastReceivedCost
      )
      const nextTargetAverage = targetQuantity.isZero()
        ? incomingCost.dividedBy(quantity)
        : targetQuantity.times(currentTargetAverage)
            .plus(incomingCost)
            .dividedBy(nextTargetQuantity)

      await repo.upsertBalance({
        branchId: payload.targetBranchId,
        productId: targetProduct.id,
        quantity: nextTargetQuantity,
        reserved: targetReserved,
        avgCost: nextTargetAverage,
        lastReceivedCost: incomingCost.dividedBy(quantity),
      })

      return {
        replayed: false,
        transferKey: payload.transferKey,
        source: {
          branchId,
          productId: sourceProduct.id,
          previousQuantity: sourceQuantity.toString(),
          quantity: nextSourceQuantity.toString(),
        },
        target: {
          branchId: payload.targetBranchId,
          branchName: targetBranch.name,
          productId: targetProduct.id,
          previousQuantity: targetQuantity.toString(),
          quantity: nextTargetQuantity.toString(),
        },
        transferredQuantity: quantity.toString(),
        destinationLotIds,
        outgoingMovementIds,
        incomingMovementIds,
      }
    })
  }
}

module.exports = new SimpleStockTransferService()
module.exports.SimpleStockTransferService = SimpleStockTransferService
