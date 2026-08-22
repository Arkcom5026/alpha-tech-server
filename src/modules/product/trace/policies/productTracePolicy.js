const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority')

const buildProductTracePermissions = ({ actor }) => {
  const role = String(actor?.role || '').trim().toUpperCase()
  const employeeRole = String(actor?.employeeRole || actor?.v2Role || '').trim().toUpperCase()
  const employeeContext = String(actor?.profileType || '').trim().toLowerCase() === 'employee' || Boolean(actor?.employeeId)

  const canViewTrace = Boolean(actor?.id) && (
    !employeeContext || hasCapability(actor, POSITION_CAPABILITIES.PRODUCT_TRACE_READ)
  )
  const canViewFinancials = hasCapability(actor, POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIAL)

  return {
    canViewTrace,
    canViewFinancials,
    canViewSupplier: canViewFinancials,
    canViewCustomerContact: true,
    role: role || null,
    employeeRole: employeeRole || null,
  }
}

const assertCanViewProductTrace = (permissions) => {
  if (!permissions?.canViewTrace) {
    throw new ProductTraceError({
      code: ProductTraceFailureCode.PRODUCT_TRACE_FORBIDDEN,
      message: 'คุณไม่มีสิทธิ์ดูประวัติสินค้า',
      status: 403,
    })
  }
}

module.exports = {
  buildProductTracePermissions,
  assertCanViewProductTrace,
}
