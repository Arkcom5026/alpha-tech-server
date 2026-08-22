const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../../../employee/authorization/residualPositionAuthority')

const PRODUCT_TRACE_CAPABILITIES = Object.freeze({
  READ: RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
  FINANCIALS: RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
})

const buildProductTracePermissions = ({ actor, employeeProfile }) => {
  const role = String(actor?.role || '').trim().toUpperCase()
  const employeeRole = String(actor?.employeeRole || employeeProfile?.v2Role || '').trim().toUpperCase()
  const authorizationActor = {
    ...actor,
    employeeRole: actor?.employeeRole || employeeProfile?.v2Role || null,
  }
  const migratedPosition = Array.isArray(actor?.positionCapabilities)

  const canViewTrace = hasResidualCapability(authorizationActor, PRODUCT_TRACE_CAPABILITIES.READ) ||
    (!migratedPosition && Boolean(actor?.id) && Boolean(actor?.branchId))
  const canViewFinancials = hasResidualCapability(
    authorizationActor,
    PRODUCT_TRACE_CAPABILITIES.FINANCIALS,
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
  PRODUCT_TRACE_CAPABILITIES,
  buildProductTracePermissions,
  assertCanViewProductTrace,
}
