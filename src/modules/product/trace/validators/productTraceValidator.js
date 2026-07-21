const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')

const normalizeTraceLookup = (value) => String(value || '').trim()

const validateTraceLookup = (value) => {
  const lookup = normalizeTraceLookup(value)

  if (!lookup) {
    throw new ProductTraceError({
      code: ProductTraceFailureCode.BARCODE_REQUIRED,
      message: 'กรุณาระบุบาร์โค้ดหรือหมายเลขซีเรียลสินค้า',
      status: 400,
    })
  }

  if (lookup.length > 191) {
    throw new ProductTraceError({
      code: ProductTraceFailureCode.BARCODE_INVALID,
      message: 'บาร์โค้ดหรือหมายเลขซีเรียลยาวเกินกว่าที่ระบบรองรับ',
      status: 400,
    })
  }

  return lookup
}

const validateBranchContext = (branchId) => {
  const normalized = Number(branchId)
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new ProductTraceError({
      code: ProductTraceFailureCode.BRANCH_CONTEXT_REQUIRED,
      message: 'ไม่พบขอบเขตสาขาสำหรับตรวจสอบประวัติสินค้า',
      status: 401,
    })
  }
  return normalized
}

module.exports = {
  normalizeTraceLookup,
  validateTraceLookup,
  validateBranchContext,
}
