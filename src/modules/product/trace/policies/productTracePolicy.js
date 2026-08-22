const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority')

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const employeeRole = actor?.employeeRole || actor?.v2Role || employeeProfile?.v2Role || null
  const authorityActor = {
    ...(actor || {}),
    employeeRole,
  }
  const role = String(actor?.role || '').trim().toUpperCase()
  const normalizedEmployeeRole = String(employeeRole || '').trim().toUpperCase()
  const canViewFinancials = hasCapability(
    authorityActor,
    POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIAL_READ,
  )

  return {
    canViewTrace: Boolean(actor?.id),
    canViewFinancials,
    canViewSupplier: canViewFinancials,
    canViewCustomerContact: true,
    role: role || null,
    employeeRole: normalizedEmployeeRole || null,
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
