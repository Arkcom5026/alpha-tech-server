const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../../employee/authorization/employeePositionResidualAuthority')

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').trim().toUpperCase()
  const employeeRole = String(
    actor?.employeeRole || actor?.v2Role || employeeProfile?.v2Role || '',
  ).trim().toUpperCase()
  const authorityActor = {
    ...(actor || {}),
    employeeRole: employeeRole || undefined,
  }

  const canViewTrace = Boolean(actor?.id) && hasResidualCapability(
    authorityActor,
    RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
  )
  const canViewFinancials = hasResidualCapability(
    authorityActor,
    RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
  )

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
