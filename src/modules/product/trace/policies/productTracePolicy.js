const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  POSITION_CAPABILITIES,
  hasCapability,
  resolveActorCapabilities,
} = require('../../../employee/authorization/employeePositionAuthority')

const PRODUCT_TRACE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
  FINANCIAL: POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIAL,
})

const normalize = (value) => String(value || '').trim().toUpperCase()

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = normalize(actor?.role)
  const employeeRole = normalize(actor?.employeeRole || actor?.v2Role || employeeProfile?.v2Role)
  const effectiveActor = {
    ...(actor || {}),
    employeeRole: actor?.employeeRole || actor?.v2Role || employeeProfile?.v2Role || null,
  }
  const resolved = resolveActorCapabilities(effectiveActor)

  let canViewTrace
  let canViewFinancials

  if (resolved.mode === 'V2_ROLE_COMPAT') {
    canViewTrace = Boolean(actor?.id)
    canViewFinancials = ['OWNER', 'MANAGER'].includes(employeeRole)
  } else {
    canViewTrace = hasCapability(effectiveActor, PRODUCT_TRACE_CAPABILITY.READ)
    canViewFinancials = canViewTrace
      && hasCapability(effectiveActor, PRODUCT_TRACE_CAPABILITY.FINANCIAL)
  }

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
  PRODUCT_TRACE_CAPABILITY,
  buildProductTracePermissions,
  assertCanViewProductTrace,
}
