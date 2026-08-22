const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority')

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').toUpperCase()
  const employeeRole = String(employeeProfile?.v2Role || actor?.employeeRole || actor?.v2Role || '').toUpperCase()
  const canViewFinancials = hasCapability(actor || {}, POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS)

  return {
    canViewTrace: Boolean(actor?.id),
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
