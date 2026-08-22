const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  RESIDUAL_BUSINESS_CAPABILITIES,
  hasResidualBusinessCapability,
} = require('../../../employee/authorization/residualBusinessPositionAuthority')

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').toUpperCase()
  const employeeRole = String(employeeProfile?.v2Role || actor?.employeeRole || actor?.v2Role || '').toUpperCase()
  const capabilityActor = {
    ...(actor || {}),
    employeeRole,
    v2Role: employeeRole,
  }

  const canViewFinancials = hasResidualBusinessCapability(
    capabilityActor,
    RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
  )

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
