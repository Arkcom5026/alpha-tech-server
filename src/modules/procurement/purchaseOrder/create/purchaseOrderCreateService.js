const {
  findLatestPurchaseOrderCode,
  createPurchaseOrderTransaction,
} = require('./purchaseOrderCreateRepository')

const isMoneyLike = (value) =>
  (typeof value === 'number' && !Number.isNaN(value)) ||
  (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value))

const normalizeCreateInput = ({ branchId, employeeId, supplierId, note, items }) => {
  const normalizedBranchId = Number(branchId)
  const normalizedEmployeeId = Number(employeeId)

  if (!normalizedBranchId || !normalizedEmployeeId) {
    const error = new Error('Unauthorized: Missing branchId/employeeId')
    error.code = 'MISSING_RUNTIME_CONTEXT'
    throw error
  }

  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ')
    error.code = 'EMPTY_ITEMS'
    throw error
  }

  const normalizedItems = items.map((item) => {
    if (!item?.productId || !item?.quantity || !isMoneyLike(item?.costPrice)) {
      const error = new Error('รายการสินค้าไม่ถูกต้อง (productId/quantity/costPrice)')
      error.code = 'INVALID_ITEM'
      throw error
    }

    return {
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      costPrice: item.costPrice,
    }
  })

  return {
    branchId: normalizedBranchId,
    employeeId: normalizedEmployeeId,
    supplierId: supplierId ? Number(supplierId) : null,
    note: note || null,
    items: normalizedItems,
  }
}

const buildPurchaseOrderCode = ({ branchId, now, latestCode }) => {
  const paddedBranch = String(branchId).padStart(2, '0')
  const yymm = `${now.getFullYear().toString().slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`
  const prefix = `PO-${paddedBranch}${yymm}-`

  const lastSequence = latestCode
    ? Number.parseInt(String(latestCode).slice(-4), 10)
    : 0
  const nextSequence = (Number.isNaN(lastSequence) ? 0 : lastSequence) + 1

  return {
    prefix,
    code: `${prefix}${String(nextSequence).padStart(4, '0')}`,
  }
}

const createPurchaseOrder = async (input) => {
  const normalized = normalizeCreateInput(input)

  for (let attempt = 0; attempt <= 4; attempt += 1) {
    const paddedBranch = String(normalized.branchId).padStart(2, '0')
    const now = new Date()
    const yymm = `${now.getFullYear().toString().slice(2)}${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`
    const prefix = `PO-${paddedBranch}${yymm}-`

    const latest = await findLatestPurchaseOrderCode({
      branchId: normalized.branchId,
      prefix,
    })
    const { code } = buildPurchaseOrderCode({
      branchId: normalized.branchId,
      now,
      latestCode: latest?.code,
    })

    try {
      return await createPurchaseOrderTransaction({
        ...normalized,
        code,
      })
    } catch (error) {
      const duplicateCode =
        error?.code === 'P2002' &&
        String(error?.meta?.target || '').includes('code')

      if (duplicateCode && attempt < 4) continue
      throw error
    }
  }

  const error = new Error('ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่')
  error.code = 'CODE_GENERATION_EXHAUSTED'
  throw error
}

module.exports = {
  createPurchaseOrder,
}
