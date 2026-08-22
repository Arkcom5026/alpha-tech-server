const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  OPERATIONAL_POSITION_CAPABILITIES,
  hasOperationalCapability,
} = require('../../../employee/authorization/employeeOperationalPositionAuthority')

const buildProductTracePermissions = ({ actor = {}, employeeProfile = null }) => {
  const role = String(actor?.role || '').trim().toUpperCase()
  const employeeRole = String(actor?.employeeRole || actor?.v2Role || employeeProfile?.v2Role || '').trim().toUpperCase()
  const employeeContext = Boolean(
    employeeProfile
    || Number(actor?.employeeId) > 0
    || String(actor?.profileType || '').trim().toLowerCase() === 'employee',
  )
  const authorityActor = {
    ...actor,
    employeeRole: employeeRole || undefined,
  }

  const canViewTrace = employeeContext
    ? hasOperationalCapability(authorityActor, OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ)
    : Boolean(actor?.id)
  const canViewFinancials = hasOperationalCapability(
    authorityActor,
    OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
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
